/**
 * TODO: Webhook notifications and streaming MCP completions can hook into this router once protocol requirements land.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { TOOL_NAME } from '../constants';
import { ValidationError } from '../utils/errors';
import { getLogger } from '../utils/logger';
import type { MemberService } from '../services/memberService';
import type { PartnerConfigService } from '../services/partnerConfigService';
import { rankRecommendations } from '../services/recommendationEngine';
import { applyPartnerRules } from '../middleware/partnerRuleEnforcer';
import { validateMcpInvokeBody, type ParsedMcpInvoke } from '../middleware/validate';
import { getDefaultCandidates } from '../data/defaultRecommendations';
import { getToolManifest } from './tools';

export type McpRouterDeps = {
  memberService: MemberService;
  partnerConfigService: PartnerConfigService;
};

/**
 * Async route helper forwarding rejections to Express error middleware.
 */
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
}

/**
 * Builds the MCP invoke router (POST body validation + tool dispatch).
 */
export function createMcpRouter(deps: McpRouterDeps): Router {
  const router = Router();

  router.get('/tools', (_req, res) => {
    getLogger().debug('mcp_tools_manifest');
    res.json(getToolManifest());
  });

  router.post(
    '/invoke',
    validateMcpInvokeBody,
    asyncHandler(async (req, res) => {
      const body = req.body as ParsedMcpInvoke;
      const partnerId = req.partnerId;
      if (!partnerId) {
        throw new ValidationError([{ field: 'authorization', message: 'Partner context missing' }]);
      }

      if (body.tool_name === TOOL_NAME.GET_MEMBER_RECOMMENDATIONS) {
        if (body.arguments.partner_id !== partnerId) {
          throw new ValidationError([
            { field: 'arguments.partner_id', message: 'partner_id must match authenticated partner' },
          ]);
        }
        const { member_id } = body.arguments;
        getLogger().info({ tool: body.tool_name, member_id }, 'mcp_tool_invoked');

        const [member, rules] = await Promise.all([
          deps.memberService.getMemberProfile(member_id),
          deps.partnerConfigService.getPartnerRules(partnerId),
        ]);

        const ranked = rankRecommendations(member, getDefaultCandidates(), rules);
        const enforced = applyPartnerRules(ranked, rules);

        getLogger().info({ member_id, partner_id: partnerId, count: enforced.recommendations.length }, 'recommendations_generated');

        res.json({
          member_id,
          partner_id: partnerId,
          recommendations: enforced.recommendations,
          applied_rules: enforced.applied_rules,
        });
        return;
      }

      if (body.tool_name === TOOL_NAME.GET_MEMBER_PROFILE) {
        const { member_id } = body.arguments;
        getLogger().info({ tool: body.tool_name, member_id }, 'mcp_tool_invoked');
        const profile = await deps.memberService.getMemberProfile(member_id);
        res.json({ profile });
        return;
      }

      if (body.tool_name === TOOL_NAME.GET_PARTNER_RULES) {
        if (body.arguments.partner_id !== partnerId) {
          throw new ValidationError([
            { field: 'arguments.partner_id', message: 'partner_id must match authenticated partner' },
          ]);
        }
        getLogger().info({ tool: body.tool_name, partnerId }, 'mcp_tool_invoked');
        const rules = await deps.partnerConfigService.getPartnerRules(partnerId);
        res.json({ rules });
        return;
      }

      body satisfies never;
    }),
  );

  return router;
}
