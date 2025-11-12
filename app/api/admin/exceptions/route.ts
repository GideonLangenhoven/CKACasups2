import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

export async function GET() {
  const user = await getServerSession();
  if (!user?.id || user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });

  const exceptions = await prisma.paymentException.findMany({
    include: { guide: true, trip: true, createdBy: true, handover: true },
    orderBy: [{ resolvedAt: "asc" }, { createdAt: "desc" }]
  });

  return Response.json({ exceptions });
}
