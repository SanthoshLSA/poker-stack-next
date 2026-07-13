'use client';

import Link from 'next/link';
import { useAuth } from './context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) return null;

  return (
    <div className="page" style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div className="bg-orb bg-orb-gold" style={{ opacity: 0.4 }} />
      <div className="bg-orb bg-orb-red" style={{ opacity: 0.15, top: '60%', left: '70%' }} />

      {/* Hero */}
      <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto', padding: '60px 20px 40px' }}>
        <div className="section-badge" style={{ display: 'inline-block', marginBottom: '24px' }}>♠ Open Beta</div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(42px, 8vw, 80px)',
          fontWeight: '400',
          letterSpacing: '0.05em',
          lineHeight: '1',
          marginBottom: '24px',
          color: 'var(--text-primary)',
        }}>
          POKER<span style={{ color: 'var(--color-gold)' }}>STACK</span>
        </h1>
        <p style={{
          fontSize: '18px',
          color: 'var(--text-secondary)',
          lineHeight: '1.6',
          maxWidth: '520px',
          margin: '0 auto 40px',
        }}>
          Track chips, manage rebuys, and verify bankroll conservation across your entire game night — with zero guesswork.
        </p>

        <div className="landing-actions" style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {user ? (
            <Link href="/dashboard" className="btn btn-primary" style={{ padding: '14px 36px', fontSize: '16px' }}>
              ♠ Go to Dashboard
            </Link>
          ) : (
            <>
              <Link href="/register" className="btn btn-primary" style={{ padding: '14px 36px', fontSize: '16px' }}>
                ♠ Join the Table
              </Link>
              <Link href="/login" className="btn btn-outline" style={{ padding: '14px 36px', fontSize: '16px' }}>
                Login
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Feature cards */}
      <div className="landing-features-grid" style={{ gap: '16px', maxWidth: '900px', margin: '20px auto', padding: '0 20px 60px' }}>
        {[
          { icon: '♠', title: 'Live Sessions', desc: 'Create a room, share the code, and track every chip in real-time as players join.' },
          { icon: '♦', title: 'Conservation Math', desc: 'Every chip must account for. Bank + stacks always equals the initial buy-in total.' },
          { icon: '♥', title: 'Rebuys & Transfers', desc: 'Record buy-ins, rebuys and player-to-player chip transfers with a full audit log.' },
          { icon: '♣', title: 'Group Leaderboards', desc: 'Create private poker clubs, track season P&L, and see who is actually running hot.' },
        ].map(f => (
          <div key={f.title} className="card animate-in" style={{ textAlign: 'center' }}>
            <div className="card-body" style={{ padding: '28px 20px' }}>
              <div style={{ fontSize: '32px', color: 'var(--color-gold)', marginBottom: '14px' }}>{f.icon}</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-primary)', marginBottom: '10px' }}>
                {f.title}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
