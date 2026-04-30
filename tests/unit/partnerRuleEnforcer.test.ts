import { applyPartnerRules } from '../../src/middleware/partnerRuleEnforcer';
import {
  partnerRulesDefault,
  partnerRulesWithCap,
  partnerRulesWithCruiseExclusion,
} from '../fixtures/partners';
import { rankedFixture } from '../fixtures/recommendations';

describe('applyPartnerRules', () => {
  it('returns unchanged recommendations when no rules apply', () => {
    const result = applyPartnerRules(rankedFixture, partnerRulesDefault);
    expect(result.applied_rules).toEqual([]);
    expect(result.recommendations).toHaveLength(rankedFixture.length);
  });

  it('removes excluded categories and records the applied rule', () => {
    const result = applyPartnerRules(rankedFixture, partnerRulesWithCruiseExclusion);
    expect(result.recommendations.every((r) => r.category.toLowerCase() !== 'cruise')).toBe(true);
    expect(result.applied_rules.some((r) => r.startsWith('exclude_categories:'))).toBe(true);
  });

  it('applies caps after exclusions', () => {
    const result = applyPartnerRules(rankedFixture, partnerRulesWithCap);
    expect(result.recommendations).toHaveLength(partnerRulesWithCap.max_recommendations);
    expect(result.applied_rules).toContain(`cap:${String(partnerRulesWithCap.max_recommendations)}`);
  });

  it('handles empty input without throwing', () => {
    const result = applyPartnerRules([], partnerRulesWithCruiseExclusion);
    expect(result.recommendations).toEqual([]);
    expect(result.applied_rules).toEqual([]);
  });

  it('ignores negative caps as no-ops', () => {
    const result = applyPartnerRules(rankedFixture, {
      ...partnerRulesDefault,
      max_recommendations: -1,
    });
    expect(result.recommendations).toHaveLength(rankedFixture.length);
    expect(result.applied_rules).toEqual([]);
  });
});
