# ADR 002 — In-process TTL cache for partner rules

**Status:** Accepted (superseded in week 2 by Redis)  
**Date:** 2025-Q2

## Context

Partner rule payloads change infrequently (O(hours)). Fetching on every request adds ~2–5ms latency and load on the partner config service.

## Decision

Use an in-process `TTLCache` (5-min TTL, 500-entry LRU eviction). Every callsite is annotated with the Redis ZSET migration path.

## Consequences

- Zero infrastructure dependency for week-1 deploy.
- Cache is not shared across App Runner / ECS replicas — each instance warms independently. Acceptable at low replica counts.
- Redis migration is isolated to `PartnerConfigService` and the rate limiter.
