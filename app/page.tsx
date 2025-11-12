import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const user = await getServerSession();
  if (!user) redirect("/auth/signin");

  if (user.role === "ADMIN") {
    redirect("/trips/new"); // admin: keep old landing (create cash ups)
  }

  // If this user is linked to a Guide, route to the new Guide Home
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { guideId: true }
  });

  if (dbUser?.guideId) redirect("/guide");
  redirect("/trips/new");
}

