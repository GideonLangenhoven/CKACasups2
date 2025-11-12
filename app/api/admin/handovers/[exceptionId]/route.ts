import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { NextRequest } from "next/server";

export async function PATCH(req: NextRequest, { params }: { params: { exceptionId: string } }) {
  const user = await getServerSession();
  if (!user?.id || user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });

  const { countedAmount, comment } = await req.json();

  const ex = await prisma.paymentException.findUnique({ where: { id: params.exceptionId } });
  if (!ex) return new Response("Not found", { status: 404 });
  if (ex.resolvedAt) return new Response("Already resolved", { status: 400 });

  const handover = await prisma.cashHandover.create({
    data: {
      exceptionId: ex.id,
      receivedById: user.id,
      countedAmount: countedAmount ?? null,
      comment: comment || null
    }
  });

  await prisma.paymentException.update({
    where: { id: ex.id },
    data: {
      resolvedAt: new Date(),
      resolution: "HANDOVER_CONFIRMED"
    }
  });

  return Response.json({ handoverId: handover.id });
}
