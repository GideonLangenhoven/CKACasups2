"use client";
import { useState } from "react";

export function SubmitInvoiceButton() {
  const [loading, setLoading] = useState(false);
  const [invoiceType, setInvoiceType] = useState<'weekly' | 'monthly'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-W${String(getWeekNumber(now)).padStart(2, '0')}`;
  });

  function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  const handleSubmit = async () => {
    const period = invoiceType === 'monthly' ? selectedMonth : selectedWeek;
    const periodLabel = invoiceType === 'monthly' ? `month ${selectedMonth}` : `week ${selectedWeek}`;

    if (!confirm(`Submit ${invoiceType} invoice for ${periodLabel}?\n\nThis will send your invoice to the admin email.`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/guides/submit-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceType,
          month: invoiceType === 'monthly' ? selectedMonth : undefined,
          week: invoiceType === 'weekly' ? selectedWeek : undefined
        })
      });

      const data = await res.json();

      if (res.ok) {
        alert(`✓ Invoice submitted successfully!\n\nTrips: ${data.tripCount}\nTotal Earnings: R ${data.totalEarnings?.toFixed(2)}\n\nThe invoice has been sent to the admin email.`);
      } else {
        alert(`Error: ${data.error || 'Failed to submit invoice'}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message || 'Failed to submit invoice'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ background: '#f8fafc', border: '2px solid #0A66C2' }}>
      <div style={{ marginBottom: 12 }}>
        <strong style={{ fontSize: '1.1rem', color: '#0A66C2' }}>Submit Invoice</strong>
      </div>
      <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: '#64748b' }}>
        Generate and submit your weekly or monthly invoice to admin. The invoice will include all trips and total earnings for the selected period.
      </p>
      <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
        <div>
          <label className="label" style={{ marginBottom: 6 }}>Invoice Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={invoiceType === 'weekly' ? 'btn' : 'btn ghost'}
              onClick={() => setInvoiceType('weekly')}
              disabled={loading}
              style={{ flex: 1 }}
            >
              Weekly
            </button>
            <button
              type="button"
              className={invoiceType === 'monthly' ? 'btn' : 'btn ghost'}
              onClick={() => setInvoiceType('monthly')}
              disabled={loading}
              style={{ flex: 1 }}
            >
              Monthly
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: 200 }}>
            {invoiceType === 'monthly' ? (
              <>
                <label className="label" style={{ marginBottom: 6 }}>Select Month</label>
                <input
                  type="month"
                  className="input"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  disabled={loading}
                  max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
                />
              </>
            ) : (
              <>
                <label className="label" style={{ marginBottom: 6 }}>Select Week</label>
                <input
                  type="week"
                  className="input"
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  disabled={loading}
                  max={`${new Date().getFullYear()}-W${String(getWeekNumber(new Date())).padStart(2, '0')}`}
                />
              </>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn"
            style={{
              background: '#059669',
              color: 'white',
              minWidth: 180
            }}
          >
            {loading ? 'Submitting...' : '📧 Submit Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}
