import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const user = await getServerSession();
  if (!user) redirect("/auth/signin");

  if (user.role === "ADMIN") {
    redirect("/trips/new"); // admin: keep old landing (create cash ups)
  }

  // All users (guides and non-guides) go to new cash up form
  redirect("/trips/new");
}

