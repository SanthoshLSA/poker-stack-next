'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { createSessionAction } from '../../actions/sessionActions';

export default function CreateSessionPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', initialBank: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  if (authLoading || !user) return null;

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (!form.name || form.name.trim().length < 2) { setError('Session name must be at least 2 characters'); return; }
    if (!form.initialBank || Number(form.initialBank) < 1) { setError('Initial bank must be at least ₹1'); return; }

    setLoading(true);
    const result = await createSessionAction(user._id, {
      name: form.name,
      initialBank: Number(form.initialBank)
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

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Session Name ♠</label>
              <input
                id="name"
                name="name"
                type="text"
                className="form-input"
                placeholder="Friday Night Grind"
                value={form.name}
                onChange={handleChange}
                maxLength={50}
                required
              />
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Give your session a memorable name
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Initial Bank (₹) ♦</label>
              <input
                id="initialBank"
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
                Total chips in play. Used to verify conservation throughout the session.
              </p>
            </div>

            {/* Info box */}
            <div style={{ padding: '14px 16px', background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: '700', color: 'var(--color-gold)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
                How it works
              </div>
              <ul style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.7', paddingLeft: '16px' }}>
                <li>You'll get a unique 6-character room code</li>
                <li>Share it with players to join your session</li>
                <li>As admin, record all buy-ins and rebuys</li>
                <li>End the session to save final results</li>
              </ul>
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? 'Creating...' : '♠ Create Session'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
