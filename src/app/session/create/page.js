'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { createSessionAction } from '../../actions/sessionActions';
import { getMyGroupsAction } from '../../actions/groupActions';

export default function CreateSessionPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', initialBank: '', defaultBuyIn: '200', groupId: '' });
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (user) {
      getMyGroupsAction(user._id).then(res => {
        if (!res.error) {
          setGroups(res.groups || []);
          if (res.groups?.length === 1) {
            setForm(f => ({ ...f, groupId: res.groups[0]._id }));
          }
        }
        setLoadingGroups(false);
      });
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) return null;

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    const buyinVal = Number(form.defaultBuyIn || 200);
    const bankVal = Number(form.initialBank);

    if (!form.name || form.name.trim().length < 2) { setError('Session name must be at least 2 characters'); return; }
    if (buyinVal < 1) { setError('Default buy-in must be at least ₹1'); return; }
    if (!form.initialBank || bankVal < buyinVal) { setError(`Initial bank must be at least default buy-in amount (₹${buyinVal})`); return; }
    if (!form.groupId) { setError('You must select a group'); return; }

    setLoading(true);
    const result = await createSessionAction(user._id, {
      name: form.name,
      initialBank: bankVal,
      defaultBuyIn: buyinVal,
      groupId: form.groupId
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push(`/session/${result.session.roomCode}`);
    }
  };

  if (!loadingGroups && groups.length === 0) {
    return (
      <div className="auth-page">
        <div className="bg-orb bg-orb-gold" style={{ opacity: 0.3 }} />
        <div className="auth-card card animate-in" style={{ maxWidth: '480px', textAlign: 'center' }}>
          <div className="card-body">
            <div style={{ fontSize: '40px', color: 'var(--color-gold)', marginBottom: '16px' }}>♥</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', marginBottom: '12px' }}>You need a group first</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
              Sessions belong to groups. Create or join a group before starting a session.
            </p>
            <button className="btn btn-primary w-full" onClick={() => router.push('/groups')}>
              ♥ Go to Groups
            </button>
          </div>
        </div>
      </div>
    );
  }

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

          <form onSubmit={handleSubmit}>
            {/* Group selector */}
            <div className="form-group">
              <label className="form-label">Group ♥ <span style={{ color: '#ef4444' }}>*</span></label>
              {loadingGroups ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '12px 0' }}>Loading groups...</div>
              ) : (
                <select name="groupId" className="form-input form-select" value={form.groupId} onChange={handleChange} required>
                  <option value="">— Select a group —</option>
                  {groups.map(g => (
                    <option key={g._id} value={g._id}>{g.name}</option>
                  ))}
                </select>
              )}
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Session will be private to this group's members
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Session Name ♠</label>
              <input
                id="name" name="name" type="text" className="form-input"
                placeholder="Friday Night Grind"
                value={form.name} onChange={handleChange}
                maxLength={50} required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Initial Bank (₹) ♦</label>
              <input
                id="initialBank" name="initialBank" type="number" className="form-input"
                placeholder="e.g., 5000"
                value={form.initialBank} onChange={handleChange}
                min={1} step={1} required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Default Buy-In / Auto-Buy-In (₹) ♣</label>
              <input
                id="defaultBuyIn" name="defaultBuyIn" type="number" className="form-input"
                placeholder="e.g., 200"
                value={form.defaultBuyIn} onChange={handleChange}
                min={1} step={1} required
              />
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Each player will automatically receive this amount on join from the bank
              </p>
            </div>

            {/* Info box */}
            <div style={{ padding: '14px 16px', background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: '700', color: 'var(--color-gold)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
                How it works
              </div>
              <ul style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.7', paddingLeft: '16px' }}>
                <li>You get a unique 6-character room code</li>
                <li>Players automatically receive the configured default buy-in amount on join</li>
                <li>Only group members can join</li>
                <li>Stats are tracked within the group</li>
              </ul>
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={loading || loadingGroups}>
              {loading ? 'Creating...' : '♠ Create Session'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
