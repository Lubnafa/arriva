import type { Env } from '../config/env';
import { NotFoundError, UpstreamError } from '../utils/errors';
import { CircuitBreaker } from '../utils/circuitBreaker';

export type MemberProfile = {
  member_id: string;
  tier: string;
  past_destinations: readonly string[];
};

/**
 * HTTP client for the member profile upstream API.
 */
export class MemberService {
  private readonly env: Env;

  private readonly breaker: CircuitBreaker;

  public constructor(env: Env, breaker: CircuitBreaker) {
    this.env = env;
    this.breaker = breaker;
  }

  /**
   * Fetches a member profile by id from the member service.
   */
  public async getMemberProfile(memberId: string): Promise<MemberProfile> {
    const url = new URL(`/members/${encodeURIComponent(memberId)}`, this.env.MEMBER_SERVICE_URL);
    return this.breaker.execute(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.env.MEMBER_SERVICE_TIMEOUT);
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (res.status === 404) {
          throw new NotFoundError('Member not found');
        }
        if (!res.ok) {
          throw new UpstreamError(`Member service HTTP ${String(res.status)}`);
        }
        const body = (await res.json()) as unknown;
        return this.parseMember(body, memberId);
      } catch (err) {
        if (err instanceof NotFoundError || err instanceof UpstreamError) {
          throw err;
        }
        const message = err instanceof Error ? err.message : 'Unknown upstream error';
        throw new UpstreamError(message);
      } finally {
        clearTimeout(timer);
      }
    });
  }

  private parseMember(body: unknown, fallbackMemberId: string): MemberProfile {
    if (!body || typeof body !== 'object') {
      throw new UpstreamError('Invalid member payload');
    }
    const o = body as Record<string, unknown>;
    const memberId = typeof o.member_id === 'string' ? o.member_id : fallbackMemberId;
    const tier = typeof o.tier === 'string' ? o.tier : 'standard';
    const pastDestinations = Array.isArray(o.past_destinations)
      ? o.past_destinations.filter((d): d is string => typeof d === 'string')
      : [];
    return { member_id: memberId, tier, past_destinations: pastDestinations };
  }
}
