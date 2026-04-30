import type { CandidateRecommendation, RankedRecommendation } from '../../src/services/recommendationEngine';

/** Static catalog subset mirrors production defaults for deterministic tests. */
export const candidateCatalogFixture: CandidateRecommendation[] = [
  {
    destination_id: 'dest_paris',
    destination_name: 'Paris',
    category: 'city',
    base_score: 0.9,
  },
  {
    destination_id: 'dest_alaska',
    destination_name: 'Alaska Cruise',
    category: 'cruise',
    base_score: 0.95,
  },
  {
    destination_id: 'dest_tokyo',
    destination_name: 'Tokyo',
    category: 'city',
    base_score: 0.85,
  },
];

/** Pre-ranked samples for partner rule enforcement unit tests. */
export const rankedFixture: RankedRecommendation[] = [
  { ...candidateCatalogFixture[0], score: 0.9 },
  { ...candidateCatalogFixture[1], score: 0.95 },
  { ...candidateCatalogFixture[2], score: 0.85 },
];
