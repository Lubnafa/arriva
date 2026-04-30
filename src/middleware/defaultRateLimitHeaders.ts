import type { RequestHandler } from 'express';
import type { Env } from '../config/env';
import { HTTP_HEADER } from '../constants';

/**
 * Seeds rate limit headers before authenticated routes tighten remaining quota.
 */
export function createDefaultRateLimitHeadersMiddleware(env: Env): RequestHandler {
  return (_req, res, next): void => {
    res.setHeader(HTTP_HEADER.RATE_LIMIT_LIMIT, String(env.RATE_LIMIT_MAX_REQUESTS));
    res.setHeader(HTTP_HEADER.RATE_LIMIT_REMAINING, String(env.RATE_LIMIT_MAX_REQUESTS));
    next();
  };
}
