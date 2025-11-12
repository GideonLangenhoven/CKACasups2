"use client";
import { useEffect, useState } from "react";

type Guide = { id: string; name: string; rank: "SENIOR"|"INTERMEDIATE"|"JUNIOR"|"TRAINEE" };
type ExceptionType = "CASH" | "CARD" | "EFT";

export default function GuideCashupLite() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [tripDate, setTripDate] = useState<string>("");
  const [tripTime, setTripTime] = useState<string>("09:00");
  const [leadName, setLeadName] = useState("");
  const [totalPax, setTotalPax] = useState<number>(0);
  const [tripLeaderId, setTripLeaderId] = useState<string>("");
  const [selectedGuides, setSelectedGuides] = useState<string[]>([]);
  const [hadToTakePayment, setHadToTakePayment] = useState<boolean>(false);
  const [exceptionType, setExceptionType] = useState<ExceptionType>("CASH");
  const [ref, setRef] = useState("");          // yocoRef / bankRef
  const [amountHint, setAmountHint] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const d = new Date();
    setTripDate(d.toISOString().slice(0,10));
    fetch("/api/guides").then(r=>r.json()).then(d=>setGuides(d.guides||[]));
  }, []);

  function toggleGuide(id: string) {
    setSelectedGuides(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  }

  async function submit() {
    if (!tripDate || !leadName || totalPax <= 0 || selectedGuides.length === 0) {
      alert("Please fill trip date, lead name, total pax, and select at least one guide.");
      return;
    }
    const payload: any = {
      tripDate: `${tripDate}T${tripTime}:00.000Z`,
      leadName,
      totalPax,
      tripLeaderId: tripLeaderId || undefined,
      guides: selectedGuides,
      exception: hadToTakePayment ? {
        type: exceptionType,
        yocoRef: exceptionType === "CARD" ? ref || undefined : undefined,
        bankRef: exceptionType === "EFT" ? ref || undefined : undefined,
        amountHint: amountHint ? parseFloat(amountHint) : undefined,
        note: note || undefined
      } : undefined
    };
    const res = await fetch("/api/guide/cashups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (res.ok) {
      alert("Saved. Thanks!");
      window.location.href = "/trips";
    } else {
      alert(data.error || "Failed");
    }
  }

  return (
    <div className="card" style={{ maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ marginTop: 0 }}>Quick Cash Up</h2>

      <div className="stack">
        <label className="label">Trip date</label>
        <input className="input" type="date" value={tripDate} onChange={e=>setTripDate(e.target.value)} />
        <label className="label">Trip time</label>
        <input className="input" type="time" value={tripTime} onChange={e=>setTripTime(e.target.value)} />
        <label className="label">Cash up by (lead name)</label>
        <input className="input" value={leadName} onChange={e=>setLeadName(e.target.value)} placeholder="Lead guide name" />

        <div className="section-title">Trip leader</div>
        <select className="input" value={tripLeaderId} onChange={e=>setTripLeaderId(e.target.value)}>
          <option value="">-- Select Trip Leader --</option>
          {guides.filter(g => g.rank === "SENIOR" || g.rank === "INTERMEDIATE").map(g => (
            <option key={g.id} value={g.id}>{g.name} ({g.rank})</option>
          ))}
        </select>

        <div className="section-title">Select trip guides</div>
        {["SENIOR", "INTERMEDIATE", "JUNIOR", "TRAINEE"].map(rank => {
          const bucket = guides.filter(g => g.rank === (rank as any));
          if (bucket.length === 0) return null;
          return (
            <div key={rank} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700 }}>{rank}</div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                {bucket.map(g => (
                  <button key={g.id} className={"btn " + (selectedGuides.includes(g.id) ? "" : "ghost")} onClick={()=>toggleGuide(g.id)}>{g.name}</button>
                ))}
              </div>
            </div>
          );
        })}

        <label className="label" style={{ marginTop: 8 }}>Total Pax *</label>
        <input className="input" type="number" min={1} value={totalPax || ""} onChange={e=>setTotalPax(parseInt(e.target.value)||0)} />

        <div className="section-title" style={{ marginTop: 16 }}>Had to take a payment?</div>
        <label className="row"><input type="checkbox" checked={hadToTakePayment} onChange={e=>setHadToTakePayment(e.target.checked)} /> Yes — admin wasn't there and I had to accept a payment</label>

        {hadToTakePayment && (
          <div className="card" style={{ background: "#f8fafc" }}>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              {(["CASH","CARD","EFT"] as ExceptionType[]).map(t => (
                <button key={t} className={"btn " + (exceptionType===t ? "" : "ghost")} onClick={()=>setExceptionType(t)}>{t}</button>
              ))}
            </div>
            {exceptionType === "CARD" && (
              <>
                <label className="label">Yoco ref (optional)</label>
                <input className="input" value={ref} onChange={e=>setRef(e.target.value)} placeholder="e.g. Yoco receipt ref" />
              </>
            )}
            {exceptionType === "EFT" && (
              <>
                <label className="label">Bank/EFT ref (optional)</label>
                <input className="input" value={ref} onChange={e=>setRef(e.target.value)} placeholder="Bank reference" />
              </>
            )}
            <label className="label">Amount (optional)</label>
            <input className="input" inputMode="decimal" value={amountHint} onChange={e=>setAmountHint(e.target.value)} placeholder="Numbers only" />
            <label className="label">Note (optional)</label>
            <textarea className="input" rows={3} value={note} onChange={e=>setNote(e.target.value)} placeholder="Context for admin" />
          </div>
        )}

        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn" onClick={submit}>Save</button>
        </div>
      </div>
    </div>
  );
}
