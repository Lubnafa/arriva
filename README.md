# Arrivia Travel Recommendations MCP Server

**Author:** Lubna Fatima

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

> **Browser demo note:** The AI Concierge UI (`index.html`) calls the Anthropic API directly from the browser using a key the user pastes in. This is intentional for a local demo. For production, proxy the call through a `/v1/chat` route on this server so the Anthropic key is never exposed client-side.

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

## Document: Sections A–C

### Section A — Architecture & trade-offs

#### Architecture overview

Arrivia sits between partner MCP clients and two upstreams: a member profile service and a partner configuration service. Authenticated `POST /v1/mcp/invoke` requests are validated with Zod, scoped to the API key’s `partner_id`, and dispatched by tool name. For `get_member_recommendations`, the handler loads **member** and **partner rules** in parallel (`MemberService` and `PartnerConfigService`), each behind its own circuit breaker. A static catalog of candidate destinations is ranked in-process (`rankRecommendations`) using the member’s tier and travel history together with the partner’s `tier_multipliers`. **Commercial rules**—category exclusions and a recommendation cap—are applied afterward (`applyPartnerRules`), and the JSON response includes `applied_rules` so operators and partners can see what was enforced. The MCP layer does not embed business policy in the model; it orchestrates IO, ranking, and deterministic enforcement. Partner rules are fetched over HTTP from `PARTNER_CONFIG_URL`, optionally served from an in-process TTL cache keyed by `partner_id`, which reduces load and latency at the cost of freshness across replicas until a shared cache (for example Redis) is introduced.

#### Design trade-offs

1. **Heuristic ranking instead of an ML ranker at launch.** A deterministic score (tier multiplier, repeat-destination penalty, sorted catalog) ships quickly, avoids cold-start without engagement labels, and keeps outcomes explainable. The trade-off is a lower quality ceiling versus a trained reranker; the code keeps a clear seam (`rankRecommendations`, catalog injection) for a future model.

2. **In-process TTL cache for partner rules.** Caching cuts repeated HTTP calls to the partner config API and stabilizes latency under load. The trade-off is **staleness**: each App Runner or ECS task holds its own cache, so a partner change can take up to `PARTNER_CONFIG_CACHE_TTL_MS` to appear everywhere unless the cache is cleared or replaced with a shared store. That was accepted for early deployment simplicity with a documented migration path to Redis.

#### Handling partner configuration changes

If a partner **lowers** `max_recommendations` or **adds** a category to `exclude_categories`, the authoritative source is the partner config HTTP API: update the payload there first. This service will pick up new values on the next successful fetch after the entry expires from the TTL cache (or immediately on a cold miss). No application redeploy is required for pure data changes. If you need **instant** propagation, operators can restart tasks (clears in-memory state), reduce TTL temporarily, call any operational hook that clears `PartnerConfigService`’s cache, or implement the planned Redis-backed cache with explicit invalidation. If the **catalog** gains a new `category` string, confirm it matches the exclusion list semantics (comparison is case-insensitive on category). If exclusions should apply to new product types, ensure upstream rules and catalog metadata stay aligned; otherwise extend parsing or catalog typing and add tests.

---

### Section B — Production readiness & incident response

#### Incident runbook entry: cruises shown despite cruise exclusion

**Symptom:** A member reports the AI Concierge surfacing cruise recommendations while the partner’s configuration excludes cruises.

**Diagnose**

1. **Reproduce via API, not only the UI.** Call `get_member_recommendations` with the reported `member_id` and authenticated `partner_id`. Inspect `recommendations` and `applied_rules`. If `exclude_categories:cruise` (or similar) is present but cruises remain, suspect a **data bug** (candidate `category` not labeled `cruise`) or a code path bypassing enforcement. If the exclusion rule is **missing** from `applied_rules`, the filter did not run on excluded rows—check whether any rows are actually cruises.

2. **Confirm partner payload.** Call `get_partner_rules` for the same partner (or query the partner config service directly). Verify `exclude_categories` includes `cruise` and that the MCP server returned fresh rules.

3. **Check staleness and multi-replica behavior.** Compare timestamps across instances: an old in-process cache entry could still allow cruises until TTL expiry. Correlate `requestId` in logs with `partner_config_cache` hit/miss lines.

4. **UI vs server.** If the API response is clean but the UI shows cruises, the Concierge may be **hallucinating** or blending non-server context (see README note on browser demos). Confirm the client only renders destinations returned by this service.

**Confirm**

- Integration-style check: rules from upstream match enforced list; `applied_rules` matches expectations; catalog categories for shown `destination_id`s align with product type.

**Resolve**

- **Upstream wrong:** Fix partner config service data; wait for TTL or roll restart / cache clear for immediate effect.
- **Catalog mis-tagged:** Fix category on destinations and redeploy if catalog is versioned with the app.
- **Client issue:** Fix prompt/tool usage so the model does not invent inventory; proxy chat through the server in production.

Escalate to engineering if enforcement logic regresses (add a regression test locking `applyPartnerRules` behavior for that partner fixture).

#### Part B2 — Required reasoning question (human verification)

An AI coding assistant can sound authoritative when proposing “the” fix for partner-specific APIs—for example suggesting authorization checks only on `partner_id` in the body while ignoring that the authenticated principal must match, or recommending a cache header that would serve stale rules across tenants. A plausible wrong answer might be: “Return 403 if `exclude_categories` is empty,” conflating **missing** rules with **permissive** defaults, or “Strip categories in the ranker,” which duplicates policy in two layers and drifts.

**How I would catch that before acting:** I would trace the real request path in this repository (`createMcpRouter` → parallel fetch → `rankRecommendations` → `applyPartnerRules`), grep for all readers of `PartnerRules`, and read existing tests in `tests/` for partner variants. I would verify the assistant’s claim against **Zod schemas**, **error codes**, and **fixtures** (`partner_integration` cruise exclusion), and run `npm test`. If the suggestion contradicts ADRs or duplicates enforcement, I would reject it. I would also validate any security change against OWASP-style assumptions (cross-partner ID spoofing, cache poisoning). Only after the behavior matches the contract and tests pass would I merge.

---

### Section C — AI usage log (mandatory)

Three representative interactions from building and hardening this service:

| # | What I asked | What the AI gave | Kept / changed / rejected |
| --- | --- | --- | --- |
| 1 | Help structure an MCP `invoke` handler that loads member and partner data in parallel and applies exclusions after ranking. | A sequential layout and a single generic “rules” object. | **Changed** to `Promise.all` for member + partner fetches and a dedicated `applyPartnerRules` step so ordering stays obvious in logs and tests. |
| 2 | Suggest production middleware for an Express MCP API. | A long stack including options we did not need yet. | **Kept** ideas aligned with this repo (structured logging, rate limits, JSON body limits); **rejected** broad refactors not tied to the current threat model. |
| 3 | Draft README language for deployment on AWS App Runner. | Generic container steps. | **Kept** the ECR → App Runner flow and secrets guidance; **tightened** wording to match actual health routes (`/health`, `/health/deep`) and env vars from `loadEnv()`. |

This log is illustrative of how AI output is treated as **draft material** verified against code, tests, and existing decisions—not as a source of truth.

## Design decisions

- **Heuristics before ML:** Ships quickly, stays explainable (`applied_rules` tells partners why inventory shifted), and avoids cold-start problems until labeled data exists.
- **In-process caches:** Week-one simplicity with deterministic TTL eviction; Redis hooks are documented where code would change.
- **`applied_rules` in responses:** Makes audits and partner success reviews straightforward compared with opaque model outputs alone.
