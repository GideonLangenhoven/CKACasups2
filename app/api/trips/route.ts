import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { NextRequest } from "next/server";
import { logEvent } from "@/lib/log";

export async function GET(req: NextRequest) {
  const user = await getServerSession();
  if (!user?.id) return new Response('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const lead = searchParams.get('lead')?.trim();
  const status = searchParams.get('status')?.trim();
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const adminFlag = searchParams.get('admin');
  const note = searchParams.get('note')?.trim();

  // Get user's guide ID if they are linked to a guide
  const userWithGuide = await prisma.user.findUnique({
    where: { id: user.id },
    select: { guideId: true, role: true }
  });

  const where: any = {};

  // If admin with admin flag, show all trips
  // Otherwise, show trips where user created OR was a guide
  if (!(userWithGuide?.role === 'ADMIN' && adminFlag === '1')) {
    where.OR = [
      { createdById: user.id },
      ...(userWithGuide?.guideId ? [{ guides: { some: { guideId: userWithGuide.guideId } } }] : [])
    ];
  }

  if (lead) where.leadName = { contains: lead, mode: 'insensitive' };
  if (status) where.status = status as any;
  if (note) where.paxGuideNote = { contains: note, mode: 'insensitive' };
  if (start || end) {
    where.tripDate = {};
    if (start) (where.tripDate as any).gte = new Date(start);
    if (end) (where.tripDate as any).lte = new Date(end + 'T23:59:59.999Z');
  }

  const trips = await prisma.trip.findMany({ where, orderBy: { tripDate: 'desc' } });
  return Response.json({ trips });
}

export async function POST(req: NextRequest) {
  try {
    const user = await getServerSession();
    if (!user?.id) return new Response('Unauthorized', { status: 401 });
    const body = await req.json();
    const { tripDate, leadName, paxGuideNote, totalPax, tripLeaderId, paymentsMadeYN, picsUploadedYN, tripEmailSentYN, tripReport, suggestions, status, guides, payments, discounts } = body;
    if (!tripDate || !leadName) return new Response('tripDate and leadName required', { status: 400 });

    let guideIds: string[] = (guides || []).map((g: any) => g.guideId);

    // Validate trip leader can only be SENIOR or INTERMEDIATE
    if (tripLeaderId) {
      const tripLeader = await prisma.guide.findUnique({ where: { id: tripLeaderId } });
      if (!tripLeader) {
        return new Response('Trip leader not found', { status: 400 });
      }
      if (tripLeader.rank !== 'SENIOR' && tripLeader.rank !== 'INTERMEDIATE') {
        return new Response('Only SENIOR and INTERMEDIATE guides can be trip leaders', { status: 400 });
      }

      // IMPORTANT: Ensure trip leader is always in the guides array
      if (!guideIds.includes(tripLeaderId)) {
        guideIds.push(tripLeaderId);
      }
    }

    const dbGuides = await prisma.guide.findMany({ where: { id: { in: guideIds } } });

    // Calculate earnings for each guide
    const { calculateGuideEarnings } = await import('@/lib/guideEarnings');

    const trip = await prisma.trip.create({
      data: {
        tripDate: new Date(tripDate),
        leadName,
        paxGuideNote,
        totalPax,
        tripLeaderId: tripLeaderId || undefined,
        paymentsMadeYN: !!paymentsMadeYN,
        picsUploadedYN: !!picsUploadedYN,
        tripEmailSentYN: !!tripEmailSentYN,
        tripReport,
        suggestions,
        status: status || 'APPROVED',
        createdById: user.id,
        payments: payments ? { create: payments } : undefined,
        discounts: discounts && discounts.length ? { create: discounts.map((d: any) => ({ amount: d.amount, reason: d.reason })) } : undefined,
        guides: guideIds && guideIds.length ? { create: guideIds.map((guideId) => {
          const guide = dbGuides.find((x: any) => x.id === guideId);
          if (!guide) throw new Error(`Guide not found: ${guideId}`);
          const paxCount = 0; // Can be updated later
          const isTripLeader = guideId === tripLeaderId;
          const feeAmount = calculateGuideEarnings(totalPax || 0, guide.rank, isTripLeader);
          return { guideId, paxCount, feeAmount };
        }) } : undefined,
      }
    });
    logEvent('trip_created', { tripId: trip.id, userId: user.id, leadName });
    return Response.json({ trip });
  } catch (error: any) {
    console.error('Error creating trip:', error);
    return new Response(JSON.stringify({ error: error.message, details: error.toString() }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
