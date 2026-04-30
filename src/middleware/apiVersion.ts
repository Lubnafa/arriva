import type { RequestHandler } from 'express';
import { HTTP_HEADER } from '../constants';

const API_VERSION_VALUE = '1.0';

/**
 * Adds API-Version header for clients and proxies.
 */
export const apiVersionMiddleware: RequestHandler = (_req, res, next): void => {
  res.setHeader(HTTP_HEADER.API_VERSION, API_VERSION_VALUE);
  next();
};
