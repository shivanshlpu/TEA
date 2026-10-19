// ── Baileys WhatsApp Gateway & Multi-Device Session Engine ──
// Connects to WhatsApp via @whiskeysockets/baileys.
// Uses persistent multi-file auth state saved in data/baileys_auth/
// Preserves session indefinitely across server restarts and multi-device logins.

import * as baileysPkg from '@whiskeysockets/baileys';
const makeWASocket = baileysPkg.default || baileysPkg.makeWASocket;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = baileysPkg;

import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import { otpStore } from './otpStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Session storage directory
const AUTH_DIR = path.resolve(__dirname, '../../data/baileys_auth');

let sock = null;
let currentQrDataUrl = null;
let currentPairingCode = null;
let currentPairingPhone = null;
let isConnected = false;
let connectedUser = null;
let reconnectAttempts = 0;

// Ensure auth directory exists
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

/**
 * Initialize or resume Baileys WhatsApp Socket
 */
export async function initBaileys() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307], isLatest: true }));

    console.log(`📡 Initializing Baileys WhatsApp engine (v${version.join('.')}, isLatest: ${isLatest})...`);

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true, // Also prints in terminal for convenience
      logger: pino({ level: 'silent' }), // Clean logs
      browser: Browsers.macOS('Desktop'),
      syncFullHistory: false,
      generateHighQualityLinkPreview: true,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          currentQrDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
          console.log('📱 WhatsApp Web QR Code generated for Owner Dashboard scan!');
        } catch (e) {
          console.error('Failed to generate QR data URL:', e);
        }
      }

      if (connection === 'close') {
        isConnected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        console.log(`🔌 WhatsApp connection closed (Reason code: ${statusCode}). Reconnecting: ${shouldReconnect}`);

        if (statusCode === DisconnectReason.loggedOut) {
          console.log('⚠️ WhatsApp logged out. Cleaning old session to generate new QR...');
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            fs.mkdirSync(AUTH_DIR, { recursive: true });
          } catch (_) {}
          currentQrDataUrl = null;
          connectedUser = null;
          setTimeout(initBaileys, 3000);
        } else if (shouldReconnect) {
          reconnectAttempts++;
          const delay = Math.min(reconnectAttempts * 2000, 10000);
          console.log(`🔄 Attempting Baileys reconnect in ${delay}ms...`);
          setTimeout(initBaileys, delay);
        }
      } else if (connection === 'open') {
        isConnected = true;
        reconnectAttempts = 0;
        currentQrDataUrl = null;
        currentPairingCode = null;
        currentPairingPhone = null;
        connectedUser = sock.user;
        const cleanNumber = (connectedUser?.id || '').split(':')[0] || 'Connected';
        console.log(`✅ WhatsApp successfully connected as: +${cleanNumber} (${connectedUser?.name || 'Tea Bhatti Cafe'})`);
      }
    });

    // Listen for incoming customer messages (supports replying with 6-digit OTP directly in WhatsApp)
    sock.ev.on('messages.upsert', async ({ messages }) => {
      try {
        if (!messages || !messages[0]) return;
        const msg = messages[0];
        if (msg.key?.fromMe) return;

        const senderJid = msg.key?.remoteJid || '';
        if (!senderJid.endsWith('@s.whatsapp.net')) return;

        const rawSender = senderJid.split('@')[0];
        const cleanSender = rawSender.replace(/\D/g, '').slice(-10);

        const text = 
          msg.message?.conversation || 
          msg.message?.extendedTextMessage?.text || 
          '';

        if (!text) return;

        // Auto-verify if message is a 6-digit OTP for this user
        if (otpStore.checkWhatsAppReply(cleanSender, text)) {
          await sock.sendMessage(senderJid, {
            text: `✅ *Tea Bhatti Cafe*\n\nYour OTP *${text.trim()}* has been verified successfully!\n\nPlease return to the Tea Bhatti website to set your new password.`,
          });
        }
      } catch (err) {
        console.warn('Error processing incoming WhatsApp message:', err.message);
      }
    });

    return sock;
  } catch (err) {
    console.error('Failed to initialize Baileys:', err);
    isConnected = false;
  }
}

/**
 * Get live WhatsApp connection status, current QR code, or pairing code
 */
export function getWhatsAppStatus() {
  const phone = (connectedUser?.id || '').split(':')[0] || '';
  return {
    ready: isConnected,
    phone: phone ? `+${phone}` : null,
    name: connectedUser?.name || 'Tea Bhatti Cafe',
    qr: isConnected ? null : currentQrDataUrl,
    pairingCode: isConnected ? null : currentPairingCode,
    pairingCodeFormatted: isConnected ? null : (currentPairingCode ? currentPairingCode.match(/.{1,4}/g)?.join('-') || currentPairingCode : null),
    pairingPhone: isConnected ? null : currentPairingPhone,
    authDirExists: fs.existsSync(AUTH_DIR),
  };
}

/**
 * Request an 8-digit WhatsApp pairing code for linking via phone number
 * @param {string} rawPhone
 * @returns {Promise<{ success: boolean, code: string, formattedCode: string, phone: string }>}
 */
