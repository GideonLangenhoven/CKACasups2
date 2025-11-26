"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DatePicker from "@/components/DatePicker";
import TimePicker from "@/components/TimePicker";
import { todayLocalISODate } from "@/lib/time";

type Guide = { id: string; name: string; rank: "SENIOR"|"INTERMEDIATE"|"JUNIOR"|"TRAINEE" };

export default function EditTripPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;

  const [step, setStep] = useState(1);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loadingGuides, setLoadingGuides] = useState(true);
  const [loadingTrip, setLoadingTrip] = useState(true);
  const [mounted, setMounted] = useState(false);

  const [tripDate, setTripDate] = useState<string>("");
  const [tripTime, setTripTime] = useState<string>("09:00");
  const [leadName, setLeadName] = useState("");
  const [paxGuideNote, setPaxGuideNote] = useState("");
  const [totalPax, setTotalPax] = useState<number>(0);

  const [tripLeaderId, setTripLeaderId] = useState<string>("");
  const [selectedGuides, setSelectedGuides] = useState<string[]>([]);

  const [cashReceived, setCashReceived] = useState<string>("");
  const [paymentsMadeYN, setPaymentsMadeYN] = useState<boolean>(false);
  const [picsUploadedYN, setPicsUploadedYN] = useState<boolean>(false);
  const [tripEmailSentYN, setTripEmailSentYN] = useState<boolean>(false);
  const [tripReport, setTripReport] = useState<string>("");
  const [suggestions, setSuggestions] = useState<string>("");
  const [currentStatus, setCurrentStatus] = useState<string>("APPROVED");
  const rankCounts = useMemo(() => {
    const getRank = (id: string) => guides.find(g => g.id === id)?.rank;
    return selectedGuides.reduce((acc, guideId) => {
      const r = getRank(guideId);
      if (r) acc[r] = (acc[r] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [selectedGuides, guides]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/guides');
        const data = await res.json();
        setGuides(data.guides || []);
      } finally {
        setLoadingGuides(false);
      }
    })();
  }, []);

  // Load existing trip data
  useEffect(() => {
    if (!tripId) return;
    (async () => {
      try {
        const res = await fetch(`/api/trips/${tripId}`);
        if (!res.ok) {
          alert('Failed to load trip');
          router.push('/trips/logged');
          return;
        }
        const data = await res.json();
        const trip = data.trip;

        // Check if current user is the trip leader
        const currentUserRes = await fetch('/api/auth/session');
        const currentUserData = await currentUserRes.json();

        if (!currentUserData.user?.guideId || trip.tripLeaderId !== currentUserData.user.guideId) {
          alert('You can only edit trips where you are the trip leader');
          router.push('/trips/logged');
          return;
        }

        // Populate form fields with existing trip data
        setTripDate(trip.tripDate.slice(0, 10));
        setLeadName(trip.leadName);
        setPaxGuideNote(trip.paxGuideNote || "");
        setTotalPax(trip.totalPax);
        setTripLeaderId(trip.tripLeaderId || "");
        setSelectedGuides(trip.guides.map((g: any) => g.guideId));
        setCurrentStatus(trip.status);

        // Populate payment fields
        if (trip.payments) {
          setCashReceived(trip.payments.cashReceived.toString());
        }

        // Populate checkboxes and text fields
        setPaymentsMadeYN(trip.paymentsMadeYN);
        setPicsUploadedYN(trip.picsUploadedYN);
        setTripEmailSentYN(trip.tripEmailSentYN);
        setTripReport(trip.tripReport || "");
        setSuggestions(trip.suggestions || "");
      } finally {
        setLoadingTrip(false);
        setMounted(true);
      }
    })();
  }, [tripId, router]);

  function toggleGuide(id: string) {
    setSelectedGuides((prev) => {
      if (prev.includes(id)) return prev.filter(gId => gId !== id);
      return [...prev, id];
    });
  }

  async function saveChanges() {
    // Validate cash received is a number
    if (cashReceived && isNaN(parseFloat(cashReceived))) {
      alert('Error: Cash received must be a number. Please enter numbers only (e.g., 100 or 100.50)');
      return;
    }

    const payload = {
      tripDate,
      leadName,
      paxGuideNote,
      totalPax,
      tripLeaderId: tripLeaderId || undefined,
      paymentsMadeYN,
      picsUploadedYN,
      tripEmailSentYN,
      tripReport,
      suggestions,
      status: currentStatus,
      guides: selectedGuides.map(guideId => ({ guideId, pax: 0 })),
      payments: {
        cashReceived: parseFloat(cashReceived || "0"),
        phonePouches: 0,
        waterSales: 0,
        sunglassesSales: 0
      },
      discounts: []
    };
    const res = await fetch(`/api/trips/${tripId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) {
      alert('Trip updated successfully');
      router.push('/trips/logged');
    } else {
      const contentType = res.headers.get('content-type');
      let errorMessage = 'Failed to update trip';
      if (contentType && contentType.includes('application/json')) {
        const errorData = await res.json();
        errorMessage = `Failed to update trip: ${errorData.error}\n\nDetails: ${errorData.details}`;
      } else {
        const t = await res.text();
        errorMessage = 'Failed to update trip: ' + t;
      }
      alert(errorMessage);
      console.error('Update error:', errorMessage);
    }
  }

  if (!mounted || loadingTrip) {
    return <div className="card" style={{ maxWidth: 900, margin: "0 auto" }}><p>Loading trip data...</p></div>;
  }

  return (
    <div className="card" style={{ maxWidth: 900, margin: "0 auto" }}>
      <h2>Edit Cash Up</h2>
      <div className="row" style={{ marginBottom: 12, gap: 8 }}>
        <button className={`btn ${step===1?"":"ghost"}`} onClick={() => setStep(1)}>1. Trip</button>
        <button className={`btn ${step===2?"":"ghost"}`} onClick={() => setStep(2)}>2. Guides & Pax</button>
        <button className={`btn ${step===3?"":"ghost"}`} onClick={() => setStep(3)}>3. Payments</button>
      </div>

      {step === 1 && (
        <div className="stack">
          <label className="label">Trip date</label>
          <DatePicker value={tripDate} onChange={setTripDate} />
          <label className="label">Trip time</label>
          <TimePicker value={tripTime} onChange={setTripTime} />
          <label className="label">Cash up by (lead name)</label>
          <input className="input" placeholder="Enter lead name" value={leadName} onChange={e=>setLeadName(e.target.value)} />
          <label className="label">Pax Guide (notes)</label>
          <textarea className="input" placeholder="Optional notes" value={paxGuideNote} onChange={e=>setPaxGuideNote(e.target.value)} />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={()=>setStep(2)} disabled={!leadName}>Next</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="stack">
          <div className="section-title">Select trip leader</div>
          <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #e5e5e5' }}>
            <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: 12 }}>
              Senior and Intermediate guides can be trip leaders
            </div>
            {loadingGuides ? <div>Loading guides...</div> : (
              <select
                className="input"
                value={tripLeaderId}
                onChange={e => setTripLeaderId(e.target.value)}
                style={{ maxWidth: '300px' }}
              >
                <option value="">-- Select Trip Leader --</option>
                {guides.filter(g => g.rank === 'SENIOR' || g.rank === 'INTERMEDIATE').map(g => (
                  <option key={g.id} value={g.id}>{g.name} ({g.rank})</option>
                ))}
              </select>
            )}
          </div>

          <div className="section-title">Select trip guides</div>
          {loadingGuides ? <div>Loading guides...</div> : (
            <div className="stack">
              {['SENIOR', 'INTERMEDIATE', 'JUNIOR', 'TRAINEE'].map(rank => {
                const guidesInRank = guides.filter(g => g && g.rank === rank);
                if (guidesInRank.length === 0) return null;
                return (
                  <div key={rank} style={{ marginBottom: 24, paddingBottom: 16, borderBottom: rank !== 'TRAINEE' ? '1px solid #e5e5e5' : 'none' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 12, color: '#333' }}>
                      {rank === 'SENIOR' ? 'Senior Guides' : rank === 'INTERMEDIATE' ? 'Intermediate Guides' : rank === 'JUNIOR' ? 'Junior Guides' : 'Trainees'}
                    </div>
                    <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                      {guidesInRank.map(g => (
                        <button key={g.id} className={"btn guide-button " + (selectedGuides.includes(g.id)?"":"ghost")} onClick={()=>toggleGuide(g.id)}>
                          {g.name}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="section-title" style={{ marginTop: '1.5rem' }}>Trip Information</div>
              <div>
                <label className="label">Total Pax (number of people on this trip) *</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  required
                  value={totalPax === 0 ? '' : totalPax}
                  onChange={e=>setTotalPax(parseInt(e.target.value)||0)}
                  placeholder="Enter total number of people"
                />
              </div>
              <div>Selected guides: <strong>{selectedGuides.length}</strong></div>
              <div>Guide counts — Senior: {rankCounts['SENIOR']||0}, Intermediate: {rankCounts['INTERMEDIATE']||0}, Junior: {rankCounts['JUNIOR']||0}, Trainee: {rankCounts['TRAINEE']||0}</div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <button className="btn ghost" onClick={()=>setStep(1)}>Back</button>
                <button className="btn" onClick={()=>setStep(3)} disabled={selectedGuides.length===0 || totalPax===0}>Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="stack">
          <div className="section-title">Payments</div>
          <div>
            <label className="label" style={{ marginBottom: 6, display: 'block' }}>Cash received (R)</label>
            <input className="input" inputMode="decimal" value={cashReceived} onChange={e=>setCashReceived(e.target.value)} placeholder="Numbers only" style={{ maxWidth: '300px' }} />
          </div>

          <div className="section-title">Additional Checks</div>
          <label className="row"><input type="checkbox" checked={paymentsMadeYN} onChange={e=>setPaymentsMadeYN(e.target.checked)} /> All payments in Activitar</label>
          <label className="row"><input type="checkbox" checked={picsUploadedYN} onChange={e=>setPicsUploadedYN(e.target.checked)} /> Facebook pictures uploaded</label>
          <label className="row"><input type="checkbox" checked={tripEmailSentYN} onChange={e=>setTripEmailSentYN(e.target.checked)} /> Trip email sent</label>

          <div className="section-title" style={{ marginTop: '1.5rem' }}>Trip Report</div>
          <label className="label">What happened on this trip?</label>
          <textarea
            className="input"
            placeholder="Describe the trip highlights, any issues, notable events..."
            value={tripReport}
            onChange={e=>setTripReport(e.target.value)}
            rows={4}
          />

          <div className="section-title">Suggestions</div>
          <label className="label">Suggestions</label>
          <textarea
            className="input"
            placeholder="Share your suggestions..."
            value={suggestions}
            onChange={e=>setSuggestions(e.target.value)}
            rows={4}
          />
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <button className="btn ghost" onClick={()=>setStep(2)}>Back</button>
            <button className="btn" onClick={saveChanges} disabled={!leadName || selectedGuides.length===0 || totalPax===0}>Save Changes</button>
          </div>
        </div>
      )}
    </div>
  );
}
