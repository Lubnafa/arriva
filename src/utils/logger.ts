import { AsyncLocalStorage } from 'node:async_hooks';
import pino from 'pino';
import type { Env } from '../config/env';
import { SERVICE_NAME } from '../constants';

type RequestContext = {
  requestId: string;
};

/** Async context for automatic requestId injection into log lines. */
export const requestContextStore = new AsyncLocalStorage<RequestContext>();

let rootLogger: pino.Logger | undefined;

const REDACT_PATHS: string[] = [
  'authorization',
  'req.headers.authorization',
  'password',
  'token',
  'apiKey',
  'api_key',
  'creditCard',
  'ssn',
];

/**
 * Initializes the root JSON logger (call once at process startup).
 */
export function initLogger(env: Env, appVersion: string): pino.Logger {
  rootLogger = pino({
    level: env.LOG_LEVEL,
    base: {
      service: SERVICE_NAME,
      version: appVersion,
      env: env.NODE_ENV,
    },
    redact: {
      paths: REDACT_PATHS,
      censor: '[Redacted]',
    },
    formatters: {
      level(label: string): { level: string } {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
  return rootLogger;
}

/**
 * Returns a logger for the current async context (includes requestId when set).
 */
export function getLogger(): pino.Logger {
  if (!rootLogger) {
    throw new Error('Logger not initialized; call initLogger first');
  }
  const ctx = requestContextStore.getStore();
  if (ctx?.requestId) {
    return rootLogger.child({ requestId: ctx.requestId });
  }
  return rootLogger;
}
