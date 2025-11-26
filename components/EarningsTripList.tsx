"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EditTripFeeButton } from "./EditTripFeeButton";

interface Trip {
  id: string;
  tripDate: string;
  leadName: string;
  totalPax: number;
  status: string;
  tripLeaderId: string | null;
  guides: Array<{
    id: string;
    guideId: string;
    feeAmount: number;
  }>;
}

interface EarningsTripListProps {
  trips: Trip[];
  guideId: string;
}

export function EarningsTripList({ trips: initialTrips, guideId }: EarningsTripListProps) {
  const router = useRouter();
  const [, setRefreshKey] = useState(0);

  function handleFeeUpdated() {
    setRefreshKey(prev => prev + 1);
    router.refresh();
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom: 16 }}>Recent Trips</h3>
      {initialTrips.length === 0 ? (
        <p style={{ color: '#64748b' }}>No trips found.</p>
      ) : (
        <div className="stack">
          {initialTrips.slice(0, 10).map((trip) => {
            const myEarnings = parseFloat(trip.guides[0]?.feeAmount?.toString() || '0');
            const isTripLeader = trip.tripLeaderId === guideId;

            return (
              <div
                key={trip.id}
                style={{
                  padding: 12,
                  border: '1px solid #e5e5e5',
                  borderRadius: 6,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: trip.status === 'SUBMITTED' ? '#f0f9ff' : trip.status === 'APPROVED' ? '#f0fdf4' : undefined,
                  borderLeft: trip.status === 'SUBMITTED' ? '4px solid #3b82f6' : trip.status === 'APPROVED' ? '4px solid #22c55e' : undefined
                }}
              >
                <div>
                  <div style={{ fontWeight: 500 }}>
                    {new Date(trip.tripDate).toLocaleDateString()} — {trip.leadName}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span>{trip.totalPax} pax</span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor:
                        trip.status === 'APPROVED' ? '#dcfce7' :
                        trip.status === 'SUBMITTED' ? '#dbeafe' :
                        trip.status === 'DRAFT' ? '#fef3c7' :
                        trip.status === 'REJECTED' ? '#fee2e2' :
                        '#f3f4f6',
                      color:
                        trip.status === 'APPROVED' ? '#166534' :
                        trip.status === 'SUBMITTED' ? '#1e40af' :
                        trip.status === 'DRAFT' ? '#854d0e' :
                        trip.status === 'REJECTED' ? '#991b1b' :
                        '#374151'
                    }}>
                      {trip.status}
                    </span>
                    {isTripLeader && <span style={{ color: '#0A66C2' }}>Trip Leader</span>}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#059669', textAlign: 'right' }}>
                    R {myEarnings.toFixed(2)}
                  </div>
                  {trip.status === 'SUBMITTED' && (
                    <div style={{ fontSize: '0.75rem', color: '#3b82f6', marginTop: 4, textAlign: 'right' }}>
                      Pending Approval
                    </div>
                  )}
                  {trip.guides[0] ? (
                    <EditTripFeeButton
                      tripId={trip.id}
                      tripGuideId={trip.guides[0].id}
                      currentFee={myEarnings}
                      tripDate={trip.tripDate}
                      leadName={trip.leadName}
                      onFeeUpdated={handleFeeUpdated}
                    />
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4, textAlign: 'right' }}>
                      (Trip Leader / Creator)
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
