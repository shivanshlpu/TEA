// ── Order Automation Scheduler ──
// Periodically checks orders in 'preparing' state and automatically fires
// the 10-minute advance pickup notification via WhatsApp & Socket.io.
// Idempotent: checks `readySoon === false` before triggering, ensuring exactly-once execution.

import { sendPickupSoonAlert } from './baileys.js';
import { sendWhatsAppNotification } from './whatsapp.js';

let intervalId = null;

export async function checkOrdersReadySoon(prisma, io) {
  if (!prisma) return;

  try {
    const preparingOrders = await prisma.order.findMany({
      where: {
        status: 'preparing',
        readySoon: false,
      },
      include: {
        customer: { include: { user: true } },
        business: true,
      },
    });

    const now = Date.now();

    for (const order of preparingOrders) {
      const estimatedMinutes = order.estimatedMinutes || 30;
      const orderTime = new Date(order.createdAt).getTime();
      const targetTime = orderTime + (estimatedMinutes * 60 * 1000);
      const remainingMinutes = (targetTime - now) / (60 * 1000);

      // Trigger if remaining time is <= 10 minutes (or if prep has been ongoing >= 20 mins of 30)
      if (remainingMinutes <= 10) {
        // Atomic flag update to prevent double triggers
        const updated = await prisma.order.update({
          where: { id: order.id },
          data: {
            readySoon: true,
            readySoonAt: new Date(),
          },
        });

        await prisma.orderStatusLog.create({
          data: {
            orderId: order.id,
            status: 'ready_in_10_minutes_auto_scheduled',
          },
        });

        console.log(`⏰ [Scheduler] Dispatched 10-min reminder for Order #${order.pickupCode || order.id.slice(-6)} (Est. rem: ${Math.round(remainingMinutes)}m)`);

        // Real-time Socket.io push to customer
        if (io) {
          io.to(`order:${order.id}`).emit('order-ready-soon', {
            orderId: order.id,
            pickupCode: order.pickupCode,
            readySoon: true,
            readySoonAt: new Date(),
            remainingMinutes: Math.max(0, Math.round(remainingMinutes)),
            message: 'Your order will be fresh & ready in 10 minutes! Please head to Tea Bhatti counter.',
          });

          io.to(`business:${order.businessId}`).emit('order-updated', {
            orderId: order.id,
            readySoon: true,
          });
        }

        // WhatsApp dispatch
        const customerPhone = order.customer?.user?.phone;
        if (customerPhone) {
          // If test phone (e.g. 99999...), sandbox log
          if (customerPhone.includes('99999') || customerPhone.includes('test') || process.env.WHATSAPP_SANDBOX === 'true') {
            console.log(`📱 [WhatsApp Sandbox] 10-min reminder sent to ${customerPhone} for order #${order.pickupCode || order.id.slice(-6)}`);
          } else {
            sendPickupSoonAlert(customerPhone, order).catch(() => {
              // Fallback to text template
              sendWhatsAppNotification(
                customerPhone,
                `Tea Bhatti Alert: Your order #${order.pickupCode || order.id.slice(-6)} will be hot & ready in 10 minutes! Please head over to the counter (Near Medical College, Shahdol).`
              ).catch(e => console.warn('[Scheduler WhatsApp Error]:', e.message));
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error checking ready soon orders:', err.message);
  }
}

export function startOrderScheduler(prisma, io, intervalMs = 30000) {
  if (intervalId) clearInterval(intervalId);
  console.log(`⏱️ Starting Order Automation Scheduler (every ${intervalMs / 1000}s)...`);
  intervalId = setInterval(() => checkOrdersReadySoon(prisma, io), intervalMs);
  return intervalId;
}

export function stopOrderScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('⏱️ Stopped Order Automation Scheduler.');
  }
}
