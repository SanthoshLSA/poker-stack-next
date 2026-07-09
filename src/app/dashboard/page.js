'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { getMySessionsAction, joinSessionAction } from '../actions/sessionActions';
import { getMyGroupsAction } from '../actions/groupActions';
import { getMeAction } from '../actions/authActions';

const formatINR = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const formatPL = n => {
  const v = Number(n || 0);
  return (v >= 0 ? '+₹' : '-₹') + Math.abs(v).toLocaleString('en-IN');
};
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

export default function DashboardPage() {
  const { user, loading: authLoading, updateUser } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (user) {
      Promise.all([
        getMySessionsAction(user._id),
        getMyGroupsAction(user._id),
        getMeAction(user._id)
      ]).then(([sessRes, grpRes, meRes]) => {
        if (!sessRes.error) setSessions(sessRes.sessions);
        if (!grpRes.error) setGroups(grpRes.groups);
        if (!meRes.error) updateUser(meRes.user);
        setLoading(false);
      });
    }
  }, [user, authLoading, router]);

  const handleJoin = async e => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    setJoinError('');
    const result = await joinSessionAction(user._id, joinCode.trim());
    if (result.error) { setJoinError(result.error); setJoining(false); }
    else router.push(`/session/${joinCode.trim().toUpperCase()}`);
  };

  if (authLoading || !user) return null;

  const activeSessions = sessions.filter(s => s.status === 'active');
  const pastSessions = sessions.filter(s => s.status === 'ended');
  const winRate = user.sessionsPlayed > 0 ? Math.round(((user.sessionsWon || 0) / user.sessionsPlayed) * 100) : 0;

  return (
    <div className="page">
      <div className="bg-orb bg-orb-gold" style={{ opacity: 0.4 }} />

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="section-badge">♠ Dashboard</div>
          <h1 className="page-title">Welcome, {user.username}</h1>
          <p className="text-secondary" style={{ marginTop: '6px', fontSize: '14px' }}>
            {activeSessions.length > 0 ? `${activeSessions.length} active session${activeSessions.length !== 1 ? 's' : ''}` : 'No active sessions'}
          </p>
        </div>
        <Link href="/session/create" className="btn btn-primary">♠ New Session</Link>
      </div>

      {/* ── Overall Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '28px' }}>
        {[
          { label: 'Total P/L', value: formatPL(user.totalProfit), color: (user.totalProfit || 0) >= 0 ? '#22c55e' : '#ef4444' },
          { label: 'Sessions', value: user.sessionsPlayed || 0, color: 'var(--color-gold)' },
          { label: 'Won', value: user.sessionsWon || 0, color: '#22c55e' },
          { label: 'Win Rate', value: `${winRate}%`, color: 'var(--text-secondary)' },
          { label: 'Best Win', value: formatINR(user.highestWin || 0), color: '#22c55e' },
          { label: 'Worst Loss', value: formatINR(Math.abs(user.highestLoss || 0)), color: '#ef4444' },
        ].map(s => (
          <div key={s.label} className="card">
            <div className="card-body" style={{ padding: '16px 18px' }}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.color, marginTop: '4px', fontSize: '20px' }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Groups ── */}
      {groups.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>
              ♥ Your Groups
            </h2>
            <Link href="/groups" className="btn btn-ghost btn-sm">View All</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
            {groups.map(g => {
              const myStats = (g.memberStats || []).find(s => s.user === user._id || s.user?.toString() === user._id);
              return (
                <div key={g._id} className="card">
                  <div className="card-body" style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{g.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{g.members?.length || 0} members</div>
                      </div>
                      <span style={{ fontSize: '18px', color: 'var(--color-gold)' }}>♥</span>
                    </div>
                    {myStats && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {[
                          { label: 'P/L', value: formatPL(myStats.totalProfit || 0), color: (myStats.totalProfit || 0) >= 0 ? '#22c55e' : '#ef4444' },
                          { label: 'Sessions', value: myStats.sessionsPlayed || 0, color: 'var(--color-gold)' },
                        ].map(st => (
                          <div key={st.label} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{st.label}</div>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '800', color: st.color, marginTop: '3px' }}>{st.value}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Random Poker Hand Card ── */}
      <PokerHandDealer />

      {/* ── Join Session ── */}
      <div className="card" style={{ marginBottom: '32px' }}>
        <div className="card-body">
          <h3 className="card-title" style={{ marginBottom: '14px' }}>♦ Join a Session</h3>
          <form onSubmit={handleJoin} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input
              id="joinCode" type="text" className="form-input"
              style={{ flex: '1', minWidth: '180px', fontFamily: 'var(--font-mono)', letterSpacing: '0.2em', textTransform: 'uppercase' }}
              placeholder="ROOM CODE" value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={6}
            />
            <button type="submit" className="btn btn-primary" disabled={joining || !joinCode.trim()}>
              {joining ? 'Joining...' : 'Join ♠'}
            </button>
          </form>
          {joinError && <p className="form-error" style={{ marginTop: '8px' }}>✕ {joinError}</p>}
        </div>
      </div>

      {/* ── Sessions ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
          <p>Loading...</p>
        </div>
      ) : (
        <>
          {activeSessions.length > 0 && (
            <section style={{ marginBottom: '32px' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                Active Sessions
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
                {activeSessions.map(s => <SessionCard key={s._id} session={s} userId={user._id} isActive />)}
              </div>
            </section>
          )}

          {pastSessions.length > 0 && (
            <section>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                Past Sessions
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
                {pastSessions.map(s => <SessionCard key={s._id} session={s} userId={user._id} isActive={false} />)}
              </div>
            </section>
          )}

          {sessions.length === 0 && groups.length > 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '16px', color: 'var(--color-gold)' }}>♠</div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>No sessions yet</p>
              <p style={{ marginBottom: '20px', fontSize: '14px' }}>Create your first session within a group.</p>
              <Link href="/session/create" className="btn btn-primary">♠ Create Session</Link>
            </div>
          )}

          {sessions.length === 0 && groups.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '16px', color: 'var(--color-gold)' }}>♥</div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>No groups yet</p>
              <p style={{ marginBottom: '20px', fontSize: '14px' }}>Join or create a group to start playing.</p>
              <Link href="/groups" className="btn btn-primary">♥ Go to Groups</Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SessionCard({ session, userId, isActive }) {
  const isAdmin = session.admin === userId || session.admin?._id === userId;

  // For past sessions find my P/L
  const myPlayer = session.players?.find(p => p.user === userId || p.user?._id === userId);
  const myPL = myPlayer && !isActive && myPlayer.finalStack != null
    ? myPlayer.finalStack - (myPlayer.totalBuyIn || 0)
    : null;

  return (
    <Link href={`/session/${session.roomCode}`} style={{ textDecoration: 'none' }}>
      <div className="card" style={{ cursor: 'pointer' }}>
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>{session.name}</div>
              {session.group && <div className="badge badge-gold">{session.group.name}</div>}
            </div>
            <span className={`badge ${isActive ? 'badge-active' : 'badge-gray'}`}>
              {isActive ? '● Live' : '✓ Ended'}
            </span>
          </div>

          {isActive ? (
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1, textAlign: 'center', padding: '10px', background: 'rgba(201,168,76,0.06)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: '700', color: 'var(--color-gold)', letterSpacing: '0.15em' }}>{session.roomCode}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '2px', fontFamily: 'var(--font-display)' }}>Room Code</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>{session.players?.length || 0}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '2px', fontFamily: 'var(--font-display)' }}>Players</div>
              </div>
            </div>
          ) : (
            /* Past session: show my P/L */
            myPL !== null && (
              <div style={{ textAlign: 'center', padding: '12px', background: myPL >= 0 ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', borderRadius: 'var(--radius-md)', border: `1px solid ${myPL >= 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, marginBottom: '12px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '900', color: myPL >= 0 ? '#22c55e' : '#ef4444' }}>
                  {myPL >= 0 ? '+' : ''}{formatINR(myPL)}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '2px', fontFamily: 'var(--font-display)' }}>
                  {myPL > 0 ? 'Won' : myPL < 0 ? 'Lost' : 'Broke Even'}
                </div>
              </div>
            )
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {isActive ? `Bank: ${formatINR(session.currentBank)}` : `${session.players?.length || 0} players`}
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {isAdmin && <span className="badge badge-gold">Admin</span>}
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatRelativeTime(session.startedAt)}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Poker Hand Dealer Component ─────────────────────────────────────────────
function PokerHandDealer() {
  const [hand, setHand] = useState([]);
  const [handStrength, setHandStrength] = useState('');

  const dealHand = () => {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = [
      { code: '2', val: 2 }, { code: '3', val: 3 }, { code: '4', val: 4 }, { code: '5', val: 5 },
      { code: '6', val: 6 }, { code: '7', val: 7 }, { code: '8', val: 8 }, { code: '9', val: 9 },
      { code: '10', val: 10 }, { code: 'J', val: 11 }, { code: 'Q', val: 12 }, { code: 'K', val: 13 },
      { code: 'A', val: 14 }
    ];

    // Build a fresh deck
    const deck = [];
    for (const s of suits) {
      for (const v of values) {
        deck.push({ suit: s, ...v });
      }
    }

    // Draw 5 random cards
    const result = [];
    for (let i = 0; i < 5; i++) {
      const idx = Math.floor(Math.random() * deck.length);
      result.push(deck.splice(idx, 1)[0]);
    }

    // Sort hand by numeric value
    result.sort((a, b) => a.val - b.val);

    setHand(result);
    setHandStrength(evaluateHand(result));
  };

  useEffect(() => {
    dealHand();
  }, []);

  // Simple standard 5-card evaluation
  const evaluateHand = (cards) => {
    const isFlush = cards.every(c => c.suit === cards[0].suit);
    
    // Check straight (handle standard + low Ace straight)
    let isStraight = false;
    if (cards[4].val - cards[0].val === 4) {
      isStraight = new Set(cards.map(c => c.val)).size === 5;
    } else if (cards[4].val === 14 && cards[0].val === 2 && cards[1].val === 3 && cards[2].val === 4 && cards[3].val === 5) {
      isStraight = true;
    }

    // Group values
    const counts = {};
    cards.forEach(c => counts[c.val] = (counts[c.val] || 0) + 1);
    const countArr = Object.values(counts).sort((a, b) => b - a);

    if (isFlush && isStraight) {
      return cards[4].val === 14 && cards[0].val !== 2 ? '🏆 Royal Flush!' : '🔥 Straight Flush!';
    }
    if (countArr[0] === 4) return 'Four of a Kind';
    if (countArr[0] === 3 && countArr[1] === 2) return 'Full House';
    if (isFlush) return 'Flush';
    if (isStraight) return 'Straight';
    if (countArr[0] === 3) return 'Three of a Kind';
    if (countArr[0] === 2 && countArr[1] === 2) return 'Two Pair';
    if (countArr[0] === 2) return 'One Pair';

    const highCardName = cards[4].code === 'A' ? 'Ace' : cards[4].code === 'K' ? 'King' : cards[4].code === 'Q' ? 'Queen' : cards[4].code === 'J' ? 'Jack' : cards[4].code;
    return `High Card (${highCardName})`;
  };

  return (
    <div className="card" style={{ marginBottom: '32px', background: 'radial-gradient(circle at 50% 50%, rgba(201,168,76,0.08) 0%, var(--color-bg-card) 100%)', border: '1px solid rgba(201,168,76,0.2)' }}>
      <div className="card-body" style={{ textAlign: 'center', padding: '24px 20px' }}>
        <h3 className="card-title" style={{ color: 'var(--color-gold)', marginBottom: '4px' }}>♠ Random Dealer</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>Need luck? Deal a test hand</p>

        {/* Card display */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
          {hand.map((c, idx) => {
            const isRed = c.suit === '♥' || c.suit === '♦';
            return (
              <div
                key={idx}
                style={{
                  width: '54px',
                  height: '80px',
                  background: 'white',
                  borderRadius: '6px',
                  border: '1px solid #ccc',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '6px',
                  color: isRed ? '#e05252' : '#111',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                  animation: `slide-up 0.3s ease both ${idx * 0.05}s`
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 'bold', lineHeight: '1', fontFamily: 'var(--font-display)', textAlign: 'left' }}>
                  {c.code}
                </div>
                <div style={{ fontSize: '24px', alignSelf: 'center', lineHeight: '1' }}>
                  {c.suit}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', lineHeight: '1', fontFamily: 'var(--font-display)', textAlign: 'right', transform: 'rotate(180deg)' }}>
                  {c.code}
                </div>
              </div>
            );
          })}
        </div>

        {/* Strength label */}
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '16px' }}>
          {handStrength || 'Dealing...'}
        </div>

        <button className="btn btn-outline btn-sm" onClick={dealHand}>
          ♦ Shuffle & Deal
        </button>
      </div>
    </div>
  );
}
