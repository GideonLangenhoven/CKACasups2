"use client";
import { useEffect, useMemo, useState } from "react";
import DatePicker from "@/components/DatePicker";
import TimePicker from "@/components/TimePicker";
import { todayLocalISODate } from "@/lib/time";

type Guide = { id: string; name: string; rank: "SENIOR"|"INTERMEDIATE"|"JUNIOR"|"TRAINEE" };

export default function NewTripPage() {
  const [step, setStep] = useState(1);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loadingGuides, setLoadingGuides] = useState(true);
  const [mounted, setMounted] = useState(false);

  const [tripDate, setTripDate] = useState<string>("");
  const [tripTime, setTripTime] = useState<string>("09:00");
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

  const discountTotal = useMemo(() => discounts.reduce((s, d) => s + (parseFloat(d.amount || "0") || 0), 0), [discounts]);
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

  // Mount and local draft persistence
  useEffect(() => {
    setMounted(true);
    // Check if we just came from a successful submission
    const justSubmitted = sessionStorage.getItem('trip-just-submitted');
    if (justSubmitted) {
      sessionStorage.removeItem('trip-just-submitted');
      localStorage.removeItem('cashup-draft');
    }

    const draft = localStorage.getItem('cashup-draft');
    if (draft && !justSubmitted) {
      try {
        const d = JSON.parse(draft);
        setTripDate(d.tripDate || todayLocalISODate());
        setTripTime(d.tripTime || "09:00");
        setLeadName(d.leadName || "");
        setPaxGuideNote(d.paxGuideNote || "");
        setTotalPax(d.totalPax || 0);
        setSelectedGuides(d.selectedGuides || []);
        setCashReceived(d.cashReceived || "");
        setPhonePouches(d.phonePouches || "");
        setWaterSales(d.waterSales || "");
        setSunglassesSales(d.sunglassesSales || "");
        setDiscounts(d.discounts || []);
        setPaymentsMadeYN(!!d.paymentsMadeYN);
        setPicsUploadedYN(!!d.picsUploadedYN);
        setTripEmailSentYN(!!d.tripEmailSentYN);
        setTripReport(d.tripReport || "");
        setSuggestions(d.suggestions || "");
      } catch {}
    } else {
      setTripDate(todayLocalISODate());
    }
  }, []);

  useEffect(() => {
    const payload = { tripDate, tripTime, leadName, paxGuideNote, totalPax, selectedGuides, cashReceived, phonePouches, waterSales, sunglassesSales, discounts, paymentsMadeYN, picsUploadedYN, tripEmailSentYN, tripReport, suggestions };
    localStorage.setItem('cashup-draft', JSON.stringify(payload));
  }, [tripDate, tripTime, leadName, paxGuideNote, totalPax, selectedGuides, cashReceived, phonePouches, waterSales, sunglassesSales, discounts, paymentsMadeYN, picsUploadedYN, tripEmailSentYN, tripReport, suggestions]);

  function toggleGuide(id: string) {
    setSelectedGuides((prev) => {
      if (prev.includes(id)) return prev.filter(gId => gId !== id);
      return [...prev, id];
    });
  }

  function clearForm() {
    if (!confirm('Are you sure you want to clear the form? This will delete your draft.')) return;
    localStorage.removeItem('cashup-draft');
    window.location.reload();
  }

  async function submit(status: "DRAFT"|"SUBMITTED") {
    // Validate payment fields are numbers
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

    // Validate discount amounts
    for (let i = 0; i < discounts.length; i++) {
      if (discounts[i].amount && isNaN(parseFloat(discounts[i].amount))) {
        alert(`Error: Discount #${i + 1} amount must be a number. Please enter numbers only (e.g., 50 or 50.00)`);
        return;
      }
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
      status,
      guides: selectedGuides.map(guideId => ({ guideId, pax: 0 })),
      payments: {
        cashReceived: parseFloat(cashReceived || "0"),
        phonePouches: parseFloat(phonePouches || "0"),
        waterSales: parseFloat(waterSales || "0"),
        sunglassesSales: parseFloat(sunglassesSales || "0")
      },
      discounts
    };
    const res = await fetch('/api/trips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) {
      localStorage.removeItem('cashup-draft');
      sessionStorage.setItem('trip-just-submitted', 'true');
      window.location.href = '/trips';
    } else {
      const contentType = res.headers.get('content-type');
      let errorMessage = 'Failed to save';
      if (contentType && contentType.includes('application/json')) {
        const errorData = await res.json();
        errorMessage = `Failed to save: ${errorData.error}\n\nDetails: ${errorData.details}`;
      } else {
        const t = await res.text();
        errorMessage = 'Failed to save: ' + t;
      }
      alert(errorMessage);
      console.error('Save error:', errorMessage);
    }
  }

  if (!mounted) {
    return <div className="card" style={{ maxWidth: 900, margin: "0 auto" }}><p>Loading...</p></div>;
  }

  return (
    <div className="card" style={{ maxWidth: 900, margin: "0 auto" }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Create Cash Up</h2>
        <button className="btn ghost" onClick={clearForm} style={{ fontSize: '1.5rem', padding: '0.4rem 0.8rem' }} title="Clear form and start fresh">↻</button>
      </div>
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
          <div className="payment-row" style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <div className="payment-field" style={{ width: '35%' }}>
              <label className="label" style={{ marginBottom: 6, display: 'block' }}>Cash received (R)</label>
              <input className="input" inputMode="decimal" value={cashReceived} onChange={e=>setCashReceived(e.target.value)} placeholder="Numbers only" />
            </div>
          </div>
          <div className="section-title">Additional Sales</div>
          <div className="payment-row" style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <div className="payment-field" style={{ width: '35%' }}>
              <label className="label" style={{ marginBottom: 6, display: 'block' }}>Phone pouches (R)</label>
              <input className="input" inputMode="decimal" value={phonePouches} onChange={e=>setPhonePouches(e.target.value)} placeholder="Numbers only" />
            </div>
            <div className="payment-field" style={{ width: '35%' }}>
              <label className="label" style={{ marginBottom: 6, display: 'block' }}>Water sales (R)</label>
              <input className="input" inputMode="decimal" value={waterSales} onChange={e=>setWaterSales(e.target.value)} placeholder="Numbers only" />
            </div>
          </div>
          <div className="payment-row" style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <div className="payment-field" style={{ width: '35%' }}>
              <label className="label" style={{ marginBottom: 6, display: 'block' }}>Sunglasses sales (R)</label>
              <input className="input" inputMode="decimal" value={sunglassesSales} onChange={e=>setSunglassesSales(e.target.value)} placeholder="Numbers only" />
            </div>
          </div>
          <div className="section-title">Discounts</div>
          {discounts.map((d, idx) => (
            <div className="row" key={idx}>
              <input className="input" placeholder="Amount (R) - Numbers only" inputMode="decimal" value={d.amount} onChange={e=>{
                const v = e.target.value; setDiscounts(prev=>prev.map((x,i)=>i===idx?{...x, amount: v}:x));
              }} />
              <input className="input" placeholder="Reason" value={d.reason} onChange={e=>{
                const v = e.target.value; setDiscounts(prev=>prev.map((x,i)=>i===idx?{...x, reason: v}:x));
              }} />
              <button className="btn ghost" onClick={()=>setDiscounts(prev=>prev.filter((_,i)=>i!==idx))}>Remove</button>
            </div>
          ))}
          <div className="row"><button className="btn secondary" onClick={()=>setDiscounts(prev=>[...prev,{amount:"0", reason:""}])}>Add discount</button><div>Discounts total: <strong>R {discountTotal.toFixed(2)}</strong></div></div>
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
            <div className="row" style={{ gap: 8 }}>
              <button className="btn ghost" onClick={()=>submit("DRAFT")}>Save Draft</button>
              <button className="btn" onClick={()=>submit("SUBMITTED")}>Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
