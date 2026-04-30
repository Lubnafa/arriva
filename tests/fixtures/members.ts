/** Shared UUID used across integration + unit fixtures. */
export const MEMBER_FIXTURE_ID = '11111111-1111-4111-8111-111111111111';

/** Canonical member profile returned by mocked member service calls. */
export const memberProfileFixture = {
  member_id: MEMBER_FIXTURE_ID,
  tier: 'gold',
  past_destinations: ['dest_paris'],
} as const;
