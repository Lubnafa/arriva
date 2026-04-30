import type { RequestHandler } from 'express';
import { ROUTES } from '../constants';
import { UnsupportedMediaTypeError } from '../utils/errors';

const JSON_TYPE = 'application/json';

function isMcpInvokePost(req: { method: string; originalUrl: string }): boolean {
  return req.method === 'POST' && req.originalUrl.split('?')[0] === `${ROUTES.MCP_V1_PREFIX}/invoke`;
}

/**
 * Ensures MCP invoke posts declare JSON so the body parser and validators see the intended type.
 */
export const requireJsonContentTypeForMcpInvoke: RequestHandler = (req, _res, next): void => {
  try {
    if (!isMcpInvokePost(req)) {
      next();
      return;
    }
    const raw = req.headers['content-type'];
    if (typeof raw !== 'string') {
      throw new UnsupportedMediaTypeError();
    }
    const base = raw.split(';')[0]?.trim().toLowerCase() ?? '';
    if (base !== JSON_TYPE) {
      throw new UnsupportedMediaTypeError();
    }
    next();
  } catch (err) {
    next(err);
  }
};
