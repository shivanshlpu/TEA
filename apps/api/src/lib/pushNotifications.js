// ── Web Push Notification Service ──
// Sends browser Web Push notifications to owner / kitchen staff devices
// Supported across Mobile Chrome, Safari (macOS/iOS PWA), Edge, and Desktop.

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

function loadSubscriptions() {
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

function saveSubscriptions() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(subscriptions, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Push] Error saving subscriptions:', err.message);
  }
}

loadSubscriptions();

export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY;
}

export function subscribeUser(subscription, businessId = 'default', userRole = 'owner') {
  if (!subscription || !subscription.endpoint) {
    throw new Error('Invalid subscription payload');
  }

  // Remove existing entry for the same endpoint if already present
  subscriptions = subscriptions.filter(s => s.subscription.endpoint !== subscription.endpoint);

  subscriptions.push({
    businessId,
    userRole,
    subscription,
    createdAt: new Date().toISOString(),
  });

  saveSubscriptions();
  console.log(`🔔 Web Push subscription saved (Total active: ${subscriptions.length})`);
  return { success: true, total: subscriptions.length };
}

export function unsubscribeUser(endpoint) {
  if (!endpoint) return { success: false };
  const initial = subscriptions.length;
  subscriptions = subscriptions.filter(s => s.subscription.endpoint !== endpoint);
  saveSubscriptions();
  return { success: true, removed: initial - subscriptions.length };
}

export async function sendPushToBusiness(businessId, payload) {
  loadSubscriptions();
  const targets = subscriptions.filter(s => !businessId || s.businessId === businessId || s.businessId === 'default');

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
      await webPush.sendNotification(item.subscription, payloadString, {
        TTL: 60 * 60, // 1 hour
        urgency: 'high',
      });
      sent++;
    } catch (err) {
      failed++;
      console.warn(`[Push] Push dispatch failed (${err.statusCode || err.message})`);
      if (err.statusCode === 404 || err.statusCode === 410) {
        expiredEndpoints.push(item.subscription.endpoint);
      }
    }
  }

  if (expiredEndpoints.length > 0) {
    subscriptions = subscriptions.filter(s => !expiredEndpoints.includes(s.subscription.endpoint));
    saveSubscriptions();
  }

  return { sent, failed, total: targets.length };
}
