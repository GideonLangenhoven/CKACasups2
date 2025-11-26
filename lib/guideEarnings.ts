// Guide earnings calculation - Flat rates per rank
// Trip Leader gets their rate, not double-counted

type GuideRank = 'SENIOR' | 'INTERMEDIATE' | 'JUNIOR' | 'TRAINEE';

// Flat rate earnings by rank
const FLAT_RATES: Record<GuideRank, number> = {
  TRAINEE: 200,
  JUNIOR: 350,
  INTERMEDIATE: 550,
  SENIOR: 730
};

// Trip leader flat rates by rank
const TRIP_LEADER_RATES: Record<GuideRank, number> = {
  TRAINEE: 810,
  JUNIOR: 810,
  INTERMEDIATE: 700,  // Special rate for intermediate trip leaders
  SENIOR: 810
};

/**
 * Calculate earnings for a guide on a trip
 * @param paxCount Total number of passengers (not used in flat rate system, kept for compatibility)
 * @param rank Guide's rank
 * @param isTripLeader Whether this guide is the trip leader
 * @param guideName Optional guide name to check for special rates (e.g., "Leader")
 * @returns Earnings amount in Rands
 */
export function calculateGuideEarnings(
  paxCount: number,
  rank: GuideRank,
  isTripLeader: boolean = false,
  guideName?: string
): number {
  // Special rate for guides with "Leader" in their name
  if (guideName && guideName.toLowerCase().includes('leader')) {
    return isTripLeader ? 820 : 740;
  }

  // If trip leader, return rank-specific trip leader rate
  if (isTripLeader) {
    return TRIP_LEADER_RATES[rank] || 810;
  }

  // Otherwise return their rank's flat rate
  return FLAT_RATES[rank] || 0;
}

/**
 * Calculate earnings for all guides on a trip
 */
export function calculateTripEarnings(
  paxCount: number,
  guides: Array<{ id: string; rank: GuideRank; name?: string }>,
  tripLeaderId?: string | null
): Record<string, number> {
  const earnings: Record<string, number> = {};

  for (const guide of guides) {
    const isTripLeader = guide.id === tripLeaderId;
    earnings[guide.id] = calculateGuideEarnings(paxCount, guide.rank, isTripLeader, guide.name);
  }

  return earnings;
}
