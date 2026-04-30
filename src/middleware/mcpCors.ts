import type { RequestHandler } from 'express';
import type { Env } from '../config/env';

function parseAllowedOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * CORS for `/v1/mcp/*`.
 * - `development` with empty `MCP_CORS_ORIGINS`: permissive `*` for local browser demos.
 * - `staging` / `production` with empty allowlist: strict (no `Access-Control-Allow-Origin: *`).
 * - Non-empty `MCP_CORS_ORIGINS`: exact `Origin` reflection when it matches the list.
 */
export function createMcpCorsMiddleware(env: Env): RequestHandler {
  const allowlist = parseAllowedOrigins(env.MCP_CORS_ORIGINS);
  const permissiveDevWildcard = env.NODE_ENV === 'development' && allowlist.length === 0;

  return (req, res, next): void => {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Accept, API-Version, X-Request-ID',
    );
    res.setHeader('Access-Control-Max-Age', '86400');

    if (permissiveDevWildcard) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (allowlist.length > 0) {
      const origin = req.header('Origin');
      if (origin && allowlist.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
      }
    }

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  };
}
