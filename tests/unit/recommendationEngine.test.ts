import { rankRecommendations } from '../../src/services/recommendationEngine';
import { memberProfileFixture } from '../fixtures/members';
import { partnerRulesDefault, PARTNER_FIXTURE_ID } from '../fixtures/partners';
import { candidateCatalogFixture } from '../fixtures/recommendations';

describe('rankRecommendations', () => {
  it('applies tier multipliers from partner rules', () => {
    const member = { ...memberProfileFixture, tier: 'platinum', past_destinations: [] };
    const rules = {
      partner_id: PARTNER_FIXTURE_ID,
      tier_multipliers: { platinum: 2, gold: 1 },
    };
    const ranked = rankRecommendations(member, candidateCatalogFixture, rules);
    const paris = ranked.find((r) => r.destination_id === 'dest_paris');
    expect(paris?.score).toBeCloseTo(0.9 * 2);
  });

  it('uses default multiplier when tier is missing from the map', () => {
    const member = { ...memberProfileFixture, tier: 'silver', past_destinations: [] };
    const rules = {
      partner_id: PARTNER_FIXTURE_ID,
      tier_multipliers: { gold: 1.5 },
    };
    const ranked = rankRecommendations(member, candidateCatalogFixture, rules);
    const paris = ranked.find((r) => r.destination_id === 'dest_paris');
    expect(paris?.score).toBeCloseTo(0.9);
  });

  it('applies repeat destination penalty after multiplier', () => {
    const member = {
      ...memberProfileFixture,
      past_destinations: ['dest_paris'],
    };
    const ranked = rankRecommendations(member, candidateCatalogFixture, partnerRulesDefault);
    const paris = ranked.find((r) => r.destination_id === 'dest_paris');
    expect(paris?.score).toBeCloseTo(Math.max(0, 0.9 * 1 - 0.35));
  });

  it('sorts recommendations by score descending', () => {
    const ranked = rankRecommendations(memberProfileFixture, candidateCatalogFixture, partnerRulesDefault);
    for (let i = 1; i < ranked.length; i += 1) {
      expect(ranked[i - 1]?.score).toBeGreaterThanOrEqual(ranked[i]?.score ?? 0);
    }
  });
});
