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
