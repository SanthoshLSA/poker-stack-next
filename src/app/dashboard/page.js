'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { getMySessionsAction, joinSessionAction, migratePastSessionsAction } from '../actions/sessionActions';
import { getMyGroupsAction } from '../actions/groupActions';
import { getMeAction } from '../actions/authActions';
import {
  getChallengeAction,
  addChallengeSessionAction,
  deleteChallengeSessionAction,
  importSessionToChallengeAction
} from '../actions/challengeActions';

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
      // Trigger win recount migration for past sessions once
      const hasMigrated = localStorage.getItem('poker_migrated_breakeven_v1');
      if (!hasMigrated) {
        migratePastSessionsAction(user._id).then(res => {
          if (res.success) {
            localStorage.setItem('poker_migrated_breakeven_v1', 'true');
            getMeAction(user._id).then(meRes => {
              if (!meRes.error) updateUser(meRes.user);
            });
          }
        });
      }

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

        {/* Controls: Create and Join Session */}
        <div className="header-controls">
          <Link href="/session/create" className="btn btn-primary" style={{ height: '38px', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
            ♠ New Session
          </Link>
          
          <form onSubmit={handleJoin} style={{ display: 'flex', gap: '6px', position: 'relative' }}>
            <input
              id="joinCode" type="text" className="form-input"
              style={{ height: '38px', padding: '0 12px', fontFamily: 'var(--font-mono)', letterSpacing: '0.15em', textTransform: 'uppercase', fontSize: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}
              placeholder="JOIN CODE" value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={6}
            />
            <button type="submit" className="btn btn-secondary" style={{ height: '38px', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', padding: '0 14px' }} disabled={joining || !joinCode.trim()}>
              {joining ? '...' : 'Join'}
            </button>
            {joinError && (
              <p className="form-error" style={{ position: 'absolute', top: '100%', right: '0', fontSize: '10px', marginTop: '3px', whiteSpace: 'nowrap', zIndex: 10 }}>
                ✕ {joinError}
              </p>
            )}
          </form>
        </div>
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

      {/* ── Sandeez 30-Session Recovery Challenge ── */}
      {user?.username?.toLowerCase() === 'sandeez' && (
        <SandeezChallengeTracker userId={user._id} pastSessions={pastSessions} />
      )}

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
                <Link key={g._id} href={`/groups?groupId=${g._id}`} style={{ textDecoration: 'none' }}>
                  <div className="card" style={{ cursor: 'pointer', height: '100%' }}>
                    <div className="card-body" style={{ padding: '18px 20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>{g.name}</div>
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
                </Link>
              );
            })}
          </div>
        </section>
      )}

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
            <section style={{ marginBottom: '32px' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                Past Sessions
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
                {pastSessions.map(s => <SessionCard key={s._id} session={s} userId={user._id} isActive={false} />)}
              </div>
            </section>
          )}

          {sessions.length === 0 && groups.length > 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', marginBottom: '32px' }}>
              <div style={{ fontSize: '32px', marginBottom: '16px', color: 'var(--color-gold)' }}>♠</div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>No sessions yet</p>
              <p style={{ marginBottom: '20px', fontSize: '14px' }}>Create your first session within a group.</p>
              <Link href="/session/create" className="btn btn-primary">♠ Create Session</Link>
            </div>
          )}

          {sessions.length === 0 && groups.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', marginBottom: '32px' }}>
              <div style={{ fontSize: '32px', marginBottom: '16px', color: 'var(--color-gold)' }}>♥</div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>No groups yet</p>
              <p style={{ marginBottom: '20px', fontSize: '14px' }}>Join or create a group to start playing.</p>
              <Link href="/groups" className="btn btn-primary">♥ Go to Groups</Link>
            </div>
          )}
        </>
      )}

      {/* ── Random Poker Hand Card ── */}
      <PokerHandDealer />

      {/* ── Blackjack Minigame Card ── */}
      <BlackjackDealer />
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
  const [deck, setDeck] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [computerHand, setComputerHand] = useState([]);
  const [communityCards, setCommunityCards] = useState([]);
  const [revealedCommunityCount, setRevealedCommunityCount] = useState(0); // 0=none, 3=flop, 4=turn, 5=river
  const [equities, setEquities] = useState({ player: 50, computer: 50 });
  const [isDealing, setIsDealing] = useState(false);
  const [rollStates, setRollStates] = useState({ player: [false, false], computer: [false, false], community: [false, false, false, false, false] });

  const suits = ['♠', '♥', '♦', '♣'];
  const codes = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

  // Evaluation helpers
  const getCardNumericValue = (code) => {
    const valMap = { '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, '10':10, 'J':11, 'Q':12, 'K':13, 'A':14 };
    return valMap[code] || 0;
  };

  // Evaluate 5 to 7 cards to find best 5-card hand strength value (higher score = better hand)
  const evaluateSevenCardHand = (cards) => {
    let bestScore = 0;
    let bestName = 'High Card';
    const n = cards.length;

    const eval5 = (fiveCards) => {
      const suitsList = fiveCards.map(c => c.suit);
      const vals = fiveCards.map(c => getCardNumericValue(c.code)).sort((a,b) => a - b);
      
      const isFlush = suitsList.every(s => s === suitsList[0]);
      let isStraight = false;
      if (vals[4] - vals[0] === 4 && new Set(vals).size === 5) {
        isStraight = true;
      } else if (vals[4] === 14 && vals[0] === 2 && vals[1] === 3 && vals[2] === 4 && vals[3] === 5) {
        isStraight = true; // A-2-3-4-5
      }

      const counts = {};
      vals.forEach(v => counts[v] = (counts[v] || 0) + 1);
      const sortedCounts = Object.entries(counts).sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]));
      const countArr = sortedCounts.map(c => c[1]);

      let rank = 1; // High card

      if (isFlush && isStraight) {
        rank = vals[4] === 14 && vals[0] !== 2 ? 10 : 9; // Royal or Straight Flush
      } else if (countArr[0] === 4) {
        rank = 8; // Four of a kind
      } else if (countArr[0] === 3 && countArr[1] === 2) {
        rank = 7; // Full house
      } else if (isFlush) {
        rank = 6; // Flush
      } else if (isStraight) {
        rank = 5; // Straight
      } else if (countArr[0] === 3) {
        rank = 4; // Three of a kind
      } else if (countArr[0] === 2 && countArr[1] === 2) {
        rank = 3; // Two pair
      } else if (countArr[0] === 2) {
        rank = 2; // One pair
      }

      let score = rank * 1000000;
      sortedCounts.forEach((c, idx) => {
        score += Number(c[0]) * Math.pow(15, 4 - idx);
      });

      const names = ['', 'High Card', 'One Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush'];
      return { score, name: names[rank] };
    };

    for (let a = 0; a < n - 4; a++) {
      for (let b = a + 1; b < n - 3; b++) {
        for (let c = b + 1; c < n - 2; c++) {
          for (let d = c + 1; d < n - 1; d++) {
            for (let e = d + 1; e < n; e++) {
              const res = eval5([cards[a], cards[b], cards[c], cards[d], cards[e]]);
              if (res.score > bestScore) {
                bestScore = res.score;
                bestName = res.name;
              }
            }
          }
        }
      }
    }
    return { score: bestScore, name: bestName };
  };

  // Equity calculator: fast Monte Carlo simulation
  const calculateEquities = (pH, cH, cCards, revCount, fullDeck) => {
    let pWins = 0;
    let cWins = 0;
    let ties = 0;
    const runs = 200; // Fast simulation

    const usedIds = new Set([...pH, ...cH, ...cCards.slice(0, revCount)].map(c => c.code + c.suit));
    const remainingDeck = fullDeck.filter(c => !usedIds.has(c.code + c.suit));

    for (let r = 0; r < runs; r++) {
      const simDeck = [...remainingDeck];
      // Shuffle simDeck
      for (let i = simDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = simDeck[i];
        simDeck[i] = simDeck[j];
        simDeck[j] = temp;
      }

      const simCommunity = [...cCards.slice(0, revCount)];
      while (simCommunity.length < 5) {
        simCommunity.push(simDeck.pop());
      }

      const pEval = evaluateSevenCardHand([...pH, ...simCommunity]);
      const cEval = evaluateSevenCardHand([...cH, ...simCommunity]);

      if (pEval.score > cEval.score) pWins++;
      else if (cEval.score > pEval.score) cWins++;
      else ties++;
    }

    const total = pWins + cWins + ties;
    return {
      player: Math.round(((pWins + ties / 2) / total) * 100),
      computer: Math.round(((cWins + ties / 2) / total) * 100)
    };
  };

  const dealNewGame = () => {
    if (isDealing) return;
    setIsDealing(true);
    setRevealedCommunityCount(0);

    // Build fresh full deck
    const freshDeck = [];
    for (const s of suits) {
      for (const c of codes) {
        freshDeck.push({ code: c, suit: s });
      }
    }
    const shuffledDeck = [...freshDeck];
    for (let i = shuffledDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffledDeck[i];
      shuffledDeck[i] = shuffledDeck[j];
      shuffledDeck[j] = temp;
    }

    const pH = [shuffledDeck.pop(), shuffledDeck.pop()];
    const cH = [shuffledDeck.pop(), shuffledDeck.pop()];
    const cCards = [shuffledDeck.pop(), shuffledDeck.pop(), shuffledDeck.pop(), shuffledDeck.pop(), shuffledDeck.pop()];

    setDeck(freshDeck);
    setPlayerHand(pH);
    setComputerHand(cH);
    setCommunityCards(cCards);

    setRollStates({
      player: [true, true],
      computer: [true, true],
      community: [false, false, false, false, false]
    });

    setTimeout(() => {
      setRollStates(prev => ({ ...prev, player: [false, false] }));
    }, 400);

    setTimeout(() => {
      setRollStates(prev => ({ ...prev, computer: [false, false] }));
      setIsDealing(false);
      const eq = calculateEquities(pH, cH, cCards, 0, freshDeck);
      setEquities(eq);
    }, 800);
  };

  const revealNextStage = () => {
    if (isDealing) return;
    let nextCount = 0;
    if (revealedCommunityCount === 0) nextCount = 3; // flop
    else if (revealedCommunityCount === 3) nextCount = 4; // turn
    else if (revealedCommunityCount === 4) nextCount = 5; // river
    else return;

    setRollStates(prev => {
      const communityRoll = [...prev.community];
      if (revealedCommunityCount === 0) communityRoll[0] = communityRoll[1] = communityRoll[2] = true;
      else if (revealedCommunityCount === 3) communityRoll[3] = true;
      else if (revealedCommunityCount === 4) communityRoll[4] = true;
      return { ...prev, community: communityRoll };
    });

    setIsDealing(true);
    setTimeout(() => {
      setRevealedCommunityCount(nextCount);
      setRollStates({
        player: [false, false],
        computer: [false, false],
        community: [false, false, false, false, false]
      });
      setIsDealing(false);
      const eq = calculateEquities(playerHand, computerHand, communityCards, nextCount, deck);
      setEquities(eq);
    }, 500);
  };

  useEffect(() => {
    dealNewGame();
  }, []);

  const getHandDesc = (pH, cCards, count) => {
    if (count === 0) return 'Pre-flop';
    const evalRes = evaluateSevenCardHand([...pH, ...cCards.slice(0, count)]);
    return evalRes.name;
  };

  const renderCard = (c, isFacedown, isRolling) => {
    if (isFacedown) {
      return (
        <div style={{
          width: '38px', height: '58px',
          background: 'linear-gradient(135deg, var(--color-gold-dark), var(--color-gold))',
          borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', color: '#0a0a0f', fontSize: '16px', fontWeight: 'bold'
        }}>
          ♠
        </div>
      );
    }

    if (!c) return null;

    const isRed = c.suit === '♥' || c.suit === '♦';
    return (
      <div 
        style={{
          width: '38px', height: '58px',
          background: 'white', borderRadius: '4px', border: '1px solid #ddd',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '3px', color: isRed ? '#e05252' : '#111',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          position: 'relative',
          animation: isRolling ? `card-slot-roll 0.25s ease-in-out infinite alternate` : 'none'
        }}
      >
        {/* Top Left */}
        <div style={{ position: 'absolute', top: '2px', left: '2px', display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: '0.9' }}>
          <span style={{ fontSize: '9px', fontWeight: '900', fontFamily: 'var(--font-display)' }}>{c.code}</span>
          <span style={{ fontSize: '8px' }}>{c.suit}</span>
        </div>
        {/* Center */}
        <div style={{ fontSize: '18px', position: 'absolute', top: '52%', left: '50%', transform: 'translate(-50%, -50%)', lineHeight: '1' }}>
          {c.suit}
        </div>
      </div>
    );
  };

  return (
    <div className="card" style={{ marginBottom: '32px', background: 'radial-gradient(circle at 50% 50%, rgba(201,168,76,0.08) 0%, var(--color-bg-card) 100%)', border: '1px solid rgba(201,168,76,0.2)' }}>
      <div className="card-body" style={{ textAlign: 'center', padding: '20px 16px' }}>
        <h3 className="card-title" style={{ color: 'var(--color-gold)', marginBottom: '4px' }}>♠ Texas Hold'em Dealer</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>Test your pocket cards against the dealer</p>

        {/* ── Hands Layout ── */}
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
          
          {/* User Hand */}
          <div style={{ flex: '1', minWidth: '120px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Your Hand</div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '8px' }}>
              {playerHand.map((c, i) => renderCard(c, false, rollStates.player[i]))}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
              {getHandDesc(playerHand, communityCards, revealedCommunityCount)}
            </div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#22c55e', marginTop: '6px' }}>
              {equities.player}% Equity
            </div>
          </div>

          {/* VS Divider */}
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>VS</div>

          {/* Computer Hand */}
          <div style={{ flex: '1', minWidth: '120px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Opponent</div>
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '8px' }}>
              {computerHand.map((c, i) => renderCard(c, false, rollStates.computer[i]))}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
              {getHandDesc(computerHand, communityCards, revealedCommunityCount)}
            </div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#e05252', marginTop: '6px' }}>
              {equities.computer}% Equity
            </div>
          </div>

        </div>

        {/* ── Community Cards ── */}
        <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(7, 8, 13, 0.4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', fontFamily: 'var(--font-display)' }}>
            Community Cards ({revealedCommunityCount === 0 ? 'Pre-flop' : revealedCommunityCount === 3 ? 'Flop' : revealedCommunityCount === 4 ? 'Turn' : 'River'})
          </div>
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
            {communityCards.map((c, idx) => {
              const isFacedown = idx >= revealedCommunityCount;
              return (
                <div key={idx}>
                  {renderCard(c, isFacedown, rollStates.community[idx])}
                </div>
              );
            })}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={dealNewGame} disabled={isDealing}>
            ♠ New Game
          </button>
          
          {revealedCommunityCount < 5 && (
            <button className="btn btn-primary btn-sm" onClick={revealNextStage} disabled={isDealing}>
              {revealedCommunityCount === 0 ? 'Deal Flop ♦' : revealedCommunityCount === 3 ? 'Deal Turn ♥' : 'Deal River ♣'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Blackjack Minigame Component ───────────────────────────────────────────
function BlackjackDealer() {
  const [deck, setDeck] = useState([]);
  const [playerCards, setPlayerCards] = useState([]);
  const [dealerCards, setDealerCards] = useState([]);
  const [gameStatus, setGameStatus] = useState('idle'); // idle, playing, stand, won, lost, push, blackjack, bust
  const [isDealing, setIsDealing] = useState(false);
  const [rollStates, setRollStates] = useState({ player: [], dealer: [] });

  const suits = ['♠', '♥', '♦', '♣'];
  const codes = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

  const getCardValue = (card) => {
    if (!card) return 0;
    if (['J', 'Q', 'K'].includes(card.code)) return 10;
    if (card.code === 'A') return 11;
    return Number(card.code);
  };

  const calculateScore = (cards) => {
    let score = cards.reduce((sum, c) => sum + getCardValue(c), 0);
    let aces = cards.filter(c => c.code === 'A').length;
    while (score > 21 && aces > 0) {
      score -= 10;
      aces -= 1;
    }
    return score;
  };

  const startNewGame = () => {
    if (isDealing) return;
    setIsDealing(true);
    setGameStatus('playing');

    // Build & shuffle deck
    const freshDeck = [];
    for (const s of suits) {
      for (const c of codes) {
        freshDeck.push({ code: c, suit: s });
      }
    }
    for (let i = freshDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = freshDeck[i];
      freshDeck[i] = freshDeck[j];
      freshDeck[j] = temp;
    }

    const p1 = freshDeck.pop();
    const d1 = freshDeck.pop();
    const p2 = freshDeck.pop();
    const d2 = freshDeck.pop();

    setPlayerCards([p1, p2]);
    setDealerCards([d1, d2]);
    setDeck(freshDeck);

    setRollStates({
      player: [true, true],
      dealer: [true, false]
    });

    setTimeout(() => {
      setRollStates({ player: [false, false], dealer: [false, false] });
      setIsDealing(false);

      const pScore = calculateScore([p1, p2]);
      if (pScore === 21) {
        setGameStatus('blackjack');
      }
    }, 600);
  };

  const hit = () => {
    if (gameStatus !== 'playing' || isDealing) return;
    setIsDealing(true);

    const newDeck = [...deck];
    const newCard = newDeck.pop();
    const nextPlayerCards = [...playerCards, newCard];

    setPlayerCards(nextPlayerCards);
    setDeck(newDeck);
    
    setRollStates(prev => ({
      ...prev,
      player: [...prev.player.map(() => false), true]
    }));

    setTimeout(() => {
      setRollStates({ player: nextPlayerCards.map(() => false), dealer: dealerCards.map(() => false) });
      setIsDealing(false);

      const score = calculateScore(nextPlayerCards);
      if (score > 21) {
        setGameStatus('bust');
      } else if (score === 21) {
        // Automatically stand at 21
        standWithCards(nextPlayerCards);
      }
    }, 300);
  };

  const stand = () => {
    if (gameStatus !== 'playing' || isDealing) return;
    standWithCards(playerCards);
  };

  const standWithCards = (currentPHand) => {
    setGameStatus('stand');
    setIsDealing(true);

    let currentDHand = [...dealerCards];
    let currentDeck = [...deck];

    const runDealerTurn = () => {
      const pScore = calculateScore(currentPHand);
      const dScore = calculateScore(currentDHand);

      if (dScore < 17) {
        const nextCard = currentDeck.pop();
        currentDHand.push(nextCard);
        setDealerCards([...currentDHand]);
        setDeck([...currentDeck]);

        setRollStates(prev => ({
          ...prev,
          dealer: [...prev.dealer.map(() => false), true]
        }));

        setTimeout(() => {
          setRollStates({ player: currentPHand.map(() => false), dealer: currentDHand.map(() => false) });
          runDealerTurn();
        }, 400);
      } else {
        setIsDealing(false);
        // Determine outcome
        const finalP = calculateScore(currentPHand);
        const finalD = calculateScore(currentDHand);

        if (finalD > 21) {
          setGameStatus('won'); // Dealer busted
        } else if (finalP > finalD) {
          setGameStatus('won');
        } else if (finalD > finalP) {
          setGameStatus('lost');
        } else {
          setGameStatus('push');
        }
      }
    };

    runDealerTurn();
  };

  useEffect(() => {
    startNewGame();
  }, []);

  const pScore = calculateScore(playerCards);
  const dScore = gameStatus === 'playing' ? calculateScore([dealerCards[0]]) : calculateScore(dealerCards);

  const getStatusBadge = () => {
    if (gameStatus === 'blackjack') return { text: 'BLACKJACK!', color: '#22c55e' };
    if (gameStatus === 'bust') return { text: 'BUST!', color: '#ef4444' };
    if (gameStatus === 'won') return { text: 'YOU WIN!', color: '#22c55e' };
    if (gameStatus === 'lost') return { text: 'DEALER WINS', color: '#ef4444' };
    if (gameStatus === 'push') return { text: 'PUSH (TIE)', color: 'var(--color-gold)' };
    return null;
  };

  const badge = getStatusBadge();

  const renderMinigameCard = (c, isFacedown, isRolling) => {
    if (isFacedown) {
      return (
        <div style={{
          width: '38px', height: '58px',
          background: 'linear-gradient(135deg, var(--color-gold-dark), var(--color-gold))',
          borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', color: '#0a0a0f', fontSize: '16px', fontWeight: 'bold'
        }}>
          ♣
        </div>
      );
    }

    if (!c) return null;
    const isRed = c.suit === '♥' || c.suit === '♦';
    return (
      <div style={{
        width: '38px', height: '58px',
        background: 'white', borderRadius: '4px', border: '1px solid #ddd',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '3px', color: isRed ? '#e05252' : '#111',
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
        position: 'relative',
        animation: isRolling ? `card-slot-roll 0.25s ease-in-out infinite alternate` : 'none'
      }}>
        <div style={{ position: 'absolute', top: '2px', left: '2px', display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: '0.9' }}>
          <span style={{ fontSize: '9px', fontWeight: '900', fontFamily: 'var(--font-display)' }}>{c.code}</span>
          <span style={{ fontSize: '8px' }}>{c.suit}</span>
        </div>
        <div style={{ fontSize: '18px', position: 'absolute', top: '52%', left: '50%', transform: 'translate(-50%, -50%)', lineHeight: '1' }}>
          {c.suit}
        </div>
      </div>
    );
  };

  return (
    <div className="card" style={{ marginBottom: '32px', background: 'radial-gradient(circle at 50% 50%, rgba(201,168,76,0.08) 0%, var(--color-bg-card) 100%)', border: '1px solid rgba(201,168,76,0.2)' }}>
      <div className="card-body" style={{ textAlign: 'center', padding: '20px 16px' }}>
        <h3 className="card-title" style={{ color: 'var(--color-gold)', marginBottom: '4px' }}>♣ Blackjack Minigame</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>Try to hit 21 without going over</p>

        {badge && (
          <div style={{
            fontSize: '18px', fontWeight: '900', color: badge.color,
            fontFamily: 'var(--font-display)', marginBottom: '16px', letterSpacing: '0.05em'
          }}>
            {badge.text}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          
          {/* Player Cards */}
          <div style={{ flex: '1', minWidth: '120px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Your Hand</div>
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '8px' }}>
              {playerCards.map((c, i) => renderMinigameCard(c, false, rollStates.player[i]))}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
              Score: {pScore}
            </div>
          </div>

          {/* VS Divider */}
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>VS</div>

          {/* Dealer Cards */}
          <div style={{ flex: '1', minWidth: '120px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Dealer Hand</div>
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '8px' }}>
              {dealerCards.map((c, i) => {
                const isFacedown = gameStatus === 'playing' && i === 1;
                return renderMinigameCard(c, isFacedown, rollStates.dealer[i]);
              })}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
              Score: {dScore}
            </div>
          </div>

        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          {gameStatus === 'playing' ? (
            <>
              <button className="btn btn-secondary btn-sm" onClick={hit} disabled={isDealing}>
                Hit ♣
              </button>
              <button className="btn btn-primary btn-sm" onClick={stand} disabled={isDealing}>
                Stand ♠
              </button>
            </>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={startNewGame} disabled={isDealing}>
              ♣ Deal New Hand
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Sandeez 30-Session Recovery Challenge Tracker Component ──────────────────
function SandeezChallengeTracker({ userId, pastSessions }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [toast, setToast] = useState(null);

  const loadTracker = useCallback(async () => {
    const res = await getChallengeAction(userId);
    if (!res.error) {
      setData(res);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadTracker();
  }, [loadTracker]);

  const showToastMsg = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleDelete = async (entryId) => {
    if (!confirm('Delete this challenge session entry? Stats will be recalculated.')) return;
    const res = await deleteChallengeSessionAction(userId, entryId);
    if (res.error) {
      showToastMsg(res.error, 'error');
    } else {
      showToastMsg('Session entry deleted!');
      loadTracker();
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ marginBottom: '32px', padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading 30-Session Recovery Tracker...
      </div>
    );
  }

  if (!data || !data.summary) return null;

  const { summary, entries } = data;

  return (
    <div className="card" style={{
      marginBottom: '32px',
      background: 'radial-gradient(circle at 50% 0%, rgba(201,168,76,0.14) 0%, var(--color-bg-card) 100%)',
      border: '1px solid rgba(201,168,76,0.35)',
      boxShadow: '0 0 30px rgba(201,168,76,0.08)'
    }}>
      <div className="card-body" style={{ padding: '24px 20px' }}>

        {toast && (
          <div className="toast-container">
            <div className={`toast toast-${toast.type}`}>
              {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
            </div>
          </div>
        )}

        {/* Title Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <div className="section-badge" style={{ background: 'rgba(201,168,76,0.15)', color: 'var(--color-gold)', border: '1px solid rgba(201,168,76,0.3)', marginBottom: '6px' }}>
              🎯 Sandeez Exclusive
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
              30-Session Loss Recovery Challenge (₹31,000 Target)
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Rule Strategy: Initial ₹500 buy-in → ₹1,000 rebuy if bust → Capped at max -₹1,500 loss per session.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowImportModal(true)}>
              📥 Import Session
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
              + Log Session
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: '700', marginBottom: '6px' }}>
            <span>Recovery Progress ({summary.progressPercent}%)</span>
            <span style={{ color: 'var(--color-gold)' }}>₹{summary.totalRecovered.toLocaleString('en-IN')} / ₹31,000</span>
          </div>
          <div style={{ width: '100%', height: '12px', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
            <div style={{
              width: `${summary.progressPercent}%`, height: '100%',
              background: 'linear-gradient(90deg, #c9a84c, #22c55e)',
              transition: 'width 0.5s ease-in-out'
            }} />
          </div>
        </div>

        {/* Core Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '20px' }}>
          <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>Total Recovered</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '900', color: summary.totalRecovered >= 0 ? '#22c55e' : '#ef4444', marginTop: '3px' }}>
              {summary.totalRecovered >= 0 ? '+' : ''}₹{summary.totalRecovered.toLocaleString('en-IN')}
            </div>
          </div>

          <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>Left to Recover</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '900', color: 'var(--color-gold)', marginTop: '3px' }}>
              ₹{summary.remainingToRecover.toLocaleString('en-IN')}
            </div>
          </div>

          <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>Sessions Done</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)', marginTop: '3px' }}>
              {summary.sessionsCount} / {summary.maxSessions}
            </div>
          </div>

          <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>Remaining</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '900', color: 'var(--color-gold)', marginTop: '3px' }}>
              {summary.remainingSessions}
            </div>
          </div>
        </div>

        {/* Analytics & Detailed Breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '20px' }}>
          <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.06)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div style={{ fontSize: '11px', color: '#ef4444', fontFamily: 'var(--font-display)', fontWeight: '700' }}>🛑 Bust (-₹1.5k)</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '900', color: '#ef4444', marginTop: '2px' }}>
              {summary.bustSessionsCount} sessions
            </div>
          </div>

          <div style={{ padding: '10px 12px', background: 'rgba(34,197,94,0.06)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <div style={{ fontSize: '11px', color: '#22c55e', fontFamily: 'var(--font-display)', fontWeight: '700' }}>🎉 Profit Sessions</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '900', color: '#22c55e', marginTop: '2px' }}>
              {summary.profitSessionsCount} sessions
            </div>
          </div>

          <div style={{ padding: '10px 12px', background: 'rgba(201,168,76,0.06)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(201,168,76,0.2)' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-gold)', fontFamily: 'var(--font-display)', fontWeight: '700' }}>📈 Avg Win</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '900', color: 'var(--color-gold)', marginTop: '2px' }}>
              +₹{summary.avgWinningProfit.toLocaleString('en-IN')}
            </div>
          </div>

          <div style={{ padding: '10px 12px', background: 'rgba(201,168,76,0.12)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(201,168,76,0.3)' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-gold)', fontFamily: 'var(--font-display)', fontWeight: '700' }}>⚡ Req Avg / Session</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '900', color: 'var(--color-gold)', marginTop: '2px' }}>
              ₹{summary.requiredAvgProfit.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Predictive Scenarios */}
        {summary.scenarios && summary.scenarios.length > 0 && (
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: '24px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: '800', color: 'var(--color-gold)', letterSpacing: '0.05em', marginBottom: '8px' }}>
              🔮 REALISTIC RECOVERY PREDICTIONS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {summary.scenarios.map((sc, i) => (
                <div key={i} style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--color-gold)', fontWeight: '700' }}>•</span>
                  <span>{sc.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Session Log List */}
        <div>
          <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '12px', letterSpacing: '0.05em' }}>
            📜 Logged Challenge Sessions ({entries.length})
          </h4>

          {entries.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
              No sessions logged in your challenge tracker yet. Click "+ Log Session" or "Import Session" above!
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {entries.map((entry, index) => {
                const sNum = entries.length - index;
                const p = Number(entry.profit || 0);
                const isBust = p <= -1400;
                const isWin = p > 0;
                const isTie = p === 0;

                return (
                  <div key={entry._id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 14px', background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                    gap: '12px', flexWrap: 'wrap'
                  }}>
                    <div style={{ flex: 1, minWidth: '160px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: '800', color: 'var(--color-gold)', fontSize: '14px' }}>
                          Session #{sNum}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {new Date(entry.sessionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      {entry.note && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {entry.note}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontFamily: 'var(--font-mono)', fontWeight: '900', fontSize: '16px',
                          color: isWin ? '#22c55e' : isTie ? 'var(--text-muted)' : '#ef4444'
                        }}>
                          {isWin ? '+' : ''}₹{p.toLocaleString('en-IN')}
                        </div>
                        <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: isBust ? '#ef4444' : isWin ? '#22c55e' : 'var(--text-muted)', fontFamily: 'var(--font-display)', fontWeight: '700' }}>
                          {isBust ? '🛑 Bust (-₹1.5k)' : isWin ? '🎉 Profit' : isTie ? '⚖️ Breakeven' : '📉 Loss'}
                        </div>
                      </div>

                      {/* Delete button */}
                      <button
                        className="btn btn-sm"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', padding: '4px 10px', fontSize: '12px' }}
                        onClick={() => handleDelete(entry._id)}
                        title="Delete session from challenge tracker"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Log Manual Session Modal */}
        {showAddModal && (
          <ChallengeLogModal
            userId={userId}
            onClose={() => setShowAddModal(false)}
            onSuccess={() => {
              setShowAddModal(false);
              showToastMsg('Challenge session logged!');
              loadTracker();
            }}
            onError={(msg) => showToastMsg(msg, 'error')}
          />
        )}

        {/* Import Past Session Modal */}
        {showImportModal && (
          <ChallengeImportModal
            userId={userId}
            pastSessions={pastSessions}
            loggedLinkedIds={entries.map(e => e.linkedSession).filter(Boolean)}
            onClose={() => setShowImportModal(false)}
            onSuccess={() => {
              setShowImportModal(false);
              showToastMsg('Session imported into challenge!');
              loadTracker();
            }}
            onError={(msg) => showToastMsg(msg, 'error')}
          />
        )}

      </div>
    </div>
  );
}

// ─── Challenge Log Manual Modal ───────────────────────────────────────────────
function ChallengeLogModal({ userId, onClose, onSuccess, onError }) {
  const [form, setForm] = useState({
    profit: '',
    buyIn: '500',
    cashOut: '',
    sessionDate: new Date().toISOString().split('T')[0],
    note: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.profit === '' || isNaN(Number(form.profit))) {
      onError('Please enter a valid profit or loss amount');
      return;
    }

    setLoading(true);
    const res = await addChallengeSessionAction(userId, {
      profit: Number(form.profit),
      buyIn: Number(form.buyIn || 500),
      cashOut: form.cashOut ? Number(form.cashOut) : (Number(form.buyIn || 500) + Number(form.profit)),
      sessionDate: form.sessionDate,
      note: form.note
    });

    setLoading(false);
    if (res.error) {
      onError(res.error);
    } else {
      onSuccess();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <h2 className="modal-title">🎯 Log Challenge Session</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Profit / Loss (₹) <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="number" className="form-input"
                placeholder="e.g., +2500 or -1500"
                value={form.profit}
                onChange={e => setForm(f => ({ ...f, profit: e.target.value }))}
                required
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Use negative number for losses (e.g. -1500 for a bust session)
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Session Date</label>
              <input
                type="date" className="form-input"
                value={form.sessionDate}
                onChange={e => setForm(f => ({ ...f, sessionDate: e.target.value }))}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="form-group">
                <label className="form-label">Buy-In (₹)</label>
                <input
                  type="number" className="form-input"
                  value={form.buyIn}
                  onChange={e => setForm(f => ({ ...f, buyIn: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Cash-Out (₹)</label>
                <input
                  type="number" className="form-input"
                  placeholder="Optional"
                  value={form.cashOut}
                  onChange={e => setForm(f => ({ ...f, cashOut: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes (Optional)</label>
              <input
                type="text" className="form-input"
                placeholder="e.g. Friday home game, 2nd rebuy..."
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                maxLength={80}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                {loading ? 'Logging...' : 'Confirm Log'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Challenge Import Past Session Modal ──────────────────────────────────────
function ChallengeImportModal({ userId, pastSessions, loggedLinkedIds, onClose, onSuccess, onError }) {
  const [importingId, setImportingId] = useState(null);

  // Filter ended past sessions where sandeez has a result
  const availableSessions = (pastSessions || []).filter(s => {
    const isLinked = loggedLinkedIds.includes(s._id?.toString() || s._id);
    const myPlayer = (s.players || []).find(p => (p.user?._id || p.user)?.toString() === userId);
    return !isLinked && myPlayer && myPlayer.finalStack != null;
  });

  const handleImport = async (sessionId) => {
    setImportingId(sessionId);
    const res = await importSessionToChallengeAction(userId, sessionId);
    setImportingId(null);
    if (res.error) {
      onError(res.error);
    } else {
      onSuccess();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h2 className="modal-title">📥 Import Ended Session</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Select any past ended session to automatically import your P/L result into your 30-Session Tracker:
          </p>

          {availableSessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
              No unimported past ended sessions found with finalized stats.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
              {availableSessions.map(s => {
                const myPlayer = s.players.find(p => (p.user?._id || p.user)?.toString() === userId);
                const buyIn = myPlayer?.totalBuyIn || 500;
                const cashOut = myPlayer?.finalStack || 0;
                const profit = cashOut - buyIn;
                const isWin = profit > 0;
                const isImporting = importingId === s._id;

                return (
                  <div key={s._id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 14px', background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)'
                  }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: '800', fontSize: '14px', color: 'var(--text-primary)' }}>
                        {s.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {s.group?.name ? `Group: ${s.group.name} • ` : ''}
                        {new Date(s.endedAt || s.startedAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontWeight: '900', fontSize: '14px',
                        color: isWin ? '#22c55e' : profit === 0 ? 'var(--text-muted)' : '#ef4444'
                      }}>
                        {isWin ? '+' : ''}₹{profit.toLocaleString('en-IN')}
                      </span>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleImport(s._id)}
                        disabled={isImporting}
                      >
                        {isImporting ? '...' : '+ Import'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost w-full" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
