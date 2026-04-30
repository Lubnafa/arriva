import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { HTTP_HEADER } from '../constants';
import { requestContextStore } from '../utils/logger';

const REQUEST_ID_MAX_LEN = 128;
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

function isSafeRequestId(value: string): boolean {
  return value.length > 0 && value.length <= REQUEST_ID_MAX_LEN && REQUEST_ID_PATTERN.test(value);
}

/**
 * Ensures every request has a request id (header or new UUID) and ALS context for logging.
 * Incoming `X-Request-ID` values are restricted to printable safe tokens to reduce log/header abuse.
 */
export const requestIdMiddleware: RequestHandler = (req, res, next): void => {
  const incoming = req.header(HTTP_HEADER.REQUEST_ID)?.trim();
  const requestId = incoming && isSafeRequestId(incoming) ? incoming : randomUUID();
  req.requestId = requestId;
  res.setHeader(HTTP_HEADER.REQUEST_ID, requestId);
  requestContextStore.enterWith({ requestId });
  next();
};
