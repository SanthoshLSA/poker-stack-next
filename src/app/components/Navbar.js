'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const handleLogout = () => { logout(); router.push('/login'); };
  const isActive = (path) => pathname === path || pathname?.startsWith(path + '/');

  return (
    <>
      <nav className="navbar" style={{ boxShadow: scrolled ? '0 1px 20px rgba(0,0,0,0.5)' : 'none' }}>
        <div className="navbar-inner">
          <Link href={user ? '/dashboard' : '/'} className="navbar-logo">
            <span className="navbar-logo-icon">♠</span>
            POKER<span style={{ color: 'var(--color-gold)' }}>STACK</span>
          </Link>

          {user && (
            <div className="navbar-links">
              <Link href="/dashboard" className={`navbar-link ${isActive('/dashboard') ? 'active' : ''}`}>Dashboard</Link>
              <Link href="/groups" className={`navbar-link ${isActive('/groups') ? 'active' : ''}`}>Groups</Link>
            </div>
          )}

          <div className="navbar-actions">
            {user ? (
              <>
                <Link href="/profile">
                  <div className="navbar-avatar" style={{ background: user.avatarColor || '#c9a84c', color: '#0a0a0f' }} title="Profile">
                    {user.username?.charAt(0).toUpperCase()}
                  </div>
                </Link>
                <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Exit ♠</button>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost btn-sm">Login</Link>
                <Link href="/register" className="btn btn-primary btn-sm">Join Table</Link>
              </>
            )}
            {user && (
              <button className="navbar-menu-btn" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
                {menuOpen ? '✕' : '≡'}
              </button>
            )}
          </div>
        </div>
      </nav>

      {user && (
        <div className={`mobile-menu ${menuOpen ? 'open' : ''}`}>
          <Link href="/dashboard" className="mobile-menu-link">♠ Dashboard</Link>
          <Link href="/groups" className="mobile-menu-link">♥ Groups</Link>
          <Link href="/profile" className="mobile-menu-link">♣ Profile</Link>
          <button
            onClick={handleLogout}
            className="mobile-menu-link"
            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.1em' }}
          >
            ✕ Exit Game
          </button>
        </div>
      )}
    </>
  );
}
