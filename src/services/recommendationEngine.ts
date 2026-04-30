import type { PartnerRules } from './partnerConfigService';
import type { MemberProfile } from './memberService';

export type CandidateRecommendation = {
  destination_id: string;
  destination_name: string;
  category: string;
  base_score: number;
};

export type RankedRecommendation = CandidateRecommendation & {
  score: number;
};

const DEFAULT_TIER_MULTIPLIER = 1;
const REPEAT_DESTINATION_PENALTY = 0.35;

/**
 * Produces a ranked recommendation list using tier multipliers and repeat-destination penalty.
 * TODO: Plug in a trained ranking model or contextual bandit once labeled engagement data is available.
 */
export function rankRecommendations(
  member: MemberProfile,
  candidates: readonly CandidateRecommendation[],
  rules: PartnerRules,
): RankedRecommendation[] {
  const tierMultipliers = rules.tier_multipliers ?? {};
  const tierMultiplier = tierMultipliers[member.tier] ?? DEFAULT_TIER_MULTIPLIER;
  const past = new Set(member.past_destinations);

  const ranked = candidates.map((c) => {
    const repeatPenalty = past.has(c.destination_id) ? REPEAT_DESTINATION_PENALTY : 0;
    const score = Math.max(0, c.base_score * tierMultiplier - repeatPenalty);
    return { ...c, score };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}
