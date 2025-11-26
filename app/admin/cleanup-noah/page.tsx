'use client';
import { useEffect, useState } from 'react';

interface Guide {
  id: string;
  name: string;
  email: string | null;
  rank: string;
  active: boolean;
  hasUser: boolean;
  tripCount: number;
  ledTripCount: number;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  guideId: string | null;
  hasGuide: boolean;
  createdTripCount: number;
}

export default function CleanupNoahPage() {
  const [loading, setLoading] = useState(true);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/cleanup-noah');
      const data = await res.json();
      setGuides(data.guides || []);
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function deleteGuide(guideId: string) {
    if (!confirm('Are you sure you want to delete this guide profile?')) return;

    setWorking(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/cleanup-noah', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_guide', guideIdToDelete: guideId })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(`✓ ${data.message}`);
        await fetchData();
      } else {
        setMessage(`✗ Error: ${data.error}`);
      }
    } catch (error: any) {
      setMessage(`✗ Error: ${error.message}`);
    } finally {
      setWorking(false);
    }
  }

  async function linkUsersToGuide(guideId: string) {
    if (!confirm('Link all Noah users to this guide profile?')) return;

    setWorking(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/cleanup-noah', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'link_user_to_guide', keepGuideId: guideId })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(`✓ ${data.message}`);
        await fetchData();
      } else {
        setMessage(`✗ Error: ${data.error}`);
      }
    } catch (error: any) {
      setMessage(`✗ Error: ${error.message}`);
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <div className="stack"><div className="card">Loading...</div></div>;

  return (
    <div className="stack">
      <h2>Noah Profile Cleanup</h2>

      {message && (
        <div className="card" style={{
          background: message.startsWith('✓') ? '#dcfce7' : '#fee2e2',
          borderColor: message.startsWith('✓') ? '#22c55e' : '#ef4444'
        }}>
          {message}
        </div>
      )}

      <div className="card">
        <h3>Guide Profiles ({guides.length})</h3>
        {guides.length === 0 ? (
          <p>No Noah guide profiles found.</p>
        ) : (
          guides.map(guide => (
            <div key={guide.id} style={{
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '1rem',
              marginBottom: '1rem',
              background: guide.rank === 'SENIOR' ? '#f0fdf4' : '#fff'
            }}>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: 8 }}>
                {guide.name} {guide.rank === 'SENIOR' && '⭐️'}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                <div>ID: {guide.id}</div>
                <div>Email: {guide.email || '(none)'}</div>
                <div>Rank: {guide.rank}</div>
                <div>Active: {guide.active ? 'Yes' : 'No'}</div>
                <div>Has User Account: {guide.hasUser ? 'Yes' : 'No'}</div>
                <div>Trip Count (as guide): {guide.tripCount}</div>
                <div>Trip Count (as leader): {guide.ledTripCount}</div>
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: 8 }}>
                {guide.rank === 'SENIOR' ? (
                  <button
                    className="btn"
                    onClick={() => linkUsersToGuide(guide.id)}
                    disabled={working}
                  >
                    ✓ Link Users to This Guide
                  </button>
                ) : (
                  <button
                    className="btn ghost"
                    onClick={() => deleteGuide(guide.id)}
                    disabled={working}
                    style={{ borderColor: '#dc2626', color: '#dc2626' }}
                  >
                    Delete This Guide
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <h3>User Accounts ({users.length})</h3>
        {users.length === 0 ? (
          <p>No Noah user accounts found.</p>
        ) : (
          users.map(user => (
            <div key={user.id} style={{
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: 8 }}>
                {user.name || '(no name)'}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                <div>ID: {user.id}</div>
                <div>Email: {user.email}</div>
                <div>Role: {user.role}</div>
                <div>Guide ID: {user.guideId || '(not linked)'}</div>
                <div>Has Guide Profile: {user.hasGuide ? 'Yes' : 'No'}</div>
                <div>Created Trips: {user.createdTripCount}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
