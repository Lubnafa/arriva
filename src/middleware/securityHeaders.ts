import type { RequestHandler } from 'express';

/**
 * Applies baseline security headers on every HTTP response.
 */
export const securityHeadersMiddleware: RequestHandler = (_req, res, next): void => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  res.setHeader('Cache-Control', 'no-store');
  next();
};
