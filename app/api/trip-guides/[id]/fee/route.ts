import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { NextRequest } from "next/server";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getServerSession();
    if (!user?.id) return new Response('Unauthorized', { status: 401 });

    // Get the trip guide record
    const tripGuide = await prisma.tripGuide.findUnique({
      where: { id: params.id },
      include: {
        guide: true,
        trip: true
      }
    });

    if (!tripGuide) {
      return new Response('Trip guide record not found', { status: 404 });
    }

    // Check if user is the guide or an admin
    const userWithGuide = await prisma.user.findUnique({
      where: { id: user.id },
      select: { guideId: true, role: true }
    });

    const isOwnGuide = userWithGuide?.guideId === tripGuide.guideId;
    const isTripLeader = tripGuide.trip.tripLeaderId === userWithGuide?.guideId;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwnGuide && !isAdmin && !isTripLeader) {
      return new Response('Forbidden: You can only edit your own trip fees', { status: 403 });
    }

    const body = await req.json();
    const { feeAmount, reason } = body;

    if (typeof feeAmount !== 'number' || feeAmount < 0) {
      return new Response('Invalid fee amount', { status: 400 });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return new Response('Reason is required', { status: 400 });
    }

    // Store the old fee for audit log
    const oldFee = tripGuide.feeAmount;

    // Update the fee
    const updated = await prisma.tripGuide.update({
      where: { id: params.id },
      data: { feeAmount }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'TripGuide',
        entityId: tripGuide.id,
        action: 'FEE_ADJUSTED',
        beforeJSON: {
          feeAmount: oldFee,
          tripId: tripGuide.tripId,
          guideId: tripGuide.guideId,
          guideName: tripGuide.guide.name,
          tripDate: tripGuide.trip.tripDate,
          tripLeadName: tripGuide.trip.leadName
        },
        afterJSON: {
          feeAmount: feeAmount,
          reason: reason.trim(),
          adjustedBy: user.role === 'ADMIN' ? 'ADMIN' : 'GUIDE'
        },
        actorUserId: user.id
      }
    });

    return Response.json({
      success: true,
      tripGuide: updated,
      message: 'Fee updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating trip guide fee:', error);
    return new Response(error.message || 'Failed to update fee', { status: 500 });
  }
}
