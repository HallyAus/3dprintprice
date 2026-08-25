'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [useMagicLink, setUseMagicLink] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (useMagicLink) {
        await api.login(email, undefined, true);
        setSuccess('Check your email for a sign-in link!');
      } else {
        const result = await api.login(email, password, false);
        if (!('token' in result)) {
          throw new Error(result.message);
        }
        login(result.token);
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <h1>🖨️ PrintForge</h1>
          <p>Admin Dashboard</p>
        </div>

        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 6,
            padding: 12,
            marginBottom: 20,
            color: '#991b1b',
            fontSize: 14
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            background: '#dcfce7',
            border: '1px solid #86efac',
            borderRadius: 6,
            padding: 12,
            marginBottom: 20,
            color: '#166534',
            fontSize: 14
          }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label" htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={loading}
            />
          </div>

          {!useMagicLink && (
            <div className="form-group">
              <label className="label" htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginBottom: 16 }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : useMagicLink ? 'Send Magic Link' : 'Sign In'}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: '100%' }}
            onClick={() => {
              setUseMagicLink(!useMagicLink);
              setError('');
              setSuccess('');
            }}
            disabled={loading}
          >
            {useMagicLink ? 'Use Password Instead' : 'Use Magic Link Instead'}
          </button>
        </form>

        <p style={{ fontSize: 12, color: '#999', textAlign: 'center', marginTop: 24 }}>
          Demo: admin@example.com / admin123
        </p>
      </div>
    </div>
  );
}
