/** Partner identifier aligned with seeded API key maps in tests. */
export const PARTNER_FIXTURE_ID = 'partner_integration';

/** Partner rules excluding cruise inventory (used by integration coverage). */
export const partnerRulesWithCruiseExclusion = {
  partner_id: PARTNER_FIXTURE_ID,
  exclude_categories: ['cruise'],
  max_recommendations: 10,
} as const;

/** Partner rules applying a hard cap on outbound recommendations. */
export const partnerRulesWithCap = {
  partner_id: PARTNER_FIXTURE_ID,
  max_recommendations: 2,
} as const;

/** Baseline partner rules without commercial constraints. */
export const partnerRulesDefault = {
  partner_id: PARTNER_FIXTURE_ID,
} as const;
