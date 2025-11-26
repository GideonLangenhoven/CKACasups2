import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { calculateGuideEarnings } from "@/lib/guideEarnings";
import { logEvent } from "@/lib/log";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getServerSession();
    if (!user?.id) return new Response('Unauthorized', { status: 401 });
    if (user.role !== 'ADMIN') return new Response('Forbidden - Admin only', { status: 403 });

    // Get all trips with their guides
    const trips = await prisma.trip.findMany({
      include: {
        guides: {
          include: {
            guide: true
          }
        }
      }
    });

    let updatedCount = 0;
    let errorCount = 0;

    for (const trip of trips) {
      try {
        for (const tg of trip.guides) {
          const isTripLeader = tg.guideId === trip.tripLeaderId;
          const newFeeAmount = calculateGuideEarnings(trip.totalPax || 0, tg.guide.rank, isTripLeader, tg.guide.name);

          // Only update if the fee amount has changed
          const currentFeeAmount = parseFloat(tg.feeAmount?.toString() || '0');
          if (currentFeeAmount !== newFeeAmount) {
            await prisma.tripGuide.update({
              where: { id: tg.id },
              data: { feeAmount: newFeeAmount }
            });
            updatedCount++;
          }
        }
      } catch (error) {
        console.error(`Error updating trip ${trip.id}:`, error);
        errorCount++;
      }
    }

    logEvent('earnings_recalculated', { userId: user.id, updatedCount, errorCount, totalTrips: trips.length });

    return Response.json({
      success: true,
      message: `Recalculated earnings for ${trips.length} trips`,
      updatedGuides: updatedCount,
      errors: errorCount
    });
  } catch (error: any) {
    console.error('Recalculate earnings error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
