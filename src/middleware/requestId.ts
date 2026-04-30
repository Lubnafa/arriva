import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { HTTP_HEADER } from '../constants';
import { requestContextStore } from '../utils/logger';

/**
 * Ensures every request has a request id (header or new UUID) and ALS context for logging.
 */
export const requestIdMiddleware: RequestHandler = (req, res, next): void => {
  const incoming = req.header(HTTP_HEADER.REQUEST_ID);
  const requestId = incoming && incoming.trim().length > 0 ? incoming.trim() : randomUUID();
  req.requestId = requestId;
  res.setHeader(HTTP_HEADER.REQUEST_ID, requestId);
  requestContextStore.enterWith({ requestId });
  next();
};
