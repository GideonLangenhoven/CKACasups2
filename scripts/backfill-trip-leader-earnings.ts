/**
 * Backfill script to add missing TripGuide records for trip leaders
 *
 * This script finds all trips where:
 * - A trip leader is assigned (tripLeaderId is set)
 * - But the trip leader doesn't have a TripGuide record (no earnings)
 *
 * It then creates the missing TripGuide records with proper earnings calculation.
 *
 * Usage:
 *   Local: npx tsx scripts/backfill-trip-leader-earnings.ts
 *   Production: ssh into server and run: pnpm run backfill:trip-leaders
 *
 * IMPORTANT: This script needs access to the database.
 * - Locally: Ensure DATABASE_URL in .env is set
 * - Production: Run on the server with access to the production database
 */

import { PrismaClient } from '@prisma/client';
import { calculateGuideEarnings } from '../lib/guideEarnings';

const prisma = new PrismaClient();

async function backfillTripLeaderEarnings() {
  console.log('🔍 Searching for trips with missing trip leader earnings...\n');

  // Find all trips that have a trip leader
  const tripsWithLeader = await prisma.trip.findMany({
    where: {
      tripLeaderId: {
        not: null
      }
    },
    include: {
      tripLeader: true,
      guides: true
    }
  });

  console.log(`Found ${tripsWithLeader.length} trips with trip leaders\n`);

  let fixedCount = 0;
  let alreadyCorrectCount = 0;
  const errors: Array<{ tripId: string; error: string }> = [];

  for (const trip of tripsWithLeader) {
    if (!trip.tripLeaderId) continue;

    // Check if trip leader already has a TripGuide record
    const hasLeaderRecord = trip.guides.some(g => g.guideId === trip.tripLeaderId);

    if (hasLeaderRecord) {
      alreadyCorrectCount++;
      continue;
    }

    // Trip leader is missing from guides - fix it!
    try {
      const tripLeader = trip.tripLeader;
      if (!tripLeader) {
        errors.push({
          tripId: trip.id,
          error: `Trip leader ${trip.tripLeaderId} not found`
        });
        continue;
      }

      // Calculate proper earnings for the trip leader
      const feeAmount = calculateGuideEarnings(
        trip.totalPax,
        tripLeader.rank as any,
        true, // is trip leader
        tripLeader.name
      );

      // Create the missing TripGuide record
      await prisma.tripGuide.create({
        data: {
          tripId: trip.id,
          guideId: trip.tripLeaderId,
          paxCount: 0,
          feeAmount
        }
      });

      console.log(`✅ Fixed trip ${trip.id} (${new Date(trip.tripDate).toLocaleDateString()}) - Added ${tripLeader.name} as trip leader with R ${feeAmount.toFixed(2)}`);
      fixedCount++;

    } catch (error: any) {
      errors.push({
        tripId: trip.id,
        error: error.message
      });
      console.error(`❌ Error fixing trip ${trip.id}: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 BACKFILL SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total trips with leaders:     ${tripsWithLeader.length}`);
  console.log(`Already correct:              ${alreadyCorrectCount}`);
  console.log(`Fixed (added earnings):       ${fixedCount}`);
  console.log(`Errors:                       ${errors.length}`);
  console.log('='.repeat(60) + '\n');

  if (errors.length > 0) {
    console.log('⚠️  ERRORS ENCOUNTERED:\n');
    errors.forEach(({ tripId, error }) => {
      console.log(`  Trip ${tripId}: ${error}`);
    });
    console.log('');
  }

  if (fixedCount > 0) {
    console.log(`✨ Successfully backfilled ${fixedCount} trip leader earnings records!`);
  } else if (alreadyCorrectCount === tripsWithLeader.length) {
    console.log('✨ All trips already have correct trip leader earnings!');
  }
}

async function main() {
  try {
    await backfillTripLeaderEarnings();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
