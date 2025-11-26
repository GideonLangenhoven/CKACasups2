import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import Link from "next/link";
import { SubmitInvoiceButton } from "@/components/SubmitInvoiceButton";
import { DisputeButton } from "@/components/DisputeButton";
import { EarningsTripList } from "@/components/EarningsTripList";

export default async function EarningsPage() {
  const user = await getServerSession();
  if (!user?.id) return <div>Please <Link href="/auth/signin">sign in</Link>.</div>;

  // Get user's guide info
  const userWithGuide = await prisma.user.findUnique({
    where: { id: user.id },
    select: { guideId: true, guide: { select: { name: true, rank: true } } }
  });

  if (!userWithGuide?.guideId) {
    return <div className="stack"><div className="card">You are not linked to a guide profile.</div></div>;
  }

  // Get all trips for this guide (where they're a guide OR where they created the trip)
  const trips = await prisma.trip.findMany({
    where: {
      OR: [
        {
          guides: {
            some: {
              guideId: userWithGuide.guideId
            }
          }
        },
        {
          createdById: user.id
        }
      ]
    },
    include: {
      guides: {
        where: { guideId: userWithGuide.guideId },
        include: { guide: true }
      },
      tripLeader: true
    },
    orderBy: { tripDate: 'desc' }
  });

  // Calculate earnings by period
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthNum = now.getMonth();

  const earningsByPeriod = {
    today: 0,
    thisMonth: 0,
    thisYear: 0,
    allTime: 0,
    tripCountToday: 0,
    tripCountThisMonth: 0,
    tripCountThisYear: 0,
    tripCountAllTime: trips.length,
  };

  for (const trip of trips) {
    const tripDate = new Date(trip.tripDate);
    const earnings = parseFloat(trip.guides[0]?.feeAmount?.toString() || '0');

    earningsByPeriod.allTime += earnings;

    if (tripDate.getFullYear() === currentYear) {
      earningsByPeriod.thisYear += earnings;
      earningsByPeriod.tripCountThisYear++;

      if (tripDate.getMonth() === currentMonthNum) {
        earningsByPeriod.thisMonth += earnings;
        earningsByPeriod.tripCountThisMonth++;

        if (tripDate.getDate() === now.getDate()) {
          earningsByPeriod.today += earnings;
          earningsByPeriod.tripCountToday++;
        }
      }
    }
  }

  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return (
    <div className="stack">
      <h2>My Earnings - {userWithGuide.guide?.name}</h2>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <SubmitInvoiceButton />
        </div>
        <DisputeButton
          guideName={userWithGuide.guide?.name || ''}
          month={currentMonth}
          tripCount={earningsByPeriod.tripCountThisMonth}
          totalEarnings={earningsByPeriod.thisMonth}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div className="card">
          <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 4 }}>Today</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#059669' }}>
            R {earningsByPeriod.today.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>
            {earningsByPeriod.tripCountToday} {earningsByPeriod.tripCountToday === 1 ? 'trip' : 'trips'}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 4 }}>This Month</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#059669' }}>
            R {earningsByPeriod.thisMonth.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>
            {earningsByPeriod.tripCountThisMonth} {earningsByPeriod.tripCountThisMonth === 1 ? 'trip' : 'trips'}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 4 }}>This Year</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#059669' }}>
            R {earningsByPeriod.thisYear.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>
            {earningsByPeriod.tripCountThisYear} {earningsByPeriod.tripCountThisYear === 1 ? 'trip' : 'trips'}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 4 }}>All Time</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#059669' }}>
            R {earningsByPeriod.allTime.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>
            {earningsByPeriod.tripCountAllTime} {earningsByPeriod.tripCountAllTime === 1 ? 'trip' : 'trips'}
          </div>
        </div>
      </div>

      <EarningsTripList trips={trips as any} guideId={userWithGuide.guideId} />
    </div>
  );
}
