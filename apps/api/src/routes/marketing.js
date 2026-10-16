// ── WhatsApp Marketing & Campaign Engine ──
// Owner-curated messages & posters dispatched with a 1.5–3 second anti-spam queue.
// Inspired by Swiggy/Zomato personalized notifications.

import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { requireBusinessScope } from '../middleware/businessScope.js';
import { validate } from '../middleware/validate.js';
import { 
  getWhatsAppStatus, 
  sendWhatsAppMessage, 
  sendWhatsAppImage 
} from '../lib/baileys.js';

const router = Router();

// In-memory campaign queue store
const campaigns = [
  {
    id: 'camp-welcome',
    title: 'Welcome Thank You Note',
    message: 'Namaste! ☕ Welcome to Tea Bhatti Cafe. Enjoy 10% off your next store pickup with code TB10 at Medical College Road, Shahdol!',
    imageUrl: '',
    audience: 'all',
    totalRecipients: 1,
    sentCount: 1,
    failedCount: 0,
    status: 'completed',
    createdAt: new Date().toISOString(),
  }
];

let isQueueProcessing = false;
const activeQueue = [];

// Swiggy-style pre-built templates
const TEMPLATES = [
  {
    id: 'tpl-1',
    category: 'Welcome / Thank You',
    title: 'Swiggy-Style: Post-Visit Thank You',
    message: `☕ *Thank you from Tea Bhatti Cafe!*

We hope you loved your fresh bites today. Chai se zyada, Ek Habit hai! 

Next time, skip the waiting line by ordering ahead on our web app for quick 15-min counter pickup. See you again! 🥪✨`,
  },
  {
    id: 'tpl-2',
    category: 'Special Offer',
    title: 'Rainy / Evening Chai & Sandwich Combo',
    message: `🌧️ *Chai Weather Alert at Tea Bhatti!*

Hot Terracotta Kulhad Chai paired with crispy grilled Tandoori Paneer Sandwich is waiting for you at Medical College Road, Shahdol.

Order pickup now & collect piping hot! 🔥`,
  },
  {
    id: 'tpl-3',
    category: 'Weekend Treat',
    title: 'Weekend Bestseller Feast (10% Off)',
    message: `🎉 *Weekend Feast at Tea Bhatti Cafe!*

Get your favourite Peppy Paneer Pizza, Cheesy Maggie & Golden Vadapav freshly baked. 

Use coupon *CHAI10* on checkout for instant savings! Zero waiting at counter. 🍔🍕`,
  },
  {
    id: 'tpl-4',
    category: 'Customer Loyalty',
    title: 'We Miss You — Special Invite',
    message: `❤️ *It’s been a few days since your last Chai!*

Your favourite spot at Tea Bhatti Cafe misses you. Drop by Medical College Road counter today for freshly brewed goodness! ☕`,
  }
];

const campaignSchema = z.object({
  title: z.string().min(2, 'Campaign title is required'),
  message: z.string().min(5, 'Message must be at least 5 characters'),
  imageUrl: z.string().url().optional().or(z.literal('')),
  audience: z.enum(['all', 'recent', 'premium', 'test']),
  testPhone: z.string().optional(),
});

// Helper for 1.5–3.0 second random gap
function getRandomDelay() {
  return Math.floor(Math.random() * (3000 - 1500 + 1)) + 1500;
}

// Background Queue Worker
async function processQueue() {
  if (isQueueProcessing || activeQueue.length === 0) return;
  isQueueProcessing = true;

  while (activeQueue.length > 0) {
    const job = activeQueue.shift();
    const campaign = campaigns.find(c => c.id === job.campaignId);
    if (!campaign) continue;

    campaign.status = 'sending';

    for (const recipient of job.recipients) {
      try {
        if (job.imageUrl) {
          await sendWhatsAppImage(recipient.phone, job.imageUrl, job.message);
        } else {
          await sendWhatsAppMessage(recipient.phone, job.message);
        }
        campaign.sentCount++;
      } catch (err) {
        console.error(`Failed to send campaign message to ${recipient.phone}:`, err.message);
        campaign.failedCount++;
      }

      // Respect anti-spam delay between individual recipients (1.5 - 3 seconds)
      const delay = getRandomDelay();
      console.log(`⏱️ Anti-spam gap: waiting ${delay}ms before next message...`);
      await new Promise(r => setTimeout(r, delay));
    }

    campaign.status = 'completed';
    console.log(`🏁 Campaign "${campaign.title}" finished. Sent: ${campaign.sentCount}, Failed: ${campaign.failedCount}`);
  }

  isQueueProcessing = false;
}

// ── GET /marketing/templates — fetch Swiggy-style templates ──
router.get('/templates', authenticate, authorize('owner'), (req, res) => {
  res.json(TEMPLATES);
});

// ── GET /marketing/campaigns — list campaigns & queue status ──
router.get('/campaigns', authenticate, authorize('owner'), (req, res) => {
  res.json({
    campaigns: [...campaigns].reverse(),
    isProcessing: isQueueProcessing,
    queueLength: activeQueue.length,
    whatsappStatus: getWhatsAppStatus(),
  });
});

// ── POST /marketing/campaign — schedule a queued campaign ──
router.post('/campaign',
  authenticate,
  authorize('owner'),
  requireBusinessScope,
  validate(campaignSchema),
  async (req, res) => {
    try {
      const wa = getWhatsAppStatus();
      if (!wa.ready) {
        return res.status(400).json({
          error: 'WhatsApp is not connected. Please scan the QR code in Owner Settings first.'
        });
      }

      const { title, message, imageUrl, audience, testPhone } = req.body;

      let recipients = [];

      if (audience === 'test') {
        const target = testPhone || req.user?.phone;
        if (!target) {
          return res.status(400).json({ error: 'Please provide a testPhone number.' });
        }
        recipients = [{ phone: target, name: 'Owner / Test' }];
      } else {
        // Fetch real customers from DB
        const dbUsers = await req.prisma.user.findMany({
          where: { role: 'customer' },
          select: { name: true, phone: true }
        });

        recipients = dbUsers.map(u => ({ phone: u.phone, name: u.name }));

        // If audience is recent, pick first 20
        if (audience === 'recent') {
          recipients = recipients.slice(0, 20);
        }
      }

      if (recipients.length === 0) {
        return res.status(400).json({ error: 'No recipients found for this audience.' });
      }

      const campaignId = 'camp-' + Date.now();
      const newCampaign = {
        id: campaignId,
        title,
        message,
        imageUrl: imageUrl || '',
        audience,
        totalRecipients: recipients.length,
        sentCount: 0,
        failedCount: 0,
        status: 'queued',
        createdAt: new Date().toISOString(),
      };

      campaigns.push(newCampaign);

      // Add to queue
      activeQueue.push({
        campaignId,
        message,
        imageUrl,
        recipients
      });

      // Trigger background processing
      processQueue().catch(console.error);

      res.status(201).json({
        message: `Campaign queued for ${recipients.length} customer(s) with 1.5–3s safe interval`,
        campaign: newCampaign
      });
    } catch (err) {
      console.error('Campaign creation error:', err);
      res.status(500).json({ error: 'Failed to dispatch campaign' });
    }
  }
);

export default router;
