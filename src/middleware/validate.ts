import { z, type ZodError } from 'zod';
import type { RequestHandler } from 'express';
import { ValidationError } from '../utils/errors';
import { TOOL_NAME } from '../constants';

const uuidSchema = z.string().uuid();

export const getMemberRecommendationsSchema = z.object({
  member_id: uuidSchema,
  partner_id: z.string().min(1).max(100),
  session_id: uuidSchema.optional(),
});

export const getMemberProfileSchema = z.object({
  member_id: uuidSchema,
});

export const getPartnerRulesSchema = z.object({
  partner_id: z.string().min(1).max(100),
});

const mcpToolNameSchema = z.enum([
  TOOL_NAME.GET_MEMBER_RECOMMENDATIONS,
  TOOL_NAME.GET_MEMBER_PROFILE,
  TOOL_NAME.GET_PARTNER_RULES,
]);

export const mcpEnvelopeSchema = z.object({
  tool_name: mcpToolNameSchema,
  arguments: z.record(z.unknown()).default({}),
});

export type ParsedMcpInvoke =
  | {
      tool_name: typeof TOOL_NAME.GET_MEMBER_RECOMMENDATIONS;
      arguments: z.infer<typeof getMemberRecommendationsSchema>;
    }
  | {
      tool_name: typeof TOOL_NAME.GET_MEMBER_PROFILE;
      arguments: z.infer<typeof getMemberProfileSchema>;
    }
  | {
      tool_name: typeof TOOL_NAME.GET_PARTNER_RULES;
      arguments: z.infer<typeof getPartnerRulesSchema>;
    };

/**
 * Converts Zod issues into the public validation error contract.
 */
export function mapZodError(err: ZodError): ValidationError {
  const fields = err.errors.map((e) => ({
    field: e.path.length > 0 ? e.path.join('.') : 'root',
    message: e.message,
  }));
  return new ValidationError(fields);
}

/**
 * Validates MCP POST /invoke payloads (per-tool arguments are schema-checked).
 */
export function parseAndValidateMcpInvoke(body: unknown): ParsedMcpInvoke {
  const envelope = mcpEnvelopeSchema.safeParse(body);
  if (!envelope.success) {
    throw mapZodError(envelope.error);
  }
  const { tool_name, arguments: args } = envelope.data;

  switch (tool_name) {
    case TOOL_NAME.GET_MEMBER_RECOMMENDATIONS: {
      const parsed = getMemberRecommendationsSchema.safeParse(args);
      if (!parsed.success) {
        throw mapZodError(parsed.error);
      }
      return { tool_name, arguments: parsed.data };
    }
    case TOOL_NAME.GET_MEMBER_PROFILE: {
      const parsed = getMemberProfileSchema.safeParse(args);
      if (!parsed.success) {
        throw mapZodError(parsed.error);
      }
      return { tool_name, arguments: parsed.data };
    }
    case TOOL_NAME.GET_PARTNER_RULES: {
      const parsed = getPartnerRulesSchema.safeParse(args);
      if (!parsed.success) {
        throw mapZodError(parsed.error);
      }
      return { tool_name, arguments: parsed.data };
    }
    default: {
      const _exhaustive: never = tool_name;
      return _exhaustive;
    }
  }
}

/**
 * Express middleware wiring parseAndValidateMcpInvoke to req.body.
 */
export const validateMcpInvokeBody: RequestHandler = (req, _res, next): void => {
  try {
    req.body = parseAndValidateMcpInvoke(req.body);
    next();
  } catch (err) {
    next(err);
  }
};
