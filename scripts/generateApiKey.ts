import { randomBytes } from 'node:crypto';
import { hashApiKey } from '../src/auth/apiKeyHash';

/**
 * Generates a random API key and prints the raw secret plus salted SHA-256 hash for storage.
 */
function main(): void {
  const partnerId = process.argv[2];
  if (!partnerId || partnerId.trim().length === 0) {
    process.stderr.write('Usage: npx ts-node scripts/generateApiKey.ts <partner_id>\n');
    process.exit(1);
  }

  const salt = process.env.API_KEY_SALT;
  if (!salt || salt.length < 16) {
    process.stderr.write('API_KEY_SALT environment variable is required (minimum 16 characters).\n');
    process.exit(1);
  }

  const rawKey = randomBytes(32).toString('base64url');
  const storedHash = hashApiKey(salt, rawKey);

  process.stdout.write(`partner_id: ${partnerId}\n`);
  process.stdout.write(`raw_key (give to partner once): ${rawKey}\n`);
  process.stdout.write(`hash (persist server-side only): ${storedHash}\n`);
}

main();
