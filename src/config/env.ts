import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  API_KEY_SALT: z.string().min(16, 'API_KEY_SALT must be at least 16 characters'),
  MEMBER_SERVICE_URL: z.string().url(),
  MEMBER_SERVICE_TIMEOUT: z.coerce.number().int().positive().default(3000),
  PARTNER_CONFIG_URL: z.string().url(),
  PARTNER_CONFIG_TIMEOUT: z.coerce.number().int().positive().default(2000),
  PARTNER_CONFIG_CACHE_TTL_MS: z.coerce.number().int().nonnegative().default(300000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  /** Number of reverse proxies in front of this app (0 = disabled). Enables `X-Forwarded-*` parsing when > 0. */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(32).default(0),
  /**
   * Comma-separated allowed browser `Origin` values for `/v1/mcp/*`.
   * Empty + development: permissive `*` for local demos.
   * Empty + staging/production: no wildcard (browser cross-origin calls blocked unless listed here).
   */
  MCP_CORS_ORIGINS: z.string().default(''),
  /** Send `Strict-Transport-Security` only when TLS terminates at this process or you know clients always use HTTPS. */
  HSTS_ENABLED: z
    .enum(['true', 'false', '0', '1'])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  /** Max JSON body size (Express `limit`, e.g. `256kb`, `1mb`). */
  JSON_BODY_LIMIT: z.string().min(2).default('256kb'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates process.env at startup and returns a typed configuration object.
 * Throws ZodError on invalid configuration so the process exits before binding ports.
 */
export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment configuration: ${JSON.stringify(issues)}`);
  }
  return parsed.data;
}
