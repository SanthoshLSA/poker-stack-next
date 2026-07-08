'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { loginAction } from '../actions/authActions';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await loginAction(form.username, form.password);
      if (result.error) {
        setError(result.error);
      } else {
        login(result.user);
        router.push('/dashboard');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="bg-orb bg-orb-gold" style={{ opacity: 0.5 }} />
      <div className="auth-card card animate-in">
        <div className="card-body">
          <div className="auth-header">
            <span className="auth-logo" style={{ fontFamily: 'var(--font-display)', fontSize: '40px', color: 'var(--color-gold)', textShadow: '0 0 20px rgba(201,168,76,0.5)' }}>♠</span>
            <h1 className="auth-title">Welcome Back</h1>
            <p className="auth-subtitle">Take your seat at the table</p>
          </div>

          {error && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 'var(--radius-md)',
              color: '#ef4444',
              fontSize: '14px',
              marginBottom: '20px',
              fontFamily: 'var(--font-display)',
              fontWeight: '600'
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                id="username"
                name="username"
                type="text"
                className="form-input"
                placeholder="your_username"
                value={form.username}
                onChange={handleChange}
                required
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              style={{ marginTop: '8px' }}
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Login to PokerStack'}
            </button>
          </form>

          <div className="auth-divider" style={{ marginTop: '24px' }}>OR</div>

          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '14px', color: 'var(--text-secondary)' }}>
            New to the table?{' '}
            <Link href="/register" style={{ color: 'var(--color-gold)', fontWeight: '700', fontFamily: 'var(--font-display)' }}>
              Create Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
