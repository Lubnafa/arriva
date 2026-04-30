# Arrivia Travel Recommendations MCP Server

This service exposes versioned HTTP endpoints that behave like a lightweight MCP tool host for travel recommendations: partners authenticate with scoped API keys, validated inputs flow through heuristic ranking plus partner commercial rules, and structured logs make operations observable.

The runtime is intentionally small (Express + Zod + Pino) so it deploys cleanly on AWS App Runner or ECS while leaving clear seams for Redis caches, external catalogs, and ML rankers later.

## Architecture

```
┌──────────────┐   Bearer API Key    ┌─────────────────────┐
│ Partner MCP  │ ──────────────────► │  Express /v1/mcp/*   │
│ Client       │                     │  ├─ Auth + RateLimit │
└──────────────┘                     │  ├─ Zod validation   │
                                     │  └─ Tool router      │
                                             │
                       ┌─────────────────────┼─────────────────────┐
                       ▼                     ▼                     ▼
               ┌───────────────┐    ┌────────────────┐   ┌──────────────────┐
               │ Member HTTP   │    │ Partner rules │   │ Heuristic ranker │
               │ + breaker     │    │ cache + CB    │   │ + rule enforcer  │
               └───────────────┘    └────────────────┘   └──────────────────┘
```

## Quick start

```bash
npm install
cp .env.example .env   # populate URLs, salt, and log level
npm run dev
```

The server listens on `PORT` (default `3000`). Hit `GET http://localhost:3000/health` for a shallow probe.

## Environment variables

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| `PORT` | No | `3000` | HTTP listen port |
| `NODE_ENV` | Yes | — | `development`, `staging`, or `production` |
| `API_KEY_SALT` | Yes | — | Secret salt prepended to SHA-256 hashing for stored keys (≥16 chars) |
| `MEMBER_SERVICE_URL` | Yes | — | Base URL for upstream member profiles |
| `MEMBER_SERVICE_TIMEOUT` | No | `3000` | Member HTTP timeout (ms) |
| `PARTNER_CONFIG_URL` | Yes | — | Base URL for partner rule payloads |
| `PARTNER_CONFIG_TIMEOUT` | No | `2000` | Partner rule HTTP timeout (ms) |
| `PARTNER_CONFIG_CACHE_TTL_MS` | No | `300000` | In-process partner rule cache TTL |
| `LOG_LEVEL` | Yes | — | `debug`, `info`, `warn`, or `error` |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Sliding window duration per partner |
| `RATE_LIMIT_MAX_REQUESTS` | No | `100` | Max hits allowed per partner per window |

Invalid combinations cause `loadEnv()` to throw during bootstrap so the process never listens with bad configuration.

## MCP tools reference

All tools require `Authorization: Bearer <api_key>` on `POST /v1/mcp/invoke`. Optional correlation via `X-Request-ID`.

### `get_member_recommendations`

**Description:** Loads the member profile and partner rules in parallel, ranks the static catalog with tier multipliers and repeat-destination penalties, then applies exclusions (for example cruise) and recommendation caps.

**Input:**

```json
{
  "tool_name": "get_member_recommendations",
  "arguments": {
    "member_id": "11111111-1111-4111-8111-111111111111",
    "partner_id": "partner_integration",
    "session_id": "22222222-2222-4222-8222-222222222222"
  }
}
```

**Output:**

```json
{
  "member_id": "11111111-1111-4111-8111-111111111111",
  "partner_id": "partner_integration",
  "recommendations": [
    {
      "destination_id": "dest_alaska",
      "destination_name": "Alaska Cruise",
      "category": "cruise",
      "base_score": 0.95,
      "score": 0.95
    }
  ],
  "applied_rules": ["exclude_categories:cruise", "cap:2"]
}
```

### `get_member_profile`

**Description:** Proxies the member service through the circuit breaker.

**Input:**

```json
{
  "tool_name": "get_member_profile",
  "arguments": {
    "member_id": "11111111-1111-4111-8111-111111111111"
  }
}
```

**Output:**

```json
{
  "profile": {
    "member_id": "11111111-1111-4111-8111-111111111111",
    "tier": "gold",
    "past_destinations": ["dest_paris"]
  }
}
```

### `get_partner_rules`

**Description:** Returns cached partner commercial metadata used during recommendation enforcement.

**Input:**

```json
{
  "tool_name": "get_partner_rules",
  "arguments": {
    "partner_id": "partner_integration"
  }
}
```

