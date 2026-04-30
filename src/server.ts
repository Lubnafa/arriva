import 'dotenv/config';

import path from 'node:path';

import express, { type Express, Router } from 'express';
import { loadEnv, type Env } from './config/env';
import { ERROR_CODE, HTTP_HEADER, ROUTES } from './constants';
import { initLogger, getLogger } from './utils/logger';
import { createApiKeyAuth } from './auth/apiKeyAuth';
import { SlidingWindowRateLimiter, createRateLimiterMiddleware } from './auth/rateLimiter';
import { createDefaultKeyStore, type KeyStore } from './auth/keyStore';
import { requestIdMiddleware } from './middleware/requestId';
import {
  cacheControlNoStoreMiddleware,
  conciergeContentSecurityPolicyMiddleware,
  createHelmetMiddleware,
} from './middleware/httpSecurity';
import { requireJsonContentTypeForMcpInvoke } from './middleware/requireJsonContentType';
import { apiVersionMiddleware } from './middleware/apiVersion';
import { createDefaultRateLimitHeadersMiddleware } from './middleware/defaultRateLimitHeaders';
import { createErrorHandler } from './middleware/errorHandler';
import { CircuitBreaker } from './utils/circuitBreaker';
import { MemberService } from './services/memberService';
import { PartnerConfigService } from './services/partnerConfigService';
import { createMcpRouter } from './mcp/invoke';
import { createMcpCorsMiddleware } from './middleware/mcpCors';
import { createShallowHealthHandler, createDeepHealthHandler, readAppVersion } from './health/health';
import type { Server } from 'node:http';

export type BuildAppOptions = {
  env: Env;
  keyStore?: KeyStore;
  startedAt?: number;
};

export type BuiltApplication = {
  app: Express;
  partnerConfigService: PartnerConfigService;
};

/**
 * Constructs the fully wired Express application (used by tests and production bootstrap).
 */
export function buildApp(options: BuildAppOptions): BuiltApplication {
  const env = options.env;
  const startedAt = options.startedAt ?? Date.now();
  const version = readAppVersion();
  initLogger(env, version);

  const keyStore = options.keyStore ?? createDefaultKeyStore();

  const memberBreaker = new CircuitBreaker({
    name: 'member_service',
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
  });

  const partnerBreaker = new CircuitBreaker({
    name: 'partner_config_service',
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
  });

  const memberService = new MemberService(env, memberBreaker);
  const partnerConfigService = new PartnerConfigService(env, partnerBreaker);

  const rateLimiter = new SlidingWindowRateLimiter(env.RATE_LIMIT_WINDOW_MS, env.RATE_LIMIT_MAX_REQUESTS);
  const apiKeyAuth = createApiKeyAuth({ salt: env.API_KEY_SALT, keyStore });
  const rateLimiterMiddleware = createRateLimiterMiddleware(rateLimiter);

  const app = express();
  app.disable('x-powered-by');

  if (env.TRUST_PROXY_HOPS > 0) {
    app.set('trust proxy', env.TRUST_PROXY_HOPS);
  }

  app.use(createHelmetMiddleware(env));
  app.use(cacheControlNoStoreMiddleware);
  app.use(requireJsonContentTypeForMcpInvoke);
  app.use(express.json({ limit: env.JSON_BODY_LIMIT, strict: true }));
  app.use(requestIdMiddleware);
  app.use(apiVersionMiddleware);
  app.use(createDefaultRateLimitHeadersMiddleware(env));

  const conciergeHtmlPath = path.join(process.cwd(), 'index.html');
  app.get(['/', '/concierge'], conciergeContentSecurityPolicyMiddleware, (_req, res, next): void => {
    res.sendFile(conciergeHtmlPath, (err): void => {
      if (err) next();
    });
  });

  app.get(ROUTES.HEALTH, createShallowHealthHandler({ startedAt }));

  const healthDeps = {
    env,
    startedAt,
    memberBreaker,
    partnerBreaker,
    partnerConfigService,
  };

  app.get(ROUTES.HEALTH_DEEP, apiKeyAuth, rateLimiterMiddleware, createDeepHealthHandler(healthDeps));

  const mcpRouter = Router();
  mcpRouter.use(createMcpCorsMiddleware(env));
  mcpRouter.use(apiKeyAuth);
  mcpRouter.use(rateLimiterMiddleware);
  mcpRouter.use(createMcpRouter({ memberService, partnerConfigService }));

  app.use(ROUTES.MCP_V1_PREFIX, mcpRouter);

  app.use((req, res): void => {
    res.setHeader(HTTP_HEADER.API_VERSION, '1.0');
    res.status(404).json({
      error: ERROR_CODE.NOT_FOUND,
      requestId: req.requestId ?? 'unknown',
    });
  });

  app.use(createErrorHandler(env));

  return { app, partnerConfigService };
}

const SHUTDOWN_GRACE_MS = 10000;

/**
 * Loads configuration, listens on PORT, and registers graceful shutdown handlers.
 */
export function startServer(): Server {
  const env = ((): Env => {
    try {
      return loadEnv();
    } catch (err) {
      process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
      throw new Error('unreachable');
    }
  })();

  const { app } = buildApp({ env });
  const server = app.listen(env.PORT, () => {
    getLogger().info({ port: env.PORT }, 'server_listening');
  });

  const shutdown = (): void => {
    getLogger().info('shutdown_started');
    server.close(() => {
      getLogger().info('shutdown_complete');
      process.exit(0);
    });
    setTimeout(() => {
      getLogger().error('shutdown_timeout_forcing_exit');
      process.exit(1);
    }, SHUTDOWN_GRACE_MS).unref();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return server;
}

if (require.main === module) {
  startServer();
}
