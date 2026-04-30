import type { RequestHandler } from 'express';

/**
 * Permissive CORS for the MCP HTTP façade so browser-based demos can call /v1/mcp/*.
 * OPTIONS is answered before authentication so preflight succeeds.
 */
export function createMcpCorsMiddleware(): RequestHandler {
  return (req, res, next): void => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, API-Version');
    res.setHeader('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  };
}
