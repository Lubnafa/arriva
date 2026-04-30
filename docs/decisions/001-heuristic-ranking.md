# ADR 001 — Heuristic ranking before ML

**Status:** Accepted  
**Date:** 2025-Q2

## Context

We need to return ranked travel recommendations. ML rerankers require labeled engagement data (clicks, bookings) that does not yet exist at launch.

## Decision

Ship a deterministic heuristic ranker: tier multiplier × base score minus repeat-destination penalty. Results are sorted descending.

## Consequences

- Immediately explainable via `applied_rules` in every response.
- No cold-start problem.
- `CatalogService` interface and `rankRecommendations` function signature are stable seams for a future ML model.
- Accuracy ceiling is lower than a trained model until data exists.
