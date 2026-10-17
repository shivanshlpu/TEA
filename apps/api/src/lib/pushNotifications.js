// ── Web Push Notification Service ──
// Sends browser Web Push notifications to owner / kitchen staff devices
// Supported across Mobile Chrome, Safari (macOS/iOS PWA), Edge, and Desktop.
// Subscriptions are persistently backed up in MongoDB Atlas (DeviceSubscription collection)
// and in-memory cache so they are NEVER lost across Render deployments.

import webPush from 'web-push';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.resolve(__dirname, '../../data/push_subscriptions.json');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BOBb3qg2Ya38RtPFmNw5_xccaiX3qWRYJpX7irCd5ZI-oWzVo-9P0v5dZHv--8apKgiGPc3ODKLv84MAtZCWwnE';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '7vy-XANWbQEs-CSBFa2Cr54i21Cq_AxgEVh1lMs6a0U';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@teabhatticafe.com';

webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// In-memory subscription cache
let subscriptions = [];

function loadSubscriptionsFromFile() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      subscriptions = JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[Push] Error loading subscriptions file:', err.message);
    subscriptions = [];
  }
}

function saveSubscriptionsToFile() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(subscriptions, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Push] Error saving subscriptions:', err.message);
  }
}

loadSubscriptionsFromFile();

export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY;
}

/**
 * Register or update device push subscription in MongoDB Atlas & in-memory cache
 */
export async function subscribeUser(subscription, businessId = 'default', userRole = 'owner', prisma = null) {
  if (!subscription || !subscription.endpoint) {
    throw new Error('Invalid subscription payload');
  }

  const endpoint = subscription.endpoint;
  const subString = JSON.stringify(subscription);

  // 1. Update in-memory cache
  subscriptions = subscriptions.filter(s => s.subscription?.endpoint !== endpoint && s.endpoint !== endpoint);
  subscriptions.push({
    endpoint,
    businessId,
    userRole,
    subscription,
    createdAt: new Date().toISOString(),
  });
  saveSubscriptionsToFile();

  // 2. Persist to MongoDB Atlas so Render redeployments NEVER lose this device
  if (prisma && prisma.deviceSubscription) {
    try {
      await prisma.deviceSubscription.upsert({
        where: { endpoint },
        update: {
          businessId,
          userRole,
          subscription: subString,
          updatedAt: new Date(),
        },
        create: {
          endpoint,
          businessId,
          userRole,
          subscription: subString,
        },
      });
      console.log(`💾 Push subscription saved to MongoDB Atlas for ${userRole} (${endpoint.slice(-16)})`);
    } catch (dbErr) {
      console.warn('[Push] Could not upsert to MongoDB (cached in memory):', dbErr.message);
    }
  }

  console.log(`🔔 Web Push subscriber active (Total in-memory: ${subscriptions.length})`);
  return { success: true, total: subscriptions.length };
}

/**
 * Unregister device subscription
 */
export async function unsubscribeUser(endpoint, prisma = null) {
  if (!endpoint) return { success: false };
  const initial = subscriptions.length;
  subscriptions = subscriptions.filter(s => s.subscription?.endpoint !== endpoint && s.endpoint !== endpoint);
  saveSubscriptionsToFile();

  if (prisma && prisma.deviceSubscription) {
    try {
      await prisma.deviceSubscription.deleteMany({ where: { endpoint } });
    } catch (_) {}
  }

  return { success: true, removed: initial - subscriptions.length };
}

/**
 * Dispatch Push Notification to all subscribed devices of a business
 */
export async function sendPushToBusiness(businessId, payload, prisma = null) {
  // 1. Sync from MongoDB Atlas if available to pick up all devices across instances/reboots
  if (prisma && prisma.deviceSubscription) {
    try {
      const dbSubs = await prisma.deviceSubscription.findMany({
        where: {
          OR: [
            { businessId: businessId || 'default' },
            { businessId: 'default' },
          ],
        },
      });

      if (dbSubs && dbSubs.length > 0) {
        // Merge into in-memory cache
        for (const record of dbSubs) {
          try {
            const parsed = JSON.parse(record.subscription);
            if (!subscriptions.some(s => (s.subscription?.endpoint || s.endpoint) === record.endpoint)) {
              subscriptions.push({
                endpoint: record.endpoint,
                businessId: record.businessId,
                userRole: record.userRole,
                subscription: parsed,
              });
            }
          } catch (_) {}
        }
      }
    } catch (e) {
      console.warn('[Push] DB sync warning:', e.message);
    }
  }

  loadSubscriptionsFromFile();

  const targets = subscriptions.filter(s => {
    const bId = s.businessId;
    return !businessId || bId === businessId || bId === 'default' || !bId;
  });

  if (targets.length === 0) {
    console.log('[Push] No active Web Push subscribers for business:', businessId);
    return { sent: 0, failed: 0 };
  }

  const payloadString = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  const expiredEndpoints = [];

  for (const item of targets) {
    try {
      const sub = item.subscription || item;
      await webPush.sendNotification(sub, payloadString, {
        TTL: 60 * 60, // 1 hour
        urgency: 'high',
      });
      sent++;
    } catch (err) {
      failed++;
      console.warn(`[Push] Push dispatch failed (${err.statusCode || err.message})`);
      if (err.statusCode === 404 || err.statusCode === 410) {
        expiredEndpoints.push(item.endpoint || item.subscription?.endpoint);
      }
    }
  }

  // Clean expired endpoints
  if (expiredEndpoints.length > 0) {
    subscriptions = subscriptions.filter(s => !expiredEndpoints.includes(s.endpoint || s.subscription?.endpoint));
    saveSubscriptionsToFile();

    if (prisma && prisma.deviceSubscription) {
      try {
        await prisma.deviceSubscription.deleteMany({
          where: { endpoint: { in: expiredEndpoints } },
        });
      } catch (_) {}
    }
  }

  console.log(`🚀 [Push Notification] Dispatched to ${sent} device(s) (failed: ${failed})`);
  return { sent, failed, total: targets.length };
}
