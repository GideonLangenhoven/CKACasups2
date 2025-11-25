import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/session";
import Link from "next/link";

export default async function TripDetail({ params }: { params: { id: string }}) {
  const session = await getServerSession();
  const trip = await prisma.trip.findUnique({
    where: { id: params.id },
    include: {
      payments: true,
      discounts: true,
      guides: { include: { guide: true } },
      tripLeader: true
    }
  });
  if (!trip) return notFound();

  // Check if user can edit (admin or trip creator)
  const canEdit = session?.role === 'ADMIN' || session?.id === trip.createdById;

  return (
    <div className="stack">
      <h2>Trip on {new Date(trip.tripDate).toLocaleDateString()}</h2>
      <div className="row" style={{ marginBottom: 8, gap: '0.5rem' }}>
        <a className="btn" href={`/api/trips/${trip.id}/pdf`}>Download PDF</a>
        {canEdit && (
          <Link className="btn" href={`/trips/${trip.id}/edit`}>Edit Trip</Link>
        )}
      </div>
      <div className="card">
        <div>Lead: {trip.leadName}</div>
        <div>Status: {trip.status}</div>
        <div>Pax total: {trip.totalPax}</div>
        <div>Pax Guide notes: {trip as any && (trip as any).paxGuideNote}</div>
      </div>
      <div className="card">
        <div className="section-title">Additional Checks</div>
        <div>All payments in Activitar: {trip.paymentsMadeYN ? 'Yes' : 'No'}</div>
        <div>Facebook pictures uploaded: {trip.picsUploadedYN ? 'Yes' : 'No'}</div>
        <div>Trip email sent: {trip.tripEmailSentYN ? 'Yes' : 'No'}</div>
      </div>
      {(trip as any).tripReport && (
        <div className="card">
          <div className="section-title">Trip Report</div>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{(trip as any).tripReport}</div>
        </div>
      )}
      <div className="card">
        <div className="section-title">Guides</div>
        {trip.guides.map((g: any) => (<div key={g.id}>{g.guide.name} ({g.guide.rank}) — pax {g.paxCount}</div>))}
      </div>
      <div className="card">
        <div className="section-title">Payments</div>
        {trip.payments && (
          <div className="stack">
            <div>Cash received: R {trip.payments.cashReceived.toString()}</div>
            <div>Phone pouches: R {(trip.payments.phonePouches || 0).toString()}</div>
            <div>Water sales: R {(trip.payments.waterSales || 0).toString()}</div>
            <div>Sunglasses sales: R {(trip.payments.sunglassesSales || 0).toString()}</div>
          </div>
        )}
        <div className="section-title">Discount lines</div>
        {trip.discounts.map((d: any) => (<div key={d.id}>R {d.amount.toString()} — {d.reason}</div>))}
      </div>
    </div>
  );
}
