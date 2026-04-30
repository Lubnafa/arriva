import type { RequestHandler } from 'express';
import type { Env } from '../config/env';
import type { CircuitBreaker } from '../utils/circuitBreaker';
import type { PartnerConfigService } from '../services/partnerConfigService';
import { HTTP_HEADER } from '../constants';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type HealthDeps = {
  env: Env;
  startedAt: number;
  memberBreaker: CircuitBreaker;
  partnerBreaker: CircuitBreaker;
  partnerConfigService: PartnerConfigService;
};

const PROBE_TIMEOUT_MS = 2000;

type ProbeResult = {
  dependency: string;
  ok: boolean;
  response_time_ms: number;
  http_status?: number;
};

/**
 * Performs an HTTP probe suitable for dependency readiness (non-5xx responses treated as reachable).
 */
async function probeDependency(url: string, dependency: string): Promise<ProbeResult> {
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    const response_time_ms = Date.now() - started;
    const ok = res.status < 500;
    return { dependency, ok, response_time_ms, http_status: res.status };
  } catch {
    const response_time_ms = Date.now() - started;
    return { dependency, ok: false, response_time_ms };
  }
}

/**
 * Resolves application version from package.json for health payloads.
 */
export function readAppVersion(): string {
  try {
    const pkgPath = join(__dirname, '..', '..', 'package.json');
    const raw = readFileSync(pkgPath, 'utf8');
    const pkg = JSON.parse(raw) as { version?: string };
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Shallow health suitable for load balancers (always 200 when process is alive).
 */
export function createShallowHealthHandler(deps: Pick<HealthDeps, 'startedAt'>): RequestHandler {
  const version = readAppVersion();
  return (_req, res) => {
    res.setHeader(HTTP_HEADER.API_VERSION, '1.0');
    res.status(200).json({
      status: 'ok',
      version,
      uptime_ms: Date.now() - deps.startedAt,
    });
  };
}

/**
 * Deep health combining upstream probes, breaker telemetry, and cache statistics.
 */
export function createDeepHealthHandler(deps: HealthDeps): RequestHandler {
  const version = readAppVersion();
  return async (_req, res) => {
    res.setHeader(HTTP_HEADER.API_VERSION, '1.0');
    const memberUrl = new URL('/health', deps.env.MEMBER_SERVICE_URL).toString();
    const partnerUrl = new URL('/health', deps.env.PARTNER_CONFIG_URL).toString();

    const [memberProbe, partnerProbe] = await Promise.all([
      probeDependency(memberUrl, 'member_service'),
      probeDependency(partnerUrl, 'partner_config_service'),
    ]);

    const memberStats = deps.memberBreaker.getStats();
    const partnerStats = deps.partnerBreaker.getStats();
    const cache = deps.partnerConfigService.getCacheStats();

    const breakerHealthy = memberStats.state !== 'OPEN' && partnerStats.state !== 'OPEN';
    const upstreamHealthy = memberProbe.ok && partnerProbe.ok;
    const healthy = upstreamHealthy && breakerHealthy;

    const payload = {
      status: healthy ? 'ok' : 'unhealthy',
      version,
      checks: {
        dependencies: [memberProbe, partnerProbe],
        circuit_breakers: {
          member_service: memberStats,
          partner_config: partnerStats,
        },
        partner_config_cache: cache,
      },
    };

    res.status(healthy ? 200 : 503).json(payload);
  };
}
