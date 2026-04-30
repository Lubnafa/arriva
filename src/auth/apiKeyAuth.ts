/**
 * TODO: For enterprise SSO, swap Bearer API keys for JWT validation (JWKS) or OAuth2 client-credentials
 * without sharing static secrets across partners.
 */
import type { RequestHandler } from 'express';
import { UnauthorizedError } from '../utils/errors';
import { HTTP_HEADER } from '../constants';
import { hashApiKey } from './apiKeyHash';
import type { KeyStore } from './keyStore';

const BEARER_PREFIX = 'Bearer ';

/**
 * Express middleware requiring `Authorization: Bearer <api_key>` and resolving partner_id.
 */
export function createApiKeyAuth(options: { salt: string; keyStore: KeyStore }): RequestHandler {
  const { salt, keyStore } = options;

  return (req, _res, next): void => {
    try {
      const header = req.header(HTTP_HEADER.AUTHORIZATION);
      if (!header || !header.startsWith(BEARER_PREFIX)) {
        throw new UnauthorizedError();
      }
      const rawKey = header.slice(BEARER_PREFIX.length).trim();
      if (!rawKey) {
        throw new UnauthorizedError();
      }
      const digest = hashApiKey(salt, rawKey);
      const partnerId = keyStore.get(digest);
      if (!partnerId) {
        throw new UnauthorizedError();
      }
      req.partnerId = partnerId;
      next();
    } catch (err) {
      next(err);
    }
  };
}
