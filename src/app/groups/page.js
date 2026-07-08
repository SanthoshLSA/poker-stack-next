'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { getMyGroupsAction, createGroupAction, joinGroupAction, getGroupDetailAction } from '../actions/groupActions';

const formatINR = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const formatPL = n => {
  const v = Number(n || 0);
  return (v >= 0 ? '+₹' : '-₹') + Math.abs(v).toLocaleString('en-IN');
};
const medals = ['🥇', '🥈', '🥉'];

export default function GroupsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [joinCode, setJoinCode] = useState('');
  const [toast, setToast] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (user) {
      getMyGroupsAction(user._id).then(res => {
        if (!res.error) setGroups(res.groups || []);
        setLoading(false);
      });
    }
  }, [user, authLoading, router]);

  const handleCreate = async e => {
    e.preventDefault();
    if (!createForm.name.trim()) { showToast('Group name is required', 'error'); return; }
    setSubmitLoading(true);
    const result = await createGroupAction(user._id, createForm);
    setSubmitLoading(false);
    if (result.error) { showToast(result.error, 'error'); return; }
    setGroups(prev => [result.group, ...prev]);
    setCreateForm({ name: '', description: '' });
    setShowCreate(false);
    showToast(`Group "${result.group.name}" created! Code: ${result.group.inviteCode}`);
  };

  const handleJoin = async e => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setSubmitLoading(true);
    const result = await joinGroupAction(user._id, joinCode.trim());
    setSubmitLoading(false);
    if (result.error) { showToast(result.error, 'error'); return; }
    setGroups(prev => {
      const exists = prev.find(g => g._id === result.group._id);
      return exists ? prev.map(g => g._id === result.group._id ? result.group : g) : [result.group, ...prev];
    });
    setJoinCode('');
    setShowJoin(false);
    showToast(result.message || 'Joined!');
  };

  const openGroup = async (groupId) => {
    const result = await getGroupDetailAction(user._id, groupId);
    if (!result.error) setSelectedGroup(result.group);
    else showToast(result.error, 'error');
  };

  if (authLoading || !user) return null;

  // ── Group Detail View ──────────────────────────────────────────────────────
  if (selectedGroup) {
    const sorted = [...(selectedGroup.memberStats || [])].sort((a, b) => (b.totalProfit || 0) - (a.totalProfit || 0));
    const isOwner = selectedGroup.creator === user._id || selectedGroup.creator?.toString() === user._id;

    return (
      <div className="page">
        <div className="bg-orb bg-orb-red" style={{ opacity: 0.25 }} />

        {toast && (
          <div className="toast-container">
            <div className={`toast toast-${toast.type}`}>{toast.type === 'success' ? '✓' : '✕'} {toast.msg}</div>
          </div>
        )}

        <div className="page-header">
          <div>
            <button className="btn btn-ghost btn-sm" style={{ marginBottom: '12px' }} onClick={() => setSelectedGroup(null)}>
              ← Back to Groups
            </button>
            <div className="section-badge">♥ Group</div>
            <h1 className="page-title">{selectedGroup.name}</h1>
            {selectedGroup.description && <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>{selectedGroup.description}</p>}
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
              {selectedGroup.members?.length || 0} members • {selectedGroup.totalSessions || 0} sessions
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
            <Link href="/session/create" className="btn btn-primary">♠ New Session</Link>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
              onClick={() => { navigator.clipboard.writeText(selectedGroup.inviteCode); showToast('Invite code copied!'); }}
              title="Click to copy"
            >
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Code</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--color-gold)', letterSpacing: '0.2em', fontSize: '16px' }}>{selectedGroup.inviteCode}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Copy</span>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="card">
          <div className="card-body" style={{ padding: '16px 12px' }}>
            <h3 className="card-title" style={{ marginBottom: '20px', paddingLeft: '8px' }}>♦ Group Leaderboard</h3>

            {sorted.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '20px' }}>No stats yet. Play some sessions!</p>
            ) : (
              <div className="leaderboard-table-container">
                <div style={{ minWidth: '700px' }}>
                  {/* Header row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 100px 80px 80px 100px 100px', gap: '8px', padding: '0 12px 10px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '4px' }}>
                    {['#', 'Player', 'Total P/L', 'Sessions', 'Wins', 'Best Win', 'Worst Loss'].map(h => (
                      <div key={h} style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: h === 'Player' || h === '#' ? 'left' : 'right' }}>{h}</div>
                    ))}
                  </div>

                  {sorted.map((s, i) => {
                    const isMe = s.user === user._id || s.user?.toString() === user._id;
                    const winRate = s.sessionsPlayed > 0 ? Math.round(((s.sessionsWon || 0) / s.sessionsPlayed) * 100) : 0;

                    return (
                      <div key={String(s.user)} style={{
                        display: 'grid', gridTemplateColumns: '40px 1fr 100px 80px 80px 100px 100px',
                        gap: '8px', padding: '12px',
                        background: isMe ? 'rgba(201,168,76,0.04)' : 'transparent',
                        borderRadius: 'var(--radius-md)',
                        borderBottom: '1px solid var(--border-subtle)',
                        alignItems: 'center'
                      }}>
                        {/* Rank */}
                        <div style={{ textAlign: 'left' }}>
                          {i < 3
                            ? <span style={{ fontSize: '18px' }}>{medals[i]}</span>
                            : <span style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)' }}>#{i + 1}</span>}
                        </div>

                        {/* Player */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div className="avatar avatar-sm" style={{ background: s.avatarColor || '#c9a84c', color: '#0a0a0f', flexShrink: 0 }}>
                            {s.username?.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', color: isMe ? 'var(--color-gold)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.username} {isMe && '(You)'}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{winRate}% win rate</div>
                          </div>
                        </div>

                        {/* Total P/L */}
                        <div style={{ textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '900', color: (s.totalProfit || 0) >= 0 ? '#22c55e' : '#ef4444' }}>
                          {formatPL(s.totalProfit)}
                        </div>

                        {/* Sessions */}
                        <div style={{ textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', color: 'var(--color-gold)' }}>
                          {s.sessionsPlayed || 0}
                        </div>

                        {/* Wins */}
                        <div style={{ textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', color: '#22c55e' }}>
                          {s.sessionsWon || 0}
                        </div>

                        {/* Best win */}
                        <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#22c55e' }}>
                          {(s.highestWin || 0) > 0 ? '+' + formatINR(s.highestWin) : '—'}
                        </div>

                        {/* Worst loss */}
                        <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#ef4444' }}>
                          {(s.highestLoss || 0) < 0 ? '-' + formatINR(Math.abs(s.highestLoss)) : '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Groups List View ───────────────────────────────────────────────────────
  return (
    <div className="page">
      <div className="bg-orb bg-orb-red" style={{ opacity: 0.3 }} />

      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.type === 'success' ? '✓' : '✕'} {toast.msg}</div>
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="section-badge">♥ Groups</div>
          <h1 className="page-title">Your Circles</h1>
          <p className="text-secondary" style={{ marginTop: '6px', fontSize: '14px' }}>Private poker groups with per-group leaderboards</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => { setShowJoin(true); setShowCreate(false); }}>♦ Join Group</button>
          <button className="btn btn-primary" onClick={() => { setShowCreate(true); setShowJoin(false); }}>♥ Create Group</button>
        </div>
      </div>

      {showCreate && (
        <div className="card animate-in" style={{ marginBottom: '24px' }}>
          <div className="card-body">
            <h3 className="card-title" style={{ marginBottom: '16px' }}>♥ Create New Group</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Group Name</label>
                <input type="text" className="form-input" placeholder="The Poker Den" value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} maxLength={50} required />
              </div>
              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <input type="text" className="form-input" placeholder="Friday night crew" value={createForm.description} onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))} maxLength={200} />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" className="btn btn-primary" disabled={submitLoading}>{submitLoading ? 'Creating...' : 'Create Group'}</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showJoin && (
        <div className="card animate-in" style={{ marginBottom: '24px' }}>
          <div className="card-body">
            <h3 className="card-title" style={{ marginBottom: '16px' }}>♦ Join a Group</h3>
            <form onSubmit={handleJoin} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input type="text" className="form-input" style={{ flex: 1, minWidth: '160px', fontFamily: 'var(--font-mono)', letterSpacing: '0.2em', textTransform: 'uppercase' }} placeholder="INVITE CODE" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={6} />
              <button type="submit" className="btn btn-primary" disabled={submitLoading || !joinCode.trim()}>{submitLoading ? '...' : '♦ Join'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowJoin(false)}>Cancel</button>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
        </div>
      ) : groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '32px', marginBottom: '20px', color: 'var(--color-gold)' }}>♥</div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>No groups yet</p>
          <p style={{ marginBottom: '24px', fontSize: '14px' }}>Create a private circle or join one with an invite code.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {groups.map(g => {
            const myStats = (g.memberStats || []).find(s => s.user === user._id || s.user?.toString() === user._id);
            const isOwner = g.creator === user._id || g.creator?.toString() === user._id;
            const topPlayer = [...(g.memberStats || [])].sort((a, b) => (b.totalProfit || 0) - (a.totalProfit || 0))[0];

            return (
              <div key={g._id} className="card" style={{ cursor: 'pointer' }} onClick={() => openGroup(g._id)}>
                <div className="card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px' }}>{g.name}</h3>
                      {g.description && <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{g.description}</p>}
                    </div>
                    <span style={{ fontSize: '20px', color: 'var(--color-gold)' }}>♥</span>
                  </div>

                  {/* My stats in this group */}
                  {myStats && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                      {[
                        { label: 'My P/L', value: formatPL(myStats.totalProfit || 0), color: (myStats.totalProfit || 0) >= 0 ? '#22c55e' : '#ef4444' },
                        { label: 'Sessions', value: myStats.sessionsPlayed || 0, color: 'var(--color-gold)' },
                        { label: 'Wins', value: myStats.sessionsWon || 0, color: '#22c55e' },
                      ].map(st => (
                        <div key={st.label} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{st.label}</div>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '800', color: st.color, marginTop: '3px' }}>{st.value}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {g.members?.length || 0} members • {g.totalSessions || 0} sessions
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {isOwner && <span className="badge badge-gold" style={{ fontSize: '10px' }}>Owner</span>}
                      <span className="badge badge-gray" style={{ fontSize: '10px' }}>View →</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