export async function requestWhatsAppPairingCode(rawPhone) {
  if (isConnected && sock?.user) {
    throw new Error('WhatsApp is already connected as ' + (sock.user?.id || 'active account'));
  }

  // Ensure socket is initialized
  if (!sock) {
    await initBaileys();
    await new Promise((r) => setTimeout(r, 1500));
  }

  // Sanitize phone number to digits only
  let digits = String(rawPhone || '').replace(/\D/g, '');
  if (digits.length === 10) {
    digits = `91${digits}`; // Default to India (+91) if 10 digits
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = `91${digits.slice(1)}`;
  }

  if (digits.length < 10 || digits.length > 15) {
    throw new Error('Please enter a valid 10-digit mobile number (e.g. 9009149694).');
  }

  try {
    const code = await sock.requestPairingCode(digits);
    currentPairingCode = code;
    currentPairingPhone = digits;
    const formattedCode = code ? code.match(/.{1,4}/g)?.join('-') || code : '';
    console.log(`🔑 WhatsApp pairing code generated for +${digits}: ${formattedCode}`);
    return {
      success: true,
      code,
      formattedCode,
      phone: digits,
    };
  } catch (err) {
    console.error('Failed to request pairing code:', err);
    throw new Error(err.message || 'Failed to generate pairing code. Please try again.');
  }
}

/**
 * Disconnect and purge session for fresh connection (QR or pairing code)
 */
export async function logoutWhatsApp() {
  try {
    if (sock) {
      await sock.logout().catch(() => {});
    }
  } catch (_) {}
  try {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  } catch (_) {}
  isConnected = false;
  connectedUser = null;
  currentQrDataUrl = null;
  currentPairingCode = null;
  currentPairingPhone = null;
  setTimeout(initBaileys, 2000);
  return { success: true, message: 'Session reset. Ready for QR scan or pairing code...' };
}

/**
 * Format mobile number to international JID
 * @param {string} rawPhone
 * @returns {string} JID format (e.g., 919009149694@s.whatsapp.net)
 */
function formatJid(rawPhone) {
  if (!rawPhone) return null;
  let digits = String(rawPhone).replace(/\D/g, '');
  if (digits.length === 10) {
    digits = `91${digits}`;
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = `91${digits.slice(1)}`;
  }
  return `${digits}@s.whatsapp.net`;
}

/**
 * Send text message to a customer
 * @param {string} phone
 * @param {string} text
 */
export async function sendWhatsAppMessage(phone, text) {
  if (!isConnected || !sock) {
    throw new Error('WhatsApp is not connected. Please scan the QR code in Owner Settings.');
  }

  const jid = formatJid(phone);
  if (!jid) throw new Error('Invalid phone number provided');

  await sock.sendMessage(jid, { text });
  console.log(`✉️ Baileys sent message to ${phone}`);
  return { success: true };
}

/**
 * Send image with caption (for marketing posters or promotional deals)
 * @param {string} phone
 * @param {string} imageUrl
 * @param {string} caption
 */
export async function sendWhatsAppImage(phone, imageUrl, caption) {
  if (!isConnected || !sock) {
    throw new Error('WhatsApp is not connected.');
  }

  const jid = formatJid(phone);
  if (!jid) throw new Error('Invalid phone number');

  await sock.sendMessage(jid, {
    image: { url: imageUrl },
    caption: caption || ''
  });
  console.log(`🖼️ Baileys sent image poster to ${phone}`);
  return { success: true };
}

/**
 * Send 10-Minute Advance Pickup Alert to Customer
 */
export async function sendPickupSoonAlert(phone, order) {
  const pickupCode = order.pickupCode || order.id.slice(-6).toUpperCase();
  const text = 
`☕ *Tea Bhatti Cafe — Pickup Reminder*

Namaste! Your order *#${pickupCode}* is currently being freshly cooked and will be ready in approx *10 minutes*! 🕒

📍 *Pickup Counter:* Medical College Road, In front of New Kishan Hardware, Shahdol
🏷️ *Your Token:* #${pickupCode}

Please head over to the counter so you can enjoy your food hot and fresh! 🥪`;

  return sendWhatsAppMessage(phone, text);
}

/**
 * Send Order Ready & Pickup Call Alert to Customer
 */
export async function sendOrderReadyAlert(phone, order) {
  const pickupCode = order.pickupCode || order.id.slice(-6).toUpperCase();
  const balanceText = order.balanceDueAtShop > 0 
    ? `\n💰 Balance Due at Shop: ₹${order.balanceDueAtShop}` 
    : '';

  const text = 
`🎉 *Your Order is Ready for Pickup!*

Order *#${pickupCode}* is packed and waiting hot at the Tea Bhatti Cafe counter!

🏷️ *Pickup Token:* #${pickupCode}${balanceText}
📍 *Location:* Medical College Road, Shahdol
📞 *Store Contact:* +91 90091 49694

Please present this token at the counter to collect your order. Enjoy your meal! ✨`;

  return sendWhatsAppMessage(phone, text);
}

/**
 * Send Thank You Message after delivery
 */
export async function sendThankYouAlert(phone, order) {
  const pickupCode = order.pickupCode || order.id.slice(-6).toUpperCase();
  const text =
`🙏 *Thank You for Ordering with Tea Bhatti Cafe!*

We hope you enjoyed order *#${pickupCode}*!
Har Ghoont Me Sukoon, Har Bite Me Swaad. ☕

Have feedback? Let us know or order your next hot snack directly at our store!`;

  return sendWhatsAppMessage(phone, text);
}
