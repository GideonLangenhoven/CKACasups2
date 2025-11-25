"use client";
import { useState } from "react";

interface EditTripFeeButtonProps {
  tripId: string;
  tripGuideId: string;
  currentFee: number;
  tripDate: string;
  leadName: string;
  onFeeUpdated: () => void;
}

export function EditTripFeeButton({
  tripId,
  tripGuideId,
  currentFee,
  tripDate,
  leadName,
  onFeeUpdated
}: EditTripFeeButtonProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newFee, setNewFee] = useState(currentFee.toString());
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const feeAmount = parseFloat(newFee);

    if (isNaN(feeAmount) || feeAmount < 0) {
      alert("Please enter a valid fee amount");
      return;
    }

    if (!reason.trim()) {
      alert("Please provide a reason for the fee adjustment");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/trip-guides/${tripGuideId}/fee`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feeAmount, reason: reason.trim() })
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error);
      }

      setIsEditing(false);
      setReason("");
      onFeeUpdated();
    } catch (error: any) {
      alert('Error updating fee: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  if (!isEditing) {
    return (
      <button
        className="btn ghost"
        onClick={() => setIsEditing(true)}
        style={{
          fontSize: '0.75rem',
          padding: '4px 8px',
          marginTop: 4
        }}
      >
        Edit Fee
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setIsEditing(false);
          setNewFee(currentFee.toString());
          setReason("");
        }
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: 500,
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginBottom: 16 }}>Edit Trip Fee</h3>

        <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f3f4f6', borderRadius: 6 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>
            {new Date(tripDate).toLocaleDateString()} — {leadName}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>
            Current Fee: R {currentFee.toFixed(2)}
          </div>
        </div>

        <div className="stack">
          <div>
            <label className="label">New Fee Amount (R)</label>
            <input
              type="number"
              className="input"
              value={newFee}
              onChange={(e) => setNewFee(e.target.value)}
              step="0.01"
              min="0"
              placeholder="Enter new fee amount"
              disabled={saving}
            />
          </div>

          <div>
            <label className="label">Reason for Adjustment *</label>
            <textarea
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="E.g., Price change, special arrangement, correction..."
              disabled={saving}
            />
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
              This reason will be recorded in the audit log
            </div>
          </div>

          <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button
              className="btn ghost"
              onClick={() => {
                setIsEditing(false);
                setNewFee(currentFee.toString());
                setReason("");
              }}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="btn"
              onClick={handleSave}
              disabled={saving || !reason.trim()}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
