/**
 * Resolves a partner id from a previously persisted API key hash.
 *
 * TODO: Replace this in-memory Map with DynamoDB (partition key = key_hash, attribute partner_id)
 * or RDS (hashed_key PK) for multi-instance deployments and rotation workflows.
 */
export type KeyStore = Map<string, string>;

/**
 * Builds the default hard-coded key store populated with salted hashes for known partners.
 * Replace hashes using `npm run generate-api-key -- <partner_id>` output.
 */
export function createDefaultKeyStore(): KeyStore {
  return new Map<string, string>([
    // Example placeholder hashes — run generate-api-key locally and paste hashes here.
    // ['<sha256-hex-of-salted-key>', 'partner_demo'],
  ]);
}
