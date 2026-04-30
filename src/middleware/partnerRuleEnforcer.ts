import type { PartnerRules } from '../services/partnerConfigService';
import type { RankedRecommendation } from '../services/recommendationEngine';

export type EnforcementResult = {
  recommendations: RankedRecommendation[];
  applied_rules: string[];
};

/**
 * Applies partner business rules (category exclusions and caps) to ranked recommendations.
 */
export function applyPartnerRules(
  ranked: readonly RankedRecommendation[],
  rules: PartnerRules,
): EnforcementResult {
  const applied: string[] = [];
  let working = [...ranked];

  const exclude = new Set((rules.exclude_categories ?? []).map((c) => c.toLowerCase()));
  if (exclude.size > 0) {
    const before = working.length;
    working = working.filter((r) => !exclude.has(r.category.toLowerCase()));
    if (working.length !== before) {
      applied.push(`exclude_categories:${[...exclude].sort().join(',')}`);
    }
  }

  const cap = rules.max_recommendations;
  if (typeof cap === 'number' && cap >= 0 && working.length > cap) {
    working = working.slice(0, cap);
    applied.push(`cap:${String(cap)}`);
  }

  return { recommendations: working, applied_rules: applied };
}
