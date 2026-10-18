import 'dotenv/config';
import Razorpay from 'razorpay';
import crypto from 'crypto';

export function getRazorpayKeyId() {
  return process.env.RAZORPAY_KEY_ID || '';
}

export function getRazorpayKeySecret() {
  return process.env.RAZORPAY_KEY_SECRET || '';
}

export function getRazorpayClient() {
  const key_id = getRazorpayKeyId();
  const key_secret = getRazorpayKeySecret();
  if (!key_id || !key_secret) {
    return null;
  }
  return new Razorpay({ key_id, key_secret });
}

/**
 * STEP 1: Backend - Create Razorpay Standard Order
 * @param {Object} params
 * @param {number} params.amount - in paise (minimum 100 paise = ₹1)
 * @param {string} params.currency - e.g. 'INR'
 * @param {string} [params.receipt]
 * @param {Object} [params.notes]
 */
export async function createStandardRazorpayOrder({ amount, currency = 'INR', receipt, notes = {} }) {
  const client = getRazorpayClient();
  if (!client) {
    const err = new Error('Razorpay API keys not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
    err.status = 401;
    throw err;
  }

  const amountInPaise = Math.round(Number(amount));
  if (isNaN(amountInPaise) || amountInPaise < 100) {
    const err = new Error('Amount must be at least 100 paise (₹1)');
    err.status = 400;
    throw err;
  }

  const safeReceipt = receipt || `rcpt_${Date.now().toString().slice(-10)}_${Math.random().toString(36).substring(2, 7)}`;

  const orderOptions = {
    amount: amountInPaise,
    currency: currency || 'INR',
    receipt: safeReceipt.substring(0, 40),
    notes,
  };

  const rzpOrder = await client.orders.create(orderOptions);

  return {
    order_id: rzpOrder.id,
    id: rzpOrder.id,
    amount: rzpOrder.amount, // in paise
    currency: rzpOrder.currency,
    receipt: rzpOrder.receipt,
    status: rzpOrder.status,
    key_id: getRazorpayKeyId(),
    keyId: getRazorpayKeyId(),
  };
}

/**
 * Convenience wrapper for application orders
 */
export async function createRazorpayOrder({ orderId, amount, pickupCode, businessId, notes = {} }) {
  // Amount passed in rupees -> convert to paise
  const amountInPaise = Math.round(Number(amount) * 100);
  return createStandardRazorpayOrder({
    amount: amountInPaise,
    currency: 'INR',
    receipt: `rcpt_${orderId.slice(-16)}_${Date.now().toString().slice(-8)}`,
    notes: {
      orderId,
      pickupCode: pickupCode || '',
      businessId: businessId || '',
      ...notes,
    },
  });
}

/**
 * STEP 3: Backend - Verify Signature
 * Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
 */
export function verifySignature({ order_id, payment_id, signature }) {
  const secret = getRazorpayKeySecret();
  if (!secret) return false;
  if (!order_id || !payment_id || !signature) return false;

  const body = `${order_id}|${payment_id}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  try {
    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const signatureBuf = Buffer.from(signature, 'utf8');
    if (expectedBuf.length !== signatureBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  } catch (_) {
    return expectedSignature === signature;
  }
}

/**
 * Compatibility alias for verifyRazorpaySignature
 */
export function verifyRazorpaySignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  return verifySignature({
    order_id: razorpayOrderId,
    payment_id: razorpayPaymentId,
    signature: razorpaySignature,
  });
}

/**
 * Verify Webhook Signature
 */
export function verifyRazorpayWebhookSignature(rawBody, signature, secret) {
  const webhookSecret = secret || process.env.RAZORPAY_WEBHOOK_SECRET || getRazorpayKeySecret();
  if (!webhookSecret || !signature) return false;

  try {
    return Razorpay.validateWebhookSignature(rawBody, signature, webhookSecret);
  } catch (err) {
    console.warn('[Razorpay] Webhook signature verification error:', err.message);
    return false;
  }
}

/**
 * Process a Razorpay refund
 */
export async function processRazorpayRefund({ paymentId, amount, notes = {} }) {
  const client = getRazorpayClient();
  if (!client) {
    throw new Error('Razorpay is not configured on this server');
  }

  const refundOptions = { notes };
  if (amount) {
    refundOptions.amount = Math.round(Number(amount) * 100);
  }

  return await client.payments.refund(paymentId, refundOptions);
}
