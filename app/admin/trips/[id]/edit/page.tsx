"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import DatePicker from "@/components/DatePicker";

type Guide = { id: string; name: string; rank: "SENIOR"|"INTERMEDIATE"|"JUNIOR"|"TRAINEE" };

export default function AdminTripEditPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;

  const [guides, setGuides] = useState<Guide[]>([]);
  const [loadingGuides, setLoadingGuides] = useState(true);
  const [loadingTrip, setLoadingTrip] = useState(true);
  const [saving, setSaving] = useState(false);

  const [tripDate, setTripDate] = useState<string>("");
  const [leadName, setLeadName] = useState("");
  const [paxGuideNote, setPaxGuideNote] = useState("");
  const [totalPax, setTotalPax] = useState<number>(0);
  const [tripLeaderId, setTripLeaderId] = useState<string>("");
  const [selectedGuides, setSelectedGuides] = useState<string[]>([]);

  const [cashReceived, setCashReceived] = useState<string>("");
  const [phonePouches, setPhonePouches] = useState<string>("");
  const [waterSales, setWaterSales] = useState<string>("");
  const [sunglassesSales, setSunglassesSales] = useState<string>("");
  const [discounts, setDiscounts] = useState<{amount: string; reason: string}[]>([]);
  const [paymentsMadeYN, setPaymentsMadeYN] = useState<boolean>(false);
  const [picsUploadedYN, setPicsUploadedYN] = useState<boolean>(false);
  const [tripEmailSentYN, setTripEmailSentYN] = useState<boolean>(false);
  const [tripReport, setTripReport] = useState<string>("");
  const [suggestions, setSuggestions] = useState<string>("");
  const [currentStatus, setCurrentStatus] = useState<string>("SUBMITTED");

  const discountTotal = useMemo(() => discounts.reduce((s, d) => s + (parseFloat(d.amount || "0") || 0), 0), [discounts]);

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

  useEffect(() => {
    if (!tripId) return;
    (async () => {
      try {
        const res = await fetch(`/api/trips/${tripId}`);
        if (!res.ok) {
          alert('Failed to load trip');
          router.push('/admin/trips');
          return;
        }
        const data = await res.json();
        const trip = data.trip;

        setTripDate(trip.tripDate.slice(0, 10));
        setLeadName(trip.leadName);
        setPaxGuideNote(trip.paxGuideNote || "");
        setTotalPax(trip.totalPax);
        setTripLeaderId(trip.tripLeaderId || "");
        setSelectedGuides(trip.guides.map((g: any) => g.guideId));
        setCurrentStatus(trip.status);

        if (trip.payments) {
          setCashReceived(trip.payments.cashReceived.toString());
          setPhonePouches(trip.payments.phonePouches?.toString() || "0");
          setWaterSales(trip.payments.waterSales?.toString() || "0");
          setSunglassesSales(trip.payments.sunglassesSales?.toString() || "0");
        }

        setPaymentsMadeYN(trip.paymentsMadeYN);
        setPicsUploadedYN(trip.picsUploadedYN);
        setTripEmailSentYN(trip.tripEmailSentYN);
        setTripReport(trip.tripReport || "");
        setSuggestions(trip.suggestions || "");

        setDiscounts(trip.discounts.map((d: any) => ({
          amount: d.amount.toString(),
          reason: d.reason
        })));
      } finally {
        setLoadingTrip(false);
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
    const paymentFields = [
      { name: 'Cash received', value: cashReceived },
      { name: 'Phone pouches', value: phonePouches },
      { name: 'Water sales', value: waterSales },
      { name: 'Sunglasses sales', value: sunglassesSales }
    ];

    for (const field of paymentFields) {
      if (field.value && isNaN(parseFloat(field.value))) {
        alert(`Error: ${field.name} must be a number. Please enter numbers only (e.g., 100 or 100.50)`);
        return;
      }
    }

    for (let i = 0; i < discounts.length; i++) {
      if (discounts[i].amount && isNaN(parseFloat(discounts[i].amount))) {
        alert(`Error: Discount #${i + 1} amount must be a number. Please enter numbers only (e.g., 50 or 50.00)`);
        return;
      }
    }

    setSaving(true);
    try {
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
          phonePouches: parseFloat(phonePouches || "0"),
          waterSales: parseFloat(waterSales || "0"),
          sunglassesSales: parseFloat(sunglassesSales || "0")
        },
        discounts
      };

      const res = await fetch(`/api/trips/${tripId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert('Trip updated successfully');
        router.push(`/admin/trips/${tripId}`);
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
      }
    } finally {
      setSaving(false);
    }
  }

  if (loadingTrip || loadingGuides) {
    return (
      <div className="stack">
        <AdminNav />
        <div className="card">Loading trip data...</div>
      </div>
    );
  }

  return (
    <div className="stack">
      <AdminNav />

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Edit Cash Up (Admin)</h2>
          <button
            className="btn ghost"
            onClick={() => router.push(`/admin/trips/${tripId}`)}
          >
            Cancel
          </button>
        </div>
        <div style={{
          padding: '12px',
          backgroundColor: '#fef3c7',
          borderRadius: '6px',
          marginBottom: 16,
          fontSize: '0.9rem',
          color: '#854d0e'
        }}>
          You are editing a submitted cash-up. After making changes, return to the review page to approve.
        </div>
      </div>

      <div className="card">
        <div className="section-title">Trip Information</div>
        <div className="stack">
          <div>
            <label className="label">Trip date</label>
            <DatePicker value={tripDate} onChange={setTripDate} />
          </div>
          <div>
            <label className="label">Cash up by (lead name)</label>
            <input
              className="input"
              placeholder="Enter lead name"
              value={leadName}
              onChange={e => setLeadName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Pax Guide (notes)</label>
            <textarea
              className="input"
              placeholder="Optional notes"
              value={paxGuideNote}
              onChange={e => setPaxGuideNote(e.target.value)}
              rows={3}
            />
          </div>
          <div>
            <label className="label">Total Pax (number of people on this trip) *</label>
            <input
              className="input"
              type="number"
              min={1}
              required
              value={totalPax === 0 ? '' : totalPax}
              onChange={e => setTotalPax(parseInt(e.target.value) || 0)}
              placeholder="Enter total number of people"
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Trip Leader</div>
        <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: 12 }}>
          Senior and Intermediate guides can be trip leaders
        </div>
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
      </div>

      <div className="card">
        <div className="section-title">Select Guides</div>
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
                  <button
                    key={g.id}
                    className={"btn guide-button " + (selectedGuides.includes(g.id) ? "" : "ghost")}
                    onClick={() => toggleGuide(g.id)}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <div style={{ marginTop: 16, color: '#666' }}>
          Selected guides: <strong>{selectedGuides.length}</strong>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Payments</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label className="label">Cash received (R)</label>
            <input
              className="input"
              inputMode="decimal"
              value={cashReceived}
              onChange={e => setCashReceived(e.target.value)}
              placeholder="Numbers only"
            />
          </div>
          <div>
            <label className="label">Phone pouches (R)</label>
            <input
              className="input"
              inputMode="decimal"
              value={phonePouches}
              onChange={e => setPhonePouches(e.target.value)}
              placeholder="Numbers only"
            />
          </div>
          <div>
            <label className="label">Water sales (R)</label>
            <input
              className="input"
              inputMode="decimal"
              value={waterSales}
              onChange={e => setWaterSales(e.target.value)}
              placeholder="Numbers only"
            />
          </div>
          <div>
            <label className="label">Sunglasses sales (R)</label>
            <input
              className="input"
              inputMode="decimal"
              value={sunglassesSales}
              onChange={e => setSunglassesSales(e.target.value)}
              placeholder="Numbers only"
            />
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <div className="section-title">Discounts</div>
          {discounts.map((d, idx) => (
            <div className="row" key={idx} style={{ marginBottom: 8, gap: 8 }}>
              <input
                className="input"
                placeholder="Amount (R) - Numbers only"
                inputMode="decimal"
                value={d.amount}
                onChange={e => {
                  const v = e.target.value;
                  setDiscounts(prev => prev.map((x, i) => i === idx ? { ...x, amount: v } : x));
                }}
              />
              <input
                className="input"
                placeholder="Reason"
                value={d.reason}
                onChange={e => {
                  const v = e.target.value;
                  setDiscounts(prev => prev.map((x, i) => i === idx ? { ...x, reason: v } : x));
                }}
              />
              <button
                className="btn ghost"
                onClick={() => setDiscounts(prev => prev.filter((_, i) => i !== idx))}
              >
                Remove
              </button>
            </div>
          ))}
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <button
              className="btn secondary"
              onClick={() => setDiscounts(prev => [...prev, { amount: "0", reason: "" }])}
            >
              Add discount
            </button>
            <div>
              Discounts total: <strong>R {discountTotal.toFixed(2)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Additional Checks</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="row" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={paymentsMadeYN}
              onChange={e => setPaymentsMadeYN(e.target.checked)}
            />
            <span style={{ marginLeft: 8 }}>All payments in Activitar</span>
          </label>
          <label className="row" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={picsUploadedYN}
              onChange={e => setPicsUploadedYN(e.target.checked)}
            />
            <span style={{ marginLeft: 8 }}>Facebook pictures uploaded</span>
          </label>
          <label className="row" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={tripEmailSentYN}
              onChange={e => setTripEmailSentYN(e.target.checked)}
            />
            <span style={{ marginLeft: 8 }}>Trip email sent</span>
          </label>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Trip Report</div>
        <label className="label">What happened on this trip?</label>
        <textarea
          className="input"
          placeholder="Describe the trip highlights, any issues, notable events..."
          value={tripReport}
          onChange={e => setTripReport(e.target.value)}
          rows={6}
        />
      </div>

      <div className="card">
        <div className="section-title">Suggestions</div>
        <label className="label">Suggestions</label>
        <textarea
          className="input"
          placeholder="Share your suggestions..."
          value={suggestions}
          onChange={e => setSuggestions(e.target.value)}
          rows={4}
        />
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
          <button
            className="btn ghost"
            onClick={() => router.push(`/admin/trips/${tripId}`)}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="btn"
            onClick={saveChanges}
            disabled={saving || !leadName || selectedGuides.length === 0 || totalPax === 0}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
