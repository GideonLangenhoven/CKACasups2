import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import Link from "next/link";

export default async function TripsLoggedPage() {
  const user = await getServerSession();
  if (!user?.id) return <div>Please <Link href="/auth/signin">sign in</Link>.</div>;

  // Get user's guide ID
  const userWithGuide = await prisma.user.findUnique({
    where: { id: user.id },
    select: { guideId: true, role: true }
  });

  if (!userWithGuide?.guideId) {
    return (
      <div className="stack">
        <div className="card">
          <h2>Trips Logged</h2>
          <p>You are not linked to a guide account. Only trip leaders can view and edit trips here.</p>
        </div>
      </div>
    );
  }

  // Get trips where this user is the creator or trip leader
  const trips = await prisma.trip.findMany({
    where: {
      OR: [
        { createdById: user.id },
        { tripLeaderId: userWithGuide.guideId }
      ]
    },
    orderBy: { tripDate: "desc" },
    include: {
      payments: true,
      guides: { include: { guide: true } },
      tripLeader: true
    }
  });

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Trips Logged</h2>
        <div style={{ fontSize: '0.9rem', color: '#666' }}>
          Trips you created or where you are the trip leader
        </div>
      </div>

      {trips.length === 0 ? (
        <div className="card">
          <p>No trips found that you created or where you are the trip leader.</p>
        </div>
      ) : (
        trips.map((t: any) => (
          <div className="card" key={t.id}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ fontSize: '1.1rem' }}>
                    {new Date(t.tripDate).toLocaleDateString()}
                  </strong>
                  <span style={{ margin: '0 8px', color: '#999' }}>—</span>
                  <span>{t.leadName}</span>
                </div>
                <div style={{ color: '#666', fontSize: '0.9rem', marginBottom: 4 }}>
                  Status: <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: t.status === 'APPROVED' ? '#dcfce7' : '#fef3c7',
                    color: t.status === 'APPROVED' ? '#166534' : '#854d0e',
                    fontWeight: 600
                  }}>{t.status}</span>
                </div>
                <div style={{ color: '#666', fontSize: '0.9rem', marginBottom: 4 }}>
                  Pax: {t.totalPax}
                </div>
                <div style={{ color: '#666', fontSize: '0.9rem' }}>
                  Guides: {t.guides.map((g: any) => g.guide.name).join(', ')}
                </div>
                {t.payments && (
                  <div style={{ marginTop: 8, color: '#059669', fontWeight: 500 }}>
                    Cash Received: R {parseFloat(t.payments.cashReceived?.toString() || '0').toFixed(2)}
                  </div>
                )}
              </div>
              <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                <Link className="btn ghost" href={`/trips/${t.id}`}>View</Link>
                <Link className="btn" href={`/trips/${t.id}/edit`}>Edit</Link>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
