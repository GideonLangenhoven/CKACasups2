"use client";
import { useState } from "react";

export function SubmitInvoiceButton() {
  const [loading, setLoading] = useState(false);
  const [invoiceType, setInvoiceType] = useState<'weekly' | 'monthly'>('monthly');
  const [tipAmount, setTipAmount] = useState<string>('0');
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

  function getWeekDateRange(weekString: string): string {
    if (!weekString || !weekString.includes('-W')) return '';

    const [yearStr, weekStr] = weekString.split('-W');
    const year = parseInt(yearStr);
    const weekNum = parseInt(weekStr);

    // Calculate start date of the week (Monday)
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const jan4Day = jan4.getUTCDay() || 7;
    const week1Monday = new Date(jan4);
    week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);

    const startDate = new Date(week1Monday);
    startDate.setUTCDate(week1Monday.getUTCDate() + (weekNum - 1) * 7);

    const endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + 6);

    // Format date range
    const startMonth = startDate.toLocaleDateString('en-US', { month: 'long' });
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'long' });
    const startDay = startDate.getUTCDate();
    const endDay = endDate.getUTCDate();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}, ${year}`;
    } else {
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
    }
  }

  const handleSubmit = async () => {
    const period = invoiceType === 'monthly' ? selectedMonth : selectedWeek;
    const periodLabel = invoiceType === 'monthly' ? selectedMonth : getWeekDateRange(selectedWeek);
    const tip = parseFloat(tipAmount) || 0;

    const confirmMessage = tip > 0
      ? `Submit ${invoiceType} invoice for ${periodLabel}?\n\nTip: R ${tip.toFixed(2)}\n\nThis will send your invoice to the admin email.`
      : `Submit ${invoiceType} invoice for ${periodLabel}?\n\nThis will send your invoice to the admin email.`;

    if (!confirm(confirmMessage)) {
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
          week: invoiceType === 'weekly' ? selectedWeek : undefined,
          tipAmount: tip
        })
      });

      const data = await res.json();

      if (res.ok) {
        const earningsDisplay = tip > 0
          ? `Total Earnings: R ${data.totalEarnings?.toFixed(2)} (including R ${tip.toFixed(2)} tip)`
          : `Total Earnings: R ${data.totalEarnings?.toFixed(2)}`;
        alert(`✓ Invoice submitted successfully!\n\nTrips: ${data.tripCount}\n${earningsDisplay}\n\nThe invoice has been sent to the admin email.`);
        // Reset tip after successful submission
        setTipAmount('0');
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
                {selectedWeek && (
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 6 }}>
                    {getWeekDateRange(selectedWeek)}
                  </div>
                )}
              </>
            )}
          </div>
          <div style={{ minWidth: 140 }}>
            <label className="label" style={{ marginBottom: 6 }}>Tip (Optional)</label>
            <input
              type="number"
              className="input"
              value={tipAmount}
              onChange={(e) => setTipAmount(e.target.value)}
              disabled={loading}
              placeholder="0.00"
              step="0.01"
              min="0"
              style={{ textAlign: 'right' }}
            />
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