**Output:**

```json
{
  "rules": {
    "partner_id": "partner_integration",
    "exclude_categories": ["cruise"],
    "max_recommendations": 2,
    "tier_multipliers": { "gold": 1.25 }
  }
}
```

`GET /v1/mcp/tools` returns the JSON manifest describing these schemas.

## Authentication guide

1. Ensure `API_KEY_SALT` is set to a long random string shared across all instances.
2. Run `npm run generate-api-key -- <partner_id>` with the same salt exported in the environment.
3. Record only the printed hash server-side (`auth/keyStore.ts` Map today; DynamoDB/RDS later).
4. Distribute the raw key to the partner through a secure channel; never log it.
5. Send `Authorization: Bearer <raw_key>` on `/v1/mcp/*` and `/health/deep`.

Missing or incorrect keys intentionally return the same `401 {"error":"UNAUTHORIZED"}` payload.

## Seeded test data

Shared fixtures (see `tests/fixtures`) keep unit and integration suites aligned:

| Kind | Key | Notes |
| --- | --- | --- |
| Member | `11111111-1111-4111-8111-111111111111` | Gold tier, prior Paris trip (`dest_paris`) |
| Partner | `partner_integration` | Baseline, cruise exclusion, and cap variants |
| Destinations | `dest_paris`, `dest_alaska`, `dest_tokyo`, `dest_cabo` | Mixed categories for exclusion/cap assertions |

## Running tests

```bash
npm test
```

Unit suites cover enforcement, ranking math, caches, and circuit breakers. Integration tests exercise auth, validation, rate limiting, partner rule effects, and unknown tools using mocked upstream HTTP via `fetch`.

## Deployment

### Docker

```bash
docker build -t arrivia-travel-recommendations:latest .
docker run --rm -p 3000:3000 --env-file .env arrivia-travel-recommendations:latest
```

The image runs as UID `1001`, copies only production dependencies plus `dist/`, honors `STOPSIGNAL SIGTERM`, and ships a `HEALTHCHECK` against `/health`.

### AWS App Runner

1. Push the image to Amazon ECR.
2. Create an App Runner service from the container registry with port `3000`.
3. Provide environment variables from this README (use Secrets Manager for `API_KEY_SALT`).
4. Configure health checks to hit `/health` for autoscaling and `/health/deep` (authenticated) from synthetic monitors.
5. Attach an IAM role allowing egress to internal member/partner URLs inside your VPC connector.

For ECS Fargate the same container applies—place secrets in AWS Secrets Manager and inject them as environment variables at task launch.

## Four-week delivery outlook

| Week | Ships | Next steps |
| --- | --- | --- |
| 1 | API-key MCP host, validation, rate limits, heuristic ranking, Docker image | Harden partner config source + observability dashboards |
| 2 | Redis-backed rate limiting + partner cache | Canary deployments + synthetic `/health/deep` monitors |
| 3 | External recommendation catalog service integration | Feature flags for category rollouts |
| 4 | Automated key rotation runbooks + chaos drills | Explore ML reranking once data contracts stabilize |

## On-call runbook

| Failure mode | Trigger | Likely cause | Action |
| --- | --- | --- | --- |
| Elevated `401` | Partner alerts | Wrong/expired key | Verify hash in key store, regenerate key pair |
| Surge of `429` | Monitoring | Hot partner or abusive traffic | Confirm limits, temporarily raise `RATE_LIMIT_MAX_REQUESTS`, plan Redis migration |
| `502 UPSTREAM_ERROR` spikes | Pager | Member/partner API degraded | Check upstream dashboards, circuit breaker logs, fail over traffic |
| `503 SERVICE_UNAVAILABLE` | `/health/deep` red | Circuit open | Inspect upstream latency; reset breakers after dependency heals |
| Blank recommendations | Support tickets | Strict exclusions/caps | Validate partner rules JSON, inspect `applied_rules` field in responses |
| Slow deploys | Release engineer | Draining connections | Confirm SIGTERM handling; increase grace window if workloads exceed 10s |

## Design decisions

- **Heuristics before ML:** Ships quickly, stays explainable (`applied_rules` tells partners why inventory shifted), and avoids cold-start problems until labeled data exists.
- **In-process caches:** Week-one simplicity with deterministic TTL eviction; Redis hooks are documented where code would change.
- **`applied_rules` in responses:** Makes audits and partner success reviews straightforward compared with opaque model outputs alone.
