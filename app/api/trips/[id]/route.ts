import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { NextRequest } from "next/server";
import { logEvent } from "@/lib/log";

export async function GET(_: NextRequest, { params }: { params: { id: string }}) {
  const trip = await prisma.trip.findUnique({ where: { id: params.id }, include: { payments: true, discounts: true, guides: { include: { guide: true } } } });
  if (!trip) return new Response('Not found', { status: 404 });
  return Response.json({ trip });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string }}) {
  try {
    const user = await getServerSession();
    if (!user?.id) return new Response('Unauthorized', { status: 401 });

    const trip = await prisma.trip.findUnique({
      where: { id: params.id },
      include: { payments: true, discounts: true, guides: { include: { guide: true } } }
    });

    if (!trip) return new Response('Not found', { status: 404 });

    // Check if user can edit (admin, trip creator, or trip leader)
    const userWithGuide = await prisma.user.findUnique({
      where: { id: user.id },
      select: { guideId: true }
    });

    const isTripLeader = userWithGuide?.guideId && trip.tripLeaderId === userWithGuide.guideId;
    const canEdit = user.role === 'ADMIN' || user.id === trip.createdById || isTripLeader;
    if (!canEdit) return new Response('Forbidden', { status: 403 });

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

    // Delete existing related records
    await prisma.tripGuide.deleteMany({ where: { tripId: params.id } });
    await prisma.discountLine.deleteMany({ where: { tripId: params.id } });
    if (trip.payments) {
      await prisma.paymentBreakdown.delete({ where: { id: trip.payments.id } });
    }

    // Update trip with new data
    const updated = await prisma.trip.update({
      where: { id: params.id },
      data: {
        tripDate: new Date(tripDate),
        leadName,
        paxGuideNote,
        totalPax,
        tripLeaderId: tripLeaderId || null,
        paymentsMadeYN: !!paymentsMadeYN,
        picsUploadedYN: !!picsUploadedYN,
        tripEmailSentYN: !!tripEmailSentYN,
        tripReport,
        suggestions,
        status: status || trip.status,
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
      },
      include: { payments: true, discounts: true, guides: { include: { guide: true } } }
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'Trip',
        entityId: trip.id,
        action: 'UPDATE',
        beforeJSON: trip as any,
        afterJSON: updated as any,
        actorUserId: user.id
      }
    });

    logEvent('trip_updated', { tripId: trip.id, userId: user.id, leadName });
    return Response.json({ trip: updated });
  } catch (error: any) {
    console.error('Error updating trip:', error);
    return new Response(JSON.stringify({ error: error.message, details: error.toString() }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string }}) {
  const user = await getServerSession();
  if (!user?.id) return new Response('Unauthorized', { status: 401 });
  if (user.role !== 'ADMIN') return new Response('Forbidden', { status: 403 });
  const trip = await prisma.trip.findUnique({ where: { id: params.id }, include: { payments: true, discounts: true, guides: { include: { guide: true } } } });
  if (!trip) return new Response('Not found', { status: 404 });
  const body = await req.json();
  // Simple override for core fields and status
  const { tripDate, leadName, paxGuideNote, totalPax, paymentsMadeYN, picsUploadedYN, tripEmailSentYN, status } = body;
  const updated = await prisma.trip.update({ where: { id: params.id }, data: { tripDate: tripDate ? new Date(tripDate) : undefined, leadName, paxGuideNote, totalPax, paymentsMadeYN, picsUploadedYN, tripEmailSentYN, status } });

  // If totalPax changed, recalculate guide earnings
  if (totalPax && totalPax !== trip.totalPax) {
    const { calculateGuideEarnings } = await import('@/lib/guideEarnings');
    for (const tg of trip.guides) {
      const isTripLeader = tg.guideId === trip.tripLeaderId;
      const feeAmount = calculateGuideEarnings(totalPax, tg.guide.rank, isTripLeader);
      await prisma.tripGuide.update({
        where: { id: tg.id },
        data: { feeAmount }
      });
    }
  }

  await prisma.auditLog.create({ data: { entityType: 'Trip', entityId: trip.id, action: 'PATCH', beforeJSON: trip as any, afterJSON: updated as any, actorUserId: user.id } });
  logEvent('trip_updated', { tripId: trip.id, userId: user.id });
  return Response.json({ trip: updated });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string }}) {
  const user = await getServerSession();
  if (!user?.id) return new Response('Unauthorized', { status: 401 });
  if (user.role !== 'ADMIN') return new Response('Forbidden - Admin only', { status: 403 });

  const trip = await prisma.trip.findUnique({
    where: { id: params.id },
    include: { payments: true, discounts: true, guides: true }
  });

  if (!trip) return new Response('Not found', { status: 404 });

  // Log the deletion in audit log before deleting
  await prisma.auditLog.create({
    data: {
      entityType: 'Trip',
      entityId: trip.id,
      action: 'DELETE',
      beforeJSON: trip as any,
      afterJSON: undefined,
      actorUserId: user.id
    }
  });

  // Delete related records first (cascade delete)
  await prisma.tripGuide.deleteMany({ where: { tripId: params.id } });
  await prisma.discountLine.deleteMany({ where: { tripId: params.id } });
  if (trip.payments) {
    await prisma.paymentBreakdown.delete({ where: { id: trip.payments.id } });
  }

  // Delete the trip
  await prisma.trip.delete({ where: { id: params.id } });

  logEvent('trip_deleted', { tripId: params.id, userId: user.id, leadName: trip.leadName });

  return Response.json({ success: true, message: 'Trip deleted successfully' });
}
