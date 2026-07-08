'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { getGlobalLeaderboardAction } from '../actions/leaderboardActions';

const formatINR = n => (n === null ? '—' : (n >= 0 ? '+₹' : '-₹') + Math.abs(Number(n)).toLocaleString('en-IN'));

export default function LeaderboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (user) {
      getGlobalLeaderboardAction(user._id).then(res => {
        if (!res.error) setLeaderboard(res.leaderboard);
        setLoading(false);
      });
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) return null;

  const filtered = leaderboard.filter(p =>
    p.username.toLowerCase().includes(search.toLowerCase())
  );

  const myEntry = leaderboard.find(p => p.userId === user._id);
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="page">
      <div className="bg-orb bg-orb-gold" style={{ opacity: 0.35 }} />

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="section-badge">♦ Global Leaderboard</div>
          <h1 className="page-title">Rankings</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px' }}>
            Top {leaderboard.length} players by profit
          </p>
        </div>
      </div>

      {/* My rank banner */}
      {myEntry && (
        <div className="card" style={{ marginBottom: '24px', borderColor: 'rgba(201,168,76,0.3)' }}>
          <div className="card-body" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div className="avatar avatar-md" style={{ background: user.avatarColor || '#c9a84c', color: '#0a0a0f' }}>
                {user.username?.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700' }}>
                  {user.username} <span style={{ color: 'var(--color-gold)', fontSize: '13px' }}>(You)</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Rank #{myEntry.rank}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '900', color: myEntry.totalProfit >= 0 ? '#22c55e' : '#ef4444' }}>
                  {formatINR(myEntry.totalProfit)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total P/L</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '900', color: 'var(--color-gold)' }}>
                  {myEntry.sessionsPlayed}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Sessions</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-body" style={{ padding: '14px 20px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search players..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ margin: 0 }}
          />
        </div>
      </div>

      {/* Leaderboard Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
          <p>Loading rankings...</p>
        </div>
      ) : (
        <div className="card">
          <div className="card-body" style={{ padding: '0' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No players found.</div>
            ) : (
              <div>
                {filtered.map((p, i) => {
                  const isMe = p.userId === user._id;
                  const profit = p.totalProfit;
                  const winRate = p.sessionsPlayed > 0 ? Math.round((p.sessionsWon / p.sessionsPlayed) * 100) : 0;

                  return (
                    <div key={p.userId} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '14px 20px',
                      borderBottom: i < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      background: isMe ? 'rgba(201,168,76,0.04)' : 'transparent',
                      transition: 'background 0.15s'
                    }}>
                      {/* Rank */}
                      <div style={{ width: '36px', textAlign: 'center', flexShrink: 0 }}>
                        {p.rank <= 3 ? (
                          <span style={{ fontSize: '20px' }}>{medals[p.rank - 1]}</span>
                        ) : (
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)' }}>#{p.rank}</span>
                        )}
                      </div>

                      {/* Avatar */}
                      <div className="avatar avatar-sm" style={{ background: p.avatarColor || '#c9a84c', color: '#0a0a0f', flexShrink: 0 }}>
                        {p.username?.charAt(0).toUpperCase()}
                      </div>

                      {/* Name */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '700', color: isMe ? 'var(--color-gold)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.username} {isMe && '(You)'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {p.sessionsPlayed} sessions • {winRate}% win rate
                        </div>
                      </div>

                      {/* Profit */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {p.isPrivate && !isMe ? (
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: '14px', color: 'var(--text-muted)' }}>Private</span>
                        ) : (
                          <span style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '16px',
                            fontWeight: '900',
                            color: profit === null ? 'var(--text-muted)' : profit >= 0 ? '#22c55e' : '#ef4444'
                          }}>
                            {formatINR(profit)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
