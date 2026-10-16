// ── Security & Cryptographic Utilities ──
// SHA-256 hashing, bcrypt password verification, sensitive data sanitization & masking.

import crypto from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * Generate cryptographic SHA-256 hash of a string
 * @param {string} data
 * @returns {string} 64-char hex string
 */
export function hashSHA256(data) {
  if (!data) return '';
  return crypto.createHash('sha256').update(String(data).trim()).digest('hex');
}

/**
 * Hash a password using secure bcrypt with salt rounds
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Verify a password against stored hash.
 * Supports both bcrypt ($2a$, $2b$) and SHA-256 (64 hex chars).
 * @param {string} candidatePassword
 * @param {string} storedHash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(candidatePassword, storedHash) {
  if (!candidatePassword || !storedHash) return false;

  // 1. Direct bcrypt comparison (industry standard)
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    const directMatch = await bcrypt.compare(candidatePassword, storedHash);
    if (directMatch) return true;

    // Check if stored hash is bcrypt of SHA-256 candidate
    const shaCandidate = hashSHA256(candidatePassword);
    const shaBcryptMatch = await bcrypt.compare(shaCandidate, storedHash);
    if (shaBcryptMatch) return true;
  }

  // 2. Direct SHA-256 hex match (64 characters)
  if (storedHash.length === 64) {
    const candidateHash = hashSHA256(candidatePassword);
    return crypto.timingSafeEqual(
      Buffer.from(candidateHash, 'hex'),
      Buffer.from(storedHash, 'hex')
    );
  }

  return false;
}

/**
 * Mask mobile number to protect customer privacy
 * Example: "+919009149694" -> "+91 90091 ••••" or "••••••9694"
 * @param {string} phone
 * @returns {string}
 */
export function maskPhone(phone) {
  if (!phone) return '••••••••••';
  const clean = String(phone).replace(/\s+/g, '');
  if (clean.length <= 4) return '••••';
  const lastFour = clean.slice(-4);
  const prefix = clean.startsWith('+91') ? '+91 ' : '';
  const firstTwo = clean.replace('+91', '').slice(0, 2);
  return `${prefix}${firstTwo}••• ••${lastFour.slice(-2)}`;
}

/**
 * Mask payment reference / UTR for secure presentation
 * @param {string} utr
 * @returns {string}
 */
export function maskPaymentRef(utr) {
  if (!utr) return 'N/A';
  const clean = String(utr).trim();
  if (clean.length <= 4) return '••••';
  return `UTR-•••${clean.slice(-4).toUpperCase()}`;
}

/**
 * Deep-strip sensitive properties from objects before sending to client
 * @param {object} obj
 * @returns {object}
 */
export function sanitizeUserData(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = { ...obj };
  delete clone.passwordHash;
  delete clone.password;
  delete clone.refreshToken;
  delete clone.__v;
  return clone;
}
