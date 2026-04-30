import request from 'supertest';
import { buildApp, type BuiltApplication } from '../../src/server';
import { hashApiKey } from '../../src/auth/apiKeyHash';
import { createTestEnv } from '../helpers/testEnv';
import { MEMBER_FIXTURE_ID, memberProfileFixture } from '../fixtures/members';
import {
  PARTNER_FIXTURE_ID,
  partnerRulesDefault,
  partnerRulesWithCap,
  partnerRulesWithCruiseExclusion,
} from '../fixtures/partners';
import { TOOL_NAME } from '../../src/constants';

type FetchInput = Parameters<typeof fetch>[0];

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('MCP HTTP integration', () => {
  const salt = 'test-salt-16chars-minimum-length-required!!';
  const rawKey = 'integration-test-partner-secret-key-value!!';
  const keyStore = new Map([[hashApiKey(salt, rawKey), PARTNER_FIXTURE_ID]]);

  const env = createTestEnv({
    API_KEY_SALT: salt,
    LOG_LEVEL: 'error',
  });

  let built!: BuiltApplication;

  let originalFetch: typeof fetch;

  beforeAll(() => {
    built = buildApp({ env, keyStore });
    originalFetch = global.fetch;
  });

  const authHeader = { Authorization: `Bearer ${rawKey}` };

  beforeEach(() => {
    built.partnerConfigService.clearCache();
    global.fetch = jest.fn(async (input: FetchInput) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes(`/members/${MEMBER_FIXTURE_ID}`)) {
        return jsonResponse(memberProfileFixture);
      }

      if (url.includes(`/partners/${PARTNER_FIXTURE_ID}/rules`)) {
        return jsonResponse(partnerRulesDefault);
      }

      if (url.endsWith('/health')) {
        return new Response(null, { status: 200 });
      }

      return new Response('not found', { status: 404 });
    }) as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(built.app).get('/v1/mcp/tools').expect(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('returns 401 when API key is invalid', async () => {
    const res = await request(built.app)
      .get('/v1/mcp/tools')
      .set({ Authorization: 'Bearer wrong-key' })
      .expect(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('returns 400 when member_id is not a UUID', async () => {
    const res = await request(built.app)
      .post('/v1/mcp/invoke')
      .set(authHeader)
      .send({
        tool_name: TOOL_NAME.GET_MEMBER_RECOMMENDATIONS,
        arguments: {
          member_id: 'not-a-uuid',
          partner_id: PARTNER_FIXTURE_ID,
        },
      })
      .expect(400);

    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.fields)).toBe(true);
    expect(res.body.fields.length).toBeGreaterThan(0);
  });

  it('returns recommendations for a valid invoke request', async () => {
    const res = await request(built.app)
      .post('/v1/mcp/invoke')
      .set(authHeader)
      .send({
        tool_name: TOOL_NAME.GET_MEMBER_RECOMMENDATIONS,
        arguments: {
          member_id: MEMBER_FIXTURE_ID,
          partner_id: PARTNER_FIXTURE_ID,
        },
      })
      .expect(200);

    expect(Array.isArray(res.body.recommendations)).toBe(true);
    expect(res.body.member_id).toBe(MEMBER_FIXTURE_ID);
    expect(res.body.partner_id).toBe(PARTNER_FIXTURE_ID);
    expect(Array.isArray(res.body.applied_rules)).toBe(true);
  });

  it('applies partner cruise exclusions end-to-end', async () => {
    global.fetch = jest.fn(async (input: FetchInput) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes(`/members/${MEMBER_FIXTURE_ID}`)) {
        return jsonResponse(memberProfileFixture);
      }
      if (url.includes(`/partners/${PARTNER_FIXTURE_ID}/rules`)) {
        return jsonResponse(partnerRulesWithCruiseExclusion);
      }
      if (url.endsWith('/health')) {
        return new Response(null, { status: 200 });
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;

    const res = await request(built.app)
      .post('/v1/mcp/invoke')
      .set(authHeader)
      .send({
        tool_name: TOOL_NAME.GET_MEMBER_RECOMMENDATIONS,
        arguments: {
          member_id: MEMBER_FIXTURE_ID,
          partner_id: PARTNER_FIXTURE_ID,
        },
      })
      .expect(200);

    expect(res.body.recommendations.every((r: { category: string }) => r.category.toLowerCase() !== 'cruise')).toBe(
      true,
    );
  });

  it('applies partner recommendation caps end-to-end', async () => {
    global.fetch = jest.fn(async (input: FetchInput) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes(`/members/${MEMBER_FIXTURE_ID}`)) {
        return jsonResponse(memberProfileFixture);
      }
      if (url.includes(`/partners/${PARTNER_FIXTURE_ID}/rules`)) {
        return jsonResponse(partnerRulesWithCap);
      }
      if (url.endsWith('/health')) {
        return new Response(null, { status: 200 });
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;

    const res = await request(built.app)
      .post('/v1/mcp/invoke')
      .set(authHeader)
      .send({
        tool_name: TOOL_NAME.GET_MEMBER_RECOMMENDATIONS,
        arguments: {
          member_id: MEMBER_FIXTURE_ID,
          partner_id: PARTNER_FIXTURE_ID,
        },
      })
      .expect(200);

    expect(res.body.recommendations).toHaveLength(partnerRulesWithCap.max_recommendations);
  });

  it('returns 400 when tool_name is not a known MCP tool', async () => {
    const res = await request(built.app)
      .post('/v1/mcp/invoke')
      .set(authHeader)
      .send({
        tool_name: 'unknown_tool_name',
        arguments: {},
      })
      .expect(400);

    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('returns 415 when invoke POST is not application/json', async () => {
    const res = await request(built.app)
      .post('/v1/mcp/invoke')
      .set(authHeader)
      .set('Content-Type', 'text/plain')
      .send('{}')
      .expect(415);

    expect(res.body.error).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('returns JSON 404 for unknown routes', async () => {
    const res = await request(built.app).get('/no-such-route').expect(404);
    expect(res.body.error).toBe('NOT_FOUND');
    expect(res.body.requestId).toBeDefined();
  });
});

describe('rate limiting integration', () => {
  const salt = 'test-salt-16chars-minimum-length-required!!';
  const rawKey = 'integration-rate-limit-secret-key-value!!!';
  const keyStore = new Map([[hashApiKey(salt, rawKey), PARTNER_FIXTURE_ID]]);

  const env = createTestEnv({
    API_KEY_SALT: salt,
    RATE_LIMIT_MAX_REQUESTS: 2,
    RATE_LIMIT_WINDOW_MS: 60_000,
    LOG_LEVEL: 'error',
  });

  const { app: rateLimitedApp } = buildApp({ env, keyStore });

  beforeEach(() => {
    global.fetch = jest.fn(async () => new Response(null, { status: 200 })) as typeof fetch;
  });

  it('returns 429 when the sliding window is saturated', async () => {
    const auth = { Authorization: `Bearer ${rawKey}` };

    await request(rateLimitedApp).get('/v1/mcp/tools').set(auth).expect(200);
    await request(rateLimitedApp).get('/v1/mcp/tools').set(auth).expect(200);

    const res = await request(rateLimitedApp).get('/v1/mcp/tools').set(auth).expect(429);
    expect(res.body.error).toBe('RATE_LIMIT_EXCEEDED');
    expect(typeof res.body.retry_after_ms).toBe('number');
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
  });
});
