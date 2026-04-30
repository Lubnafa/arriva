import type { ErrorRequestHandler } from 'express';
import {
  AppError,
  RateLimitError,
  UnauthorizedError,
  UnsupportedMediaTypeError,
  ValidationError,
} from '../utils/errors';
import { ERROR_CODE, HTTP_HEADER } from '../constants';
import { getLogger } from '../utils/logger';
import type { Env } from '../config/env';

const API_VERSION_VALUE = '1.0';

/**
 * Central Express error handler returning structured JSON and safe logging.
 */
export function createErrorHandler(env: Env): ErrorRequestHandler {
  return (err, req, res, _next): void => {
    const requestId = req.requestId ?? 'unknown';
    res.setHeader(HTTP_HEADER.API_VERSION, API_VERSION_VALUE);

    if (err instanceof ValidationError) {
      getLogger().warn({ err: err.code, fieldCount: err.fields.length }, 'validation_failed');
      res.status(err.statusCode).json({
        error: ERROR_CODE.VALIDATION_ERROR,
        fields: err.fields,
        requestId,
      });
      return;
    }

    if (err instanceof UnauthorizedError) {
      getLogger().warn({ err: err.code }, 'unauthorized');
      res.status(401).json({
        error: ERROR_CODE.UNAUTHORIZED,
        requestId,
      });
      return;
    }

    if (err instanceof UnsupportedMediaTypeError) {
      getLogger().warn({ err: err.code }, 'unsupported_media_type');
      res.status(415).json({
        error: ERROR_CODE.UNSUPPORTED_MEDIA_TYPE,
        requestId,
      });
      return;
    }

    if (err instanceof RateLimitError) {
      getLogger().warn({ err: err.code, retryAfterMs: err.retryAfterMs }, 'rate_limit_exceeded');
      res.setHeader('Retry-After', String(Math.ceil(err.retryAfterMs / 1000)));
      res.status(err.statusCode).json({
        error: ERROR_CODE.RATE_LIMIT_EXCEEDED,
        retry_after_ms: err.retryAfterMs,
        requestId,
      });
      return;
    }

    if (err instanceof AppError && err.isOperational) {
      getLogger().warn({ err: err.code }, 'operational_error');
      res.status(err.statusCode).json({
        error: err.code,
        requestId,
      });
      return;
    }

    const stack = err instanceof Error ? err.stack : undefined;
    getLogger().error(
      {
        err: err instanceof Error ? err : undefined,
        stack: env.NODE_ENV !== 'production' ? stack : undefined,
      },
      'unhandled_error',
    );

    const body: { error: string; requestId: string; stack?: string } = {
      error: ERROR_CODE.INTERNAL_ERROR,
      requestId,
    };
    if (env.NODE_ENV !== 'production' && stack) {
      body.stack = stack;
    }
    res.status(500).json(body);
  };
}
