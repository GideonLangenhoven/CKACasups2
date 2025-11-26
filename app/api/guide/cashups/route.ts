import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const user = await getServerSession();
    if (!user?.id) return new Response("Unauthorized", { status: 401 });

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { guideId: true }
    });
    if (!dbUser?.guideId) return new Response("Forbidden", { status: 403 });

    const body = await req.json();
    const { tripDate, leadName, totalPax, tripLeaderId, guides, exception } = body as {
      tripDate: string; leadName: string; totalPax: number; tripLeaderId?: string;
      guides: string[];
      exception?: { type: "CASH"|"CARD"|"EFT"; yocoRef?: string; bankRef?: string; amountHint?: number; note?: string; };
    };

    if (!tripDate || !leadName || !totalPax || !guides?.length) {
      return new Response("tripDate, leadName, totalPax, guides required", { status: 400 });
    }

    // Validate leader per /api/trips: only SENIOR / INTERMEDIATE
    if (tripLeaderId) {
      const leader = await prisma.guide.findUnique({ where: { id: tripLeaderId } });
      if (!leader) return new Response("Trip leader not found", { status: 400 });
      if (leader.rank !== "SENIOR" && leader.rank !== "INTERMEDIATE") {
        return new Response("Only SENIOR and INTERMEDIATE can be trip leaders", { status: 400 });
      }
    }

    const guideIds = Array.from(new Set([...(guides || []), ...(tripLeaderId ? [tripLeaderId] : [])]));
    const dbGuides = await prisma.guide.findMany({ where: { id: { in: guideIds } } });
    const { calculateGuideEarnings } = await import('@/lib/guideEarnings'); // same as /api/trips

    const trip = await prisma.trip.create({
      data: {
        tripDate: new Date(tripDate),
        leadName,
        totalPax,
        tripLeaderId: tripLeaderId || undefined,
        status: "SUBMITTED",
        createdById: user.id,
        guides: guideIds.length ? {
          create: guideIds.map((gid) => {
            const g = dbGuides.find(x => x.id === gid);
            if (!g) throw new Error(`Guide not found: ${gid}`);
            const isLeader = gid === tripLeaderId;
            const feeAmount = calculateGuideEarnings(totalPax || 0, g.rank as any, isLeader, g.name);
            return { guideId: gid, paxCount: 0, feeAmount };
          })
        } : undefined
      }
    });

    if (exception && ["CASH","CARD","EFT"].includes(exception.type)) {
      await prisma.paymentException.create({
        data: {
          type: exception.type as any,
          yocoRef: exception.yocoRef || null,
          bankRef: exception.bankRef || null,
          amountHint: exception.amountHint ?? null,
          note: exception.note || null,
          guideId: dbUser.guideId,
          tripId: trip.id,
          createdById: user.id
        }
      });
    }

    return Response.json({ tripId: trip.id });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
