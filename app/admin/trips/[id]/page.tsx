"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";

export default function AdminTripReviewPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;

  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadTrip();
  }, [tripId]);

  async function loadTrip() {
    try {
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) {
        alert('Failed to load trip');
        router.push('/admin/trips');
        return;
      }
      const data = await res.json();
      setTrip(data.trip);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(newStatus: string) {
    if (!confirm(`Are you sure you want to change status to ${newStatus}?`)) return;

    setUpdating(true);
    try {
      const res = await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error(await res.text());
      await loadTrip();
      alert(`Trip status updated to ${newStatus}`);
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="stack">
        <AdminNav />
        <div className="card">Loading trip...</div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="stack">
        <AdminNav />
        <div className="card">Trip not found</div>
      </div>
    );
  }

  return (
    <div className="stack">
      <AdminNav />

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, marginBottom: 8 }}>Review Cash Up</h2>
            <div style={{ color: '#666' }}>
              {new Date(trip.tripDate).toLocaleDateString()} — {trip.leadName}
            </div>
          </div>
          <div style={{
            padding: '6px 12px',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '0.9rem',
            backgroundColor:
              trip.status === 'APPROVED' ? '#dcfce7' :
              trip.status === 'REJECTED' ? '#fee2e2' :
              trip.status === 'SUBMITTED' ? '#dbeafe' :
              trip.status === 'LOCKED' ? '#f3f4f6' :
              '#fef3c7',
            color:
              trip.status === 'APPROVED' ? '#166534' :
              trip.status === 'REJECTED' ? '#991b1b' :
              trip.status === 'SUBMITTED' ? '#1e40af' :
              trip.status === 'LOCKED' ? '#374151' :
              '#854d0e'
          }}>
            {trip.status}
          </div>
        </div>

        <div className="row" style={{ gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          <Link href={`/admin/trips/${tripId}/edit`} className="btn">
            Edit Cash Up
          </Link>
          <a href={`/api/trips/${tripId}/pdf`} className="btn ghost">
            Download PDF
          </a>
          <Link href={`/trips/${tripId}`} className="btn ghost">
            View Details
          </Link>
        </div>

        <div style={{
          padding: '16px',
          backgroundColor: '#f3f4f6',
          borderRadius: '8px',
          marginBottom: 24
        }}>
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: '1rem' }}>
            Manage Trip Status
          </div>
          <div style={{ marginBottom: 12, color: '#64748b', fontSize: '0.9rem' }}>
            Trips are automatically approved when logged. You can change the status if needed.
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn"
              disabled={updating || trip.status === 'APPROVED'}
              onClick={() => updateStatus('APPROVED')}
              style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
            >
              ✓ Approve
            </button>
            <button
              className="btn ghost"
              disabled={updating || trip.status === 'REJECTED'}
              onClick={() => updateStatus('REJECTED')}
              style={{ borderColor: '#dc2626', color: '#dc2626' }}
            >
              ✗ Reject
            </button>
            <button
              className="btn ghost"
              disabled={updating || trip.status === 'LOCKED'}
              onClick={() => updateStatus('LOCKED')}
            >
              🔒 Lock
            </button>
            <button
              className="btn ghost"
              disabled={updating || trip.status === 'DRAFT'}
              onClick={() => updateStatus('DRAFT')}
            >
              📝 Set to Draft
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Trip Information</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: 4 }}>Trip Date</div>
            <div>{new Date(trip.tripDate).toLocaleDateString()}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: 4 }}>Lead Name</div>
            <div>{trip.leadName}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: 4 }}>Total Pax</div>
            <div>{trip.totalPax}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: 4 }}>Status</div>
            <div>{trip.status}</div>
          </div>
        </div>
        {trip.paxGuideNote && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: 4 }}>Pax Guide Notes</div>
            <div>{trip.paxGuideNote}</div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="section-title">Guides</div>
        {trip.tripLeaderId && (
          <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e5e5e5' }}>
            <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: 4 }}>Trip Leader</div>
            <div style={{ fontWeight: 600 }}>
              {trip.guides.find((g: any) => g.guideId === trip.tripLeaderId)?.guide?.name || 'Unknown'}
            </div>
          </div>
        )}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e5e5' }}>
              <th style={{ textAlign: 'left', padding: '8px 0', fontSize: '0.9rem' }}>Guide</th>
              <th style={{ textAlign: 'left', padding: '8px 0', fontSize: '0.9rem' }}>Rank</th>
              <th style={{ textAlign: 'right', padding: '8px 0', fontSize: '0.9rem' }}>Earnings</th>
            </tr>
          </thead>
          <tbody>
            {trip.guides.map((g: any) => (
              <tr key={g.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '12px 0' }}>
                  {g.guide.name}
                  {g.guideId === trip.tripLeaderId && (
                    <span style={{
                      marginLeft: 8,
                      fontSize: '0.75rem',
                      padding: '2px 6px',
                      backgroundColor: '#dbeafe',
                      color: '#1e40af',
                      borderRadius: '4px',
                      fontWeight: 600
                    }}>
                      LEADER
                    </span>
                  )}
                </td>
                <td style={{ padding: '12px 0' }}>{g.guide.rank}</td>
                <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 600 }}>
                  R {parseFloat(g.feeAmount?.toString() || '0').toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {trip.payments && (
        <div className="card">
          <div className="section-title">Payments</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: 4 }}>Cash Received</div>
              <div>R {trip.payments.cashReceived.toString()}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: 4 }}>Phone Pouches</div>
              <div>R {(trip.payments.phonePouches || 0).toString()}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: 4 }}>Water Sales</div>
              <div>R {(trip.payments.waterSales || 0).toString()}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: 4 }}>Sunglasses Sales</div>
              <div>R {(trip.payments.sunglassesSales || 0).toString()}</div>
            </div>
          </div>
          {trip.discounts && trip.discounts.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e5e5e5' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 8 }}>Discount Lines</div>
              {trip.discounts.map((d: any) => (
                <div key={d.id} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span>{d.reason}</span>
                    <span style={{ fontWeight: 600 }}>R {d.amount.toString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="section-title">Additional Checks</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="row" style={{ gap: 8 }}>
            <div style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              backgroundColor: trip.paymentsMadeYN ? '#16a34a' : '#e5e5e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '0.75rem',
              fontWeight: 600
            }}>
              {trip.paymentsMadeYN ? '✓' : ''}
            </div>
            <span>All payments in Activitar</span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              backgroundColor: trip.picsUploadedYN ? '#16a34a' : '#e5e5e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '0.75rem',
              fontWeight: 600
            }}>
              {trip.picsUploadedYN ? '✓' : ''}
            </div>
            <span>Facebook pictures uploaded</span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              backgroundColor: trip.tripEmailSentYN ? '#16a34a' : '#e5e5e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '0.75rem',
              fontWeight: 600
            }}>
              {trip.tripEmailSentYN ? '✓' : ''}
            </div>
            <span>Trip email sent</span>
          </div>
        </div>
      </div>

      {trip.tripReport && (
        <div className="card">
          <div className="section-title">Trip Report</div>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
            {trip.tripReport}
          </div>
        </div>
      )}

      {trip.suggestions && (
        <div className="card">
          <div className="section-title">Suggestions</div>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
            {trip.suggestions}
          </div>
        </div>
      )}
    </div>
  );
}
