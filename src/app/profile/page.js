'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { getUserStatsAction } from '../actions/leaderboardActions';
import { updateProfileAction, changePasswordAction } from '../actions/authActions';

const AVATAR_COLORS = [
  '#c9a84c', '#e05252', '#52a8e0', '#52e09a',
  '#e052c9', '#e0a052', '#8052e0', '#52e0e0'
];

const formatINR = n => (n >= 0 ? '+₹' : '-₹') + Math.abs(Number(n)).toLocaleString('en-IN');

export default function ProfilePage() {
  const { user, loading: authLoading, updateUser, logout } = useAuth();
  const router = useRouter();
  const [results, setResults] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [toast, setToast] = useState(null);

  // Edit state
  const [isPrivate, setIsPrivate] = useState(false);
  const [avatarColor, setAvatarColor] = useState('#c9a84c');
  const [saving, setSaving] = useState(false);

  // Password change
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (user) {
      setIsPrivate(user.isPrivate || false);
      setAvatarColor(user.avatarColor || '#c9a84c');
      getUserStatsAction(user._id, user._id).then(res => {
        if (!res.error && res.results) setResults(res.results);
        setLoadingStats(false);
      });
    }
  }, [user, authLoading, router]);

  const handleSaveProfile = async () => {
    setSaving(true);
    const result = await updateProfileAction(user._id, { isPrivate, avatarColor });
    setSaving(false);
    if (result.error) {
      showToast(result.error, 'error');
    } else {
      updateUser(result.user);
      showToast('Profile updated!');
    }
  };

  const handleChangePassword = async e => {
    e.preventDefault();
    setPwError('');
    if (pwForm.next !== pwForm.confirm) { setPwError('New passwords do not match'); return; }
    if (pwForm.next.length < 4) { setPwError('New password must be at least 4 characters'); return; }
    setPwLoading(true);
    const result = await changePasswordAction(user._id, pwForm.current, pwForm.next);
    setPwLoading(false);
    if (result.error) {
      setPwError(result.error);
    } else {
      setPwForm({ current: '', next: '', confirm: '' });
      showToast('Password changed!');
    }
  };

  if (authLoading || !user) return null;

  const winRate = user.sessionsPlayed > 0 ? Math.round((user.sessionsWon / user.sessionsPlayed) * 100) : 0;

  return (
    <div className="page">
      <div className="bg-orb bg-orb-gold" style={{ opacity: 0.35 }} />

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div className="avatar" style={{ width: '60px', height: '60px', fontSize: '26px', background: user.avatarColor || '#c9a84c', color: '#0a0a0f', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: '900', border: '2px solid rgba(201,168,76,0.3)' }}>
            {user.username?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="section-badge">♣ Profile</div>
            <h1 className="page-title" style={{ marginTop: '4px' }}>{user.username}</h1>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => { logout(); router.push('/login'); }}>
          Exit ♠
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '32px' }}>
        {[
          { label: 'Total P/L', value: formatINR(user.totalProfit || 0), color: (user.totalProfit || 0) >= 0 ? '#22c55e' : '#ef4444' },
          { label: 'Sessions', value: user.sessionsPlayed || 0, color: 'var(--color-gold)' },
          { label: 'Won', value: user.sessionsWon || 0, color: '#22c55e' },
          { label: 'Win Rate', value: `${winRate}%`, color: 'var(--text-secondary)' },
        ].map(s => (
          <div key={s.label} className="card">
            <div className="card-body" style={{ padding: '16px 18px' }}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.color, marginTop: '4px', fontSize: '20px' }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {/* Avatar Color Picker */}
        <div className="card">
          <div className="card-body">
            <h3 className="card-title" style={{ marginBottom: '16px' }}>♠ Appearance</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {AVATAR_COLORS.map(c => (
                <div
                  key={c}
                  onClick={() => setAvatarColor(c)}
                  style={{
                    width: '36px', height: '36px', borderRadius: '50%', background: c,
                    cursor: 'pointer', border: avatarColor === c ? '3px solid white' : '3px solid transparent',
                    boxShadow: avatarColor === c ? '0 0 10px rgba(255,255,255,0.4)' : 'none',
                    transition: 'all 0.15s'
                  }}
                />
              ))}
            </div>

            {/* Privacy toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', padding: '12px 0', borderTop: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>Private Profile</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Hide your P&L from leaderboard</div>
              </div>
              <button
                onClick={() => setIsPrivate(p => !p)}
                style={{
                  width: '44px', height: '24px', borderRadius: '12px',
                  background: isPrivate ? 'var(--color-gold)' : 'var(--border)',
                  border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s'
                }}
              >
                <span style={{
                  position: 'absolute', top: '3px',
                  left: isPrivate ? '23px' : '3px',
                  width: '18px', height: '18px', borderRadius: '50%',
                  background: 'white', transition: 'left 0.2s'
                }} />
              </button>
            </div>

            <button className="btn btn-primary w-full" onClick={handleSaveProfile} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Password Change */}
        <div className="card">
          <div className="card-body">
            <h3 className="card-title" style={{ marginBottom: '16px' }}>♦ Change Password</h3>
            {pwError && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: '#ef4444', fontSize: '13px', marginBottom: '14px', fontFamily: 'var(--font-display)', fontWeight: '600' }}>
                {pwError}
              </div>
            )}
            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input type="password" className="form-input" placeholder="••••••••" value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input type="password" className="form-input" placeholder="Min 4 characters" value={pwForm.next} onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input type="password" className="form-input" placeholder="Repeat new password" value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} required />
              </div>
              <button type="submit" className="btn btn-outline w-full" disabled={pwLoading}>
                {pwLoading ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Session History */}
      <div className="card">
        <div className="card-body">
          <h3 className="card-title" style={{ marginBottom: '16px' }}>♥ Session History</h3>
          {loadingStats ? (
            <div style={{ textAlign: 'center', padding: '30px' }}>
              <div className="loading-spinner" style={{ margin: '0 auto' }} />
            </div>
          ) : results.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '20px' }}>No session history yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {results.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{r.sessionName}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Buy-in: ₹{Number(r.buyIn).toLocaleString('en-IN')} → Cash-out: ₹{Number(r.cashOut).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '900', color: r.profit >= 0 ? '#22c55e' : '#ef4444' }}>
                    {r.profit >= 0 ? '+' : ''}₹{Number(r.profit).toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
