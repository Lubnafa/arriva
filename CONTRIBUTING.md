# Contributing

## Prerequisites

- Node 20 (see `.nvmrc`)
- Docker (for full-stack compose and smoke tests)

## Workflow

1. `npm ci` — install dependencies
2. `npm run typecheck` — compile-check without emitting
3. `npm run lint` — ESLint with TypeScript rules
4. `npm test` — Jest unit + integration suite with coverage
5. `npm run build` — compile to `dist/`
6. `./scripts/smoke-test.sh` — live end-to-end validation

All five must pass before a PR is merged. CI runs them in this order.

## Adding a new MCP tool

1. Add the tool name to `src/constants.ts` `TOOL_NAME`.
2. Add its Zod schema to `src/middleware/validate.ts` and extend `ParsedMcpInvoke`.
3. Add the handler branch in `src/mcp/invoke.ts`.
4. Add the tool definition to `src/mcp/tools.ts` `getToolManifest()`.
5. Add unit tests for schema validation and integration tests for the happy path and error cases.

## Architecture decisions

See `docs/decisions/` for ADRs.
