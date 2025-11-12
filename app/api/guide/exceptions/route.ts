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
    const { type, yocoRef, bankRef, amountHint, note, tripId } = body as {
      type: "CASH" | "CARD" | "EFT";
      yocoRef?: string; bankRef?: string; amountHint?: number; note?: string; tripId?: string;
    };

    if (!type || !["CASH", "CARD", "EFT"].includes(type)) {
      return new Response("Invalid type", { status: 400 });
    }

    const ex = await prisma.paymentException.create({
      data: {
        type, yocoRef, bankRef,
        amountHint: amountHint ?? null,
        note,
        guideId: dbUser.guideId,
        tripId: tripId || null,
        createdById: user.id
      }
    });

    return Response.json({ exception: ex });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
