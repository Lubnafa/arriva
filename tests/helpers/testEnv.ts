import type { Env } from '../../src/config/env';

/**
 * Builds a minimal valid Env object for tests (mirrors production schema defaults).
 */
export function createTestEnv(overrides?: Partial<Env>): Env {
  return {
    PORT: 3000,
    NODE_ENV: 'development',
    API_KEY_SALT: 'test-salt-16chars-minimum-length-required!!',
    MEMBER_SERVICE_URL: 'http://member.test',
    MEMBER_SERVICE_TIMEOUT: 3000,
    PARTNER_CONFIG_URL: 'http://partner.test',
    PARTNER_CONFIG_TIMEOUT: 2000,
    PARTNER_CONFIG_CACHE_TTL_MS: 300000,
    LOG_LEVEL: 'error',
    RATE_LIMIT_WINDOW_MS: 60000,
    RATE_LIMIT_MAX_REQUESTS: 100,
    TRUST_PROXY_HOPS: 0,
    MCP_CORS_ORIGINS: '',
    HSTS_ENABLED: false,
    JSON_BODY_LIMIT: '256kb',
    ...overrides,
  };
}
