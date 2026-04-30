import type { RequestHandler } from 'express';
import { RateLimitError, UnauthorizedError } from '../utils/errors';
import { HTTP_HEADER } from '../constants';

/**
 * In-memory sliding-window rate limiter keyed by partner id.
 *
 * TODO: Replace store with Redis (e.g. sliding window via ZSET or dedicated rate-limit Lua)
 * so limits are consistent across App Runner / ECS tasks.
 */
export class SlidingWindowRateLimiter {
  private readonly windowMs: number;

  private readonly maxRequests: number;

  private readonly hits = new Map<string, number[]>();

  public constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  /** Configured window length in milliseconds. */
  public getWindowMs(): number {
    return this.windowMs;
  }

  /** Maximum requests allowed per window. */
  public getMaxRequests(): number {
    return this.maxRequests;
  }

  /**
   * Records a hit for the key when allowed; returns limit metadata.
   */
  public consume(key: string): { allowed: boolean; remaining: number; retryAfterMs?: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const existing = this.hits.get(key) ?? [];
    const pruned = existing.filter((t) => t > windowStart);

    if (pruned.length >= this.maxRequests) {
      const oldestInWindow = pruned[0];
      const retryAfterMs =
        oldestInWindow !== undefined ? Math.max(0, this.windowMs - (now - oldestInWindow)) : this.windowMs;
      return { allowed: false, remaining: 0, retryAfterMs };
    }

    pruned.push(now);
    this.hits.set(key, pruned);
    const remaining = this.maxRequests - pruned.length;
    return { allowed: true, remaining };
  }
}

/**
 * Express middleware applying per-partner rate limits after authentication.
 */
export function createRateLimiterMiddleware(limiter: SlidingWindowRateLimiter): RequestHandler {
  return (req, res, next): void => {
    try {
      const partnerId = req.partnerId;
      if (!partnerId) {
        throw new UnauthorizedError();
      }
      const limit = limiter.consume(partnerId);
      res.setHeader(HTTP_HEADER.RATE_LIMIT_LIMIT, String(limiter.getMaxRequests()));
      res.setHeader(HTTP_HEADER.RATE_LIMIT_REMAINING, String(Math.max(0, limit.remaining)));

      if (!limit.allowed) {
        throw new RateLimitError(limit.retryAfterMs ?? limiter.getWindowMs());
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
