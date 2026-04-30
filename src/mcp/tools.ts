import { TOOL_NAME } from '../constants';

export type McpToolDefinition = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

/**
 * JSON manifest returned by GET /v1/mcp/tools.
 */
export function getToolManifest(): { tools: McpToolDefinition[] } {
  return {
    tools: [
      {
        name: TOOL_NAME.GET_MEMBER_RECOMMENDATIONS,
        description: 'Returns ranked travel recommendations for a member applying partner rules.',
        input_schema: {
          type: 'object',
          required: ['member_id', 'partner_id'],
          properties: {
            member_id: { type: 'string', format: 'uuid' },
            partner_id: { type: 'string', minLength: 1, maxLength: 100 },
            session_id: { type: 'string', format: 'uuid' },
          },
        },
      },
      {
        name: TOOL_NAME.GET_MEMBER_PROFILE,
        description: 'Fetches member tier and travel history used by ranking heuristics.',
        input_schema: {
          type: 'object',
          required: ['member_id'],
          properties: {
            member_id: { type: 'string', format: 'uuid' },
          },
        },
      },
      {
        name: TOOL_NAME.GET_PARTNER_RULES,
        description: 'Returns commercial rules (caps, exclusions, tier multipliers) for a partner.',
        input_schema: {
          type: 'object',
          required: ['partner_id'],
          properties: {
            partner_id: { type: 'string', minLength: 1, maxLength: 100 },
          },
        },
      },
    ],
  };
}
