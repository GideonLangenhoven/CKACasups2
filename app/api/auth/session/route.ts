import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "fallback-secret-change-me"
);

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);

    // Fetch user with guide info
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.userId as string },
      include: { guide: true }
    });

    // Map JWT payload to SessionUser format with guide info
    const user = {
      id: payload.userId as string,
      email: payload.email as string,
      name: payload.name as string | null,
      role: payload.role as "ADMIN" | "USER",
      active: payload.active as boolean,
      guideId: dbUser?.guideId || null,
      guideRank: dbUser?.guide?.rank || null,
    };

    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
