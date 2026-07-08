'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { getMySessionsAction, joinSessionAction } from '../actions/sessionActions';
import { getMyGroupsAction } from '../actions/groupActions';

const formatINR = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'Just now';
};

// Get this user's P/L for an ended session
function getMyProfitLoss(session, userId) {
  const player = (session.players || []).find(
    p => p.user === userId || p.user?.toString?.() === userId
  );
  if (!player || player.finalStack == null) return null;
  return player.finalStack - (player.totalBuyIn || 0);
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) {
      Promise.all([
        getMySessionsAction(user._id),
        getMyGroupsAction(user._id)
      ])
        .then(([sessionsRes, groupsRes]) => {
          if (!sessionsRes.error) setSessions(sessionsRes.sessions);
          if (!groupsRes.error) setGroups(groupsRes.groups);
        })
        .finally(() => setLoading(false));
    }
  }, [user, authLoading, router]);

  const handleJoin = async e => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    setJoinError('');
    const result = await joinSessionAction(user._id, joinCode.trim());
    if (result.error) {
      setJoinError(result.error);
      setJoining(false);
    } else {
      router.push(`/session/${joinCode.trim().toUpperCase()}`);
    }
  };

  if (authLoading || !user) return null;

  const activeSessions = sessions.filter(s => s.status === 'active');
  const pastSessions = sessions.filter(s => s.status === 'ended');

  return (
    <div className="page">
      <div className="bg-orb bg-orb-gold" style={{ opacity: 0.4 }} />

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="section-badge">♠ Dashboard</div>
          <h1 className="page-title">Welcome, {user.username}</h1>
          <p className="text-secondary" style={{ marginTop: '6px', fontSize: '14px' }}>
            {activeSessions.length > 0
              ? `${activeSessions.length} active session${activeSessions.length !== 1 ? 's' : ''}`
              : 'No active sessions'}
          </p>
        </div>
        <Link href="/session/create" className="btn btn-primary">
          ♠ New Session
        </Link>
      </div>

      {/* Overall user stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        {[
          { label: 'Total P/L', value: formatINR(user.totalProfit || 0), color: (user.totalProfit || 0) >= 0 ? '#22c55e' : '#ef4444' },
          { label: 'Sessions Played', value: user.sessionsPlayed || 0, color: 'var(--color-gold)' },
          { label: 'Sessions Won', value: user.sessionsWon || 0, color: '#22c55e' },
          { label: 'Win Rate', value: user.sessionsPlayed ? Math.round((user.sessionsWon / user.sessionsPlayed) * 100) + '%' : '—', color: 'var(--text-secondary)' }
        ].map(s => (
          <div key={s.label} className="card">
            <div className="card-body" style={{ padding: '18px 20px' }}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.color, marginTop: '6px', fontSize: '22px' }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '32px' }}>
        {[
          { label: 'Highest Win', value: formatINR(user.highestWin || 0), color: '#22c55e' },
          { label: 'Highest Loss', value: formatINR(user.highestLoss || 0), color: '#ef4444' }
        ].map(s => (
          <div key={s.label} className="card">
            <div className="card-body" style={{ padding: '18px 20px' }}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.color, marginTop: '6px', fontSize: '22px' }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Join Session */}
      <div className="card" style={{ marginBottom: '32px' }}>
        <div className="card-body">
          <h3 className="card-title" style={{ marginBottom: '14px' }}>♦ Join a Session</h3>
          <form onSubmit={handleJoin} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input
              id="joinCode"
              type="text"
              className="form-input"
              style={{ flex: '1', minWidth: '180px', fontFamily: 'var(--font-mono)', letterSpacing: '0.2em', textTransform: 'uppercase' }}
              placeholder="ROOM CODE"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
            />
            <button type="submit" className="btn btn-primary" disabled={joining || !joinCode.trim()}>
              {joining ? 'Joining...' : 'Join ♠'}
            </button>
          </form>
          {joinError && <p className="form-error" style={{ marginTop: '8px' }}>✕ {joinError}</p>}
        </div>
      </div>

      {/* Your Groups */}
      <section style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>
            Your Groups
          </h2>
          <Link href="/groups" className="btn btn-ghost btn-sm">Manage Groups →</Link>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
          </div>
        ) : groups.length === 0 ? (
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', padding: '32px 20px' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '14px' }}>
                You're not in any groups yet. Join or create one to start a session.
              </p>
              <Link href="/groups" className="btn btn-primary btn-sm">♥ Go to Groups</Link>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
            {groups.map(g => {
              const myStat = (g.memberStats || []).find(
                s => s.user === user._id || s.user?._id === user._id || s.user?.toString?.() === user._id
              );
              return (
                <Link key={g._id} href={`/groups/${g._id}`} style={{ textDecoration: 'none' }}>
                  <div className="card" style={{ cursor: 'pointer' }}>
                    <div className="card-body">
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '10px' }}>
                        ♥ {g.name}
                      </div>
                      <div style={{ display: 'flex', gap: '10px', fontSize: '12px' }}>
                        <div style={{ flex: 1, textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontFamily: 'var(--font-display)', fontWeight: '700', color: myStat?.totalProfit >= 0 ? '#22c55e' : '#ef4444' }}>
                            {formatINR(myStat?.totalProfit || 0)}
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '2px' }}>Your P/L</div>
                        </div>
                        <div style={{ flex: 1, textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontFamily: 'var(--font-display)', fontWeight: '700', color: 'var(--color-gold)' }}>
                            {g.members?.length || 0}
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '2px' }}>Members</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Sessions */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
          <p>Loading sessions...</p>
        </div>
      ) : (
        <>
          {activeSessions.length > 0 && (
            <section style={{ marginBottom: '32px' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                Active Sessions
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
                {activeSessions.map(s => <SessionCard key={s._id} session={s} userId={user._id} />)}
              </div>
            </section>
          )}

          {pastSessions.length > 0 && (
            <section>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                Past Sessions
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
                {pastSessions.map(s => <SessionCard key={s._id} session={s} userId={user._id} />)}
              </div>
            </section>
          )}

          {sessions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '20px', color: 'var(--color-gold)' }}>♠</div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                No sessions yet
              </p>
              <p style={{ marginBottom: '24px', fontSize: '14px' }}>Create your first poker session or join one with a room code.</p>
              <Link href="/session/create" className="btn btn-primary">♠ Create Session</Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SessionCard({ session, userId }) {
  const isAdmin = session.admin === userId || session.admin?._id === userId;
  const isActive = session.status === 'active';
  const myPL = !isActive ? getMyProfitLoss(session, userId) : null;

  return (
    <Link href={`/session/${session.roomCode}`} style={{ textDecoration: 'none' }}>
      <div className="card" style={{ cursor: 'pointer' }}>
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                {session.name}
              </div>
              {session.group && <div className="badge badge-gold">{session.group.name}</div>}
            </div>
            <span className={`badge ${isActive ? 'badge-active' : 'badge-gray'}`}>
              {isActive ? '● Live' : '✓ Ended'}
            </span>
          </div>

          {isActive ? (
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1, textAlign: 'center', padding: '10px', background: 'rgba(201,168,76,0.06)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: '700', color: 'var(--color-gold)', letterSpacing: '0.15em' }}>
                  {session.roomCode}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '2px', fontFamily: 'var(--font-display)' }}>Room</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {session.players?.length || 0}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '2px', fontFamily: 'var(--font-display)' }}>Players</div>
              </div>
            </div>
          ) : (
            // Past session: show only this user's profit/loss, never room code or stack details
            <div style={{ textAlign: 'center', padding: '14px', marginBottom: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px', fontFamily: 'var(--font-display)' }}>
                Your Result
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '900', color: myPL == null ? 'var(--text-muted)' : myPL > 0 ? '#22c55e' : myPL < 0 ? '#ef4444' : 'var(--text-muted)' }}>
                {myPL == null ? '—' : (myPL > 0 ? '+' : '') + formatINR(myPL)}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {isActive ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Bank: ₹{Number(session.currentBank || 0).toLocaleString('en-IN')}
              </div>
            ) : <div />}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {isAdmin && <span className="badge badge-gold">Admin</span>}
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {formatRelativeTime(session.startedAt)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}