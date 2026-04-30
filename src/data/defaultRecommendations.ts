import type { CandidateRecommendation } from '../services/recommendationEngine';

/**
 * Static catalog used when no external recommendation feed is configured.
 * TODO: Replace with catalog API or feature-store driven inventory for richer ranking.
 */
export function getDefaultCandidates(): CandidateRecommendation[] {
  return [
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
    {
      destination_id: 'dest_cabo',
      destination_name: 'Cabo San Lucas',
      category: 'beach',
      base_score: 0.8,
    },
  ];
}
