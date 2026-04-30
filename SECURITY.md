# Security practices

## API keys

- Partners authenticate with `Authorization: Bearer <raw_key>`.
- Servers never persist raw keys—only salted SHA-256 digests (`API_KEY_SALT` + raw secret).
- Missing or incorrect credentials both return `401 {"error":"UNAUTHORIZED"}` to avoid leaking which check failed.
- Reference implementation stores hashes in `auth/keyStore.ts`; production should move this map to DynamoDB or RDS with encryption at rest.

Use `npm run generate-api-key -- <partner_id>` to mint keys. Transfer raw secrets via encrypted channels (PGP, Vault, partner portal).

## Logging boundaries

**Logged (structured JSON via Pino):**

- Request metadata (`requestId`, route, tool name)
- Member identifiers (`member_id`) needed for troubleshooting ranking
- Partner identifiers (`partner_id`) after authentication
- Validation problems (field names + messages, never raw payloads)
- Circuit breaker transitions and cache diagnostics at `debug`

**Never logged:**

- Raw or hashed API keys
- Authorization headers (also redacted via Pino paths)
- Member PII beyond opaque identifiers (names, emails, payment details)
- Full JSON bodies—when necessary, log top-level field names only

## Rotating a compromised key

1. Generate a new random secret with the helper script using the existing salt (or rotate the salt during a coordinated maintenance window—requires rehashing every partner key simultaneously).
2. Append the new hash to the authoritative key store while keeping the old hash active briefly.
3. Deliver the new raw key to the partner and confirm traffic moves over.
4. Remove the compromised hash from the store once telemetry shows zero usage.
5. Capture an incident record noting scope, timeline, and whether upstream caches need flushing (`PartnerConfigService.clearCache()` pattern).

## Dependency updates

- Run `npm audit` during each release train; patch moderate/high CVEs before promoting to production.
- Pin ranges conservatively in `package.json`; rely on lockfile integrity in CI.
- Re-run the full Jest suite plus container smoke tests after major upgrades (Express, Zod, Node base image).
