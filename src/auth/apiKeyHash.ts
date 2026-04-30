import { createHash } from 'node:crypto';

/**
 * Produces a salted SHA-256 digest for storing API keys (never store raw keys).
 */
export function hashApiKey(salt: string, rawKey: string): string {
  return createHash('sha256').update(salt, 'utf8').update(rawKey, 'utf8').digest('hex');
}
