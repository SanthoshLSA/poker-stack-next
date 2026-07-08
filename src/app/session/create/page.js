'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { createSessionAction } from '../../actions/sessionActions';
import { getMyGroupsAction } from '../../actions/groupActions';

export default function CreateSessionPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', initialBank: '', groupId: '' });
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      getMyGroupsAction(user._id).then(res => {
        if (res.groups) setGroups(res.groups);
        setGroupsLoading(false);
      });
    }
  }, [user]);

  if (authLoading || !user) return null;

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (!form.name || form.name.trim().length < 2) { setError('Session name must be at least 2 characters'); return; }
    if (!form.initialBank || Number(form.initialBank) < 1) { setError('Initial bank must be at least ₹1'); return; }
    if (!form.groupId) { setError('You must select a group to create a session'); return; }

    setLoading(true);
    const result = await createSessionAction(user._id, {
      name: form.name,
      initialBank: Number(form.initialBank),
      groupId: form.groupId
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push(`/session/${result.session.roomCode}`);
    }
  };

  return (
    <div className="auth-page" style={{ paddingTop: '60px', paddingBottom: '60px' }}>
      <div className="bg-orb bg-orb-gold" style={{ opacity: 0.3 }} />
      <div className="auth-card card animate-in" style={{ maxWidth: '500px' }}>
        <div className="card-body">
          <div className="auth-header">
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '40px', color: 'var(--color-gold)', textShadow: '0 0 20px rgba(201,168,76,0.5)' }}>♣</span>
            <h1 className="auth-title">Create Session</h1>
            <p className="auth-subtitle">Set up a new poker game room</p>
          </div>

          {error && (
            <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: '#ef4444', fontSize: '14px', marginBottom: '20px', fontFamily: 'var(--font-display)', fontWeight: '600' }}>
              {error}
            </div>
          )}

          {!groupsLoading && groups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🃏</div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                You need to be in a group before creating a session.
              </p>
              <button className="btn btn-primary" onClick={() => router.push('/groups')}>
                Go to Groups
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Group ♣</label>
                {groupsLoading ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading groups...</div>
                ) : (
                  <select
                    name="groupId"
                    className="form-input"
                    value={form.groupId}
                    onChange={handleChange}
                    required
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="">Select a group...</option>
                    {groups.map(g => (
                      <option key={g._id} value={g._id}>{g.name}</option>
                    ))}
                  </select>
                )}
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Sessions belong to a group — only members can view them
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Session Name ♠</label>
                <input
                  name="name"
                  type="text"
                  className="form-input"
                  placeholder="Friday Night Grind"
                  value={form.name}
                  onChange={handleChange}
                  maxLength={50}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Initial Bank (₹) ♦</label>
                <input
                  name="initialBank"
                  type="number"
                  className="form-input"
                  placeholder="e.g., 5000"
                  value={form.initialBank}
                  onChange={handleChange}
                  min={1}
                  step={1}
                  required
                />
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Total chips in play. Each player gets ₹200 automatically on joining.
                </p>
              </div>

              <div style={{ padding: '14px 16px', background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: '700', color: 'var(--color-gold)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
                  How it works
                </div>
                <ul style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.7', paddingLeft: '16px' }}>
                  <li>Session is private to your group members only</li>
                  <li>Every player gets ₹200 from the bank on joining</li>
                  <li>Share the room code with group members to join</li>
                  <li>As admin, record buy-ins, rebuys and returns</li>
                </ul>
              </div>

              <button type="submit" className="btn btn-primary w-full" disabled={loading || groupsLoading}>
                {loading ? 'Creating...' : '♠ Create Session'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}