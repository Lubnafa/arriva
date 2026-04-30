import type { RequestHandler } from 'express';
import helmet from 'helmet';
import type { Env } from '../config/env';

/**
 * Helmet baseline: MIME sniffing, frameguard, referrer policy, etc.
 * HSTS is opt-in via `HSTS_ENABLED` (unsafe on plain HTTP dev).
 * CSP is disabled here — JSON APIs omit HTML CSP; the concierge HTML route sets its own CSP.
 */
export function createHelmetMiddleware(env: Env): RequestHandler {
  return helmet({
    hsts: env.HSTS_ENABLED
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: false }
      : false,
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
  });
}

export const cacheControlNoStoreMiddleware: RequestHandler = (_req, res, next): void => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};

/**
 * CSP for the static concierge page (Google Fonts + inline styles from `index.html`).
 */
export const conciergeContentSecurityPolicyMiddleware: RequestHandler = (_req, res, next): void => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "object-src 'none'",
      "img-src 'self' data:",
      "font-src 'self' https://fonts.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "script-src 'self'",
      "connect-src 'self'",
    ].join('; '),
  );
  next();
};
