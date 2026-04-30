import type { Env } from '../config/env';
import { UpstreamError } from '../utils/errors';
import { TTLCache } from '../utils/cache';
import { CircuitBreaker } from '../utils/circuitBreaker';
import { getLogger } from '../utils/logger';

export type PartnerRules = {
  partner_id: string;
  exclude_categories?: readonly string[];
  max_recommendations?: number;
  tier_multipliers?: Readonly<Record<string, number>>;
};

/**
 * Fetches partner rule configuration with in-process TTL cache and circuit breaker.
 * TODO: Back cache with Redis for cross-instance consistency in multi-replica AWS deployments.
 */
export class PartnerConfigService {
  private readonly env: Env;

  private readonly cache: TTLCache<string, PartnerRules>;

  private readonly breaker: CircuitBreaker;

  public constructor(env: Env, breaker: CircuitBreaker) {
    this.env = env;
    this.cache = new TTLCache<string, PartnerRules>(env.PARTNER_CONFIG_CACHE_TTL_MS, 500);
    this.breaker = breaker;
  }

  /**
   * Returns rules for a partner, using cache and upstream partner-config API.
   */
  public async getPartnerRules(partnerId: string): Promise<PartnerRules> {
    const cached = this.cache.get(partnerId);
    if (cached) {
      getLogger().debug({ partnerId, cacheHit: true }, 'partner_config_cache');
      return cached;
    }
    getLogger().debug({ partnerId, cacheHit: false }, 'partner_config_cache');

    const url = new URL(`/partners/${encodeURIComponent(partnerId)}/rules`, this.env.PARTNER_CONFIG_URL);
    const rules = await this.breaker.execute(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.env.PARTNER_CONFIG_TIMEOUT);
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new UpstreamError(`Partner config HTTP ${String(res.status)}`);
        }
        const body = (await res.json()) as unknown;
        return this.parseRules(partnerId, body);
      } catch (err) {
        if (err instanceof UpstreamError) {
          throw err;
        }
        const message = err instanceof Error ? err.message : 'Unknown upstream error';
        throw new UpstreamError(message);
      } finally {
        clearTimeout(timer);
      }
    });

    this.cache.set(partnerId, rules);
    return rules;
  }

  /** Exposes cache size for deep health checks. */
  public getCacheStats(): { size: number; ttlMs: number } {
    return { size: this.cache.size(), ttlMs: this.env.PARTNER_CONFIG_CACHE_TTL_MS };
  }

  /** Clears cached partner rules (tests and operational invalidation hooks). */
  public clearCache(): void {
    this.cache.clear();
  }

  private parseRules(partnerId: string, body: unknown): PartnerRules {
    if (!body || typeof body !== 'object') {
      throw new UpstreamError('Invalid partner rules payload');
    }
    const o = body as Record<string, unknown>;
    const parsed: PartnerRules = {
      partner_id: typeof o.partner_id === 'string' ? o.partner_id : partnerId,
      exclude_categories: Array.isArray(o.exclude_categories)
        ? o.exclude_categories.filter((c): c is string => typeof c === 'string')
        : undefined,
      max_recommendations: typeof o.max_recommendations === 'number' ? o.max_recommendations : undefined,
      tier_multipliers:
        o.tier_multipliers && typeof o.tier_multipliers === 'object' && o.tier_multipliers !== null
          ? Object.fromEntries(
              Object.entries(o.tier_multipliers as Record<string, unknown>).filter(
                ([, v]) => typeof v === 'number',
              ),
            ) as Record<string, number>
          : undefined,
    };
    return parsed;
  }
}
