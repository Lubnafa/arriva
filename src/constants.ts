/** HTTP route prefixes and paths (single source of truth). */
export const ROUTES = {
  HEALTH: '/health',
  HEALTH_DEEP: '/health/deep',
  MCP_V1_PREFIX: '/v1/mcp',
  MCP_TOOLS: '/v1/mcp/tools',
  MCP_INVOKE: '/v1/mcp/invoke',
} as const;

/** MCP tool names exposed by this server. */
export const TOOL_NAME = {
  GET_MEMBER_RECOMMENDATIONS: 'get_member_recommendations',
  GET_MEMBER_PROFILE: 'get_member_profile',
  GET_PARTNER_RULES: 'get_partner_rules',
} as const;

export type ToolName = (typeof TOOL_NAME)[keyof typeof TOOL_NAME];

/** Standard HTTP response header names. */
export const HTTP_HEADER = {
  API_VERSION: 'API-Version',
  REQUEST_ID: 'X-Request-ID',
  RATE_LIMIT_LIMIT: 'X-RateLimit-Limit',
  RATE_LIMIT_REMAINING: 'X-RateLimit-Remaining',
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
} as const;

/** JSON error contract codes (aligned with AppError subclasses). */
export const ERROR_CODE = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
} as const;

/** Service identifier embedded in every log line. */
export const SERVICE_NAME = 'arrivia-mcp';
