import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import Link from "next/link";

export default async function GuideHome() {
  const user = await getServerSession();
  if (!user) return <div className="card">Please sign in.</div>;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { guideId: true, guide: { select: { name: true } } }
  });
  if (!dbUser?.guideId) {
    return <div className="card">Your account is not linked to a guide. Ask admin to link your email.</div>;
  }

  const openExceptions = await prisma.paymentException.count({
    where: { guideId: dbUser.guideId, resolvedAt: null }
  });

  return (
    <div className="stack">
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Welcome{dbUser.guide?.name ? `, ${dbUser.guide.name}` : ""} 👋</h3>
        <p>Quick actions</p>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <Link className="btn" href="/guide/cashups/new">➕ New cash up</Link>
          <Link className="btn ghost" href="/trips">🧾 My trips</Link>
          <Link className="btn ghost" href="/earnings">💼 Earnings</Link>
          <Link className="btn ghost" href="/guide/cashups/new">💵 Cash / Card / EFT taken{openExceptions ? ` (${openExceptions})` : ""}</Link>
        </div>
      </div>
    </div>
  );
}
