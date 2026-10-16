// ── WhatsApp Integration Helper ──
// Powered by Baileys WhatsApp Engine with Gateway Fallback.

import { 
  getWhatsAppStatus, 
  sendWhatsAppMessage, 
  sendPickupSoonAlert, 
  sendOrderReadyAlert, 
  sendThankYouAlert 
} from './baileys.js';

const WHATSAPP_GATEWAY_URL = process.env.WHATSAPP_GATEWAY_URL || 'http://localhost:5001';

/**
 * Send raw WhatsApp text message
 */
export async function sendWhatsAppNotification(phone, message) {
  const status = getWhatsAppStatus();
  if (status.ready) {
    try {
      await sendWhatsAppMessage(phone, message);
      return true;
    } catch (err) {
      console.warn('Baileys direct send failed, trying gateway fallback:', err.message);
    }
  }

  // Fallback to gateway if microservice is running
  try {
    const response = await fetch(`${WHATSAPP_GATEWAY_URL}/api/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message }),
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Send templated WhatsApp message
 */
export async function sendWhatsAppTemplate(phone, templateType, data = {}) {
  const status = getWhatsAppStatus();
  
  // High-fidelity templates for Tea Bhatti
  if (status.ready) {
    try {
      if (templateType === 'order_ready') {
        await sendOrderReadyAlert(phone, {
          pickupCode: data.orderId ? data.orderId.slice(-6).toUpperCase() : 'TB-READY',
          balanceDueAtShop: data.balanceDueAtShop || 0
        });
        return true;
      }

      if (templateType === 'order_delivered') {
        await sendThankYouAlert(phone, {
          pickupCode: data.orderId ? data.orderId.slice(-6).toUpperCase() : 'TB-DONE'
        });
        return true;
      }

      let text = '';
      if (templateType === 'order_accepted') {
        text = `✅ *Order Accepted!*\n\nYour order at *Tea Bhatti Cafe* is accepted and being cooked fresh! 🥪☕\n\n🆔 Order: #${(data.orderId || '').slice(-6).toUpperCase()}\n💰 Total: ₹${data.total || 0}\n\nTrack order: ${data.trackingUrl || ''}`;
      } else if (templateType === 'new_order') {
        text = `🚨 *New Store Pickup Order!*\n\nOrder #${(data.orderId || '').slice(-6).toUpperCase()}\nTotal: ₹${data.total || 0}\nCheck your dashboard to start prep.`;
      } else {
        text = data.message || `Tea Bhatti Cafe notification: Order #${(data.orderId || '').slice(-6).toUpperCase()}`;
      }

      await sendWhatsAppMessage(phone, text);
      return true;
    } catch (err) {
      console.warn('Baileys template send error:', err.message);
    }
  }

  // Fallback to HTTP gateway
  try {
    const response = await fetch(`${WHATSAPP_GATEWAY_URL}/api/send-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, templateType, data }),
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Send bulk WhatsApp messages with delay
 */
export async function sendWhatsAppBulk(recipients, message) {
  const results = { success: true, sent: 0, failed: 0 };
  for (const phone of recipients) {
    try {
      await sendWhatsAppNotification(phone, message);
      results.sent++;
      await new Promise(r => setTimeout(r, 1800)); // 1.8s delay
    } catch (_) {
      results.failed++;
    }
  }
  return results;
}
