import crypto from 'crypto';

import env from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getKey = () => {
  if (!env.encryptionKey) {
    throw createHttpError('Server encryption is not configured.', 500);
  }

  if (/^[a-f0-9]{64}$/i.test(env.encryptionKey)) {
    return Buffer.from(env.encryptionKey, 'hex');
  }

  return crypto.createHash('sha256').update(env.encryptionKey).digest();
};

export const isEncryptionConfigured = () => Boolean(env.encryptionKey);

export const assertEncryptionConfigured = () => {
  if (!isEncryptionConfigured()) {
    throw createHttpError('Server encryption not configured. Set ENCRYPTION_KEY before connecting real platform accounts.', 400);
  }
};

export const encryptSecret = value => {
  if (!value) return '';

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
};

export const decryptSecret = encryptedValue => {
  if (!encryptedValue) return '';

  const [ivPart, tagPart, encryptedPart] = String(encryptedValue).split('.');

  if (!ivPart || !tagPart || !encryptedPart) {
    throw createHttpError('Stored credential payload is malformed.', 500);
  }

  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64url')),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
};
