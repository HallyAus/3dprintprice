'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setError('Invalid verification link');
      return;
    }

    api.verifyMagicLink(token)
      .then(({ token: authToken }) => {
        login(authToken);
        router.push('/dashboard');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Verification failed');
      });
  }, [searchParams, login, router]);

  return (
    <div className="login-container">
      <div className="login-card" style={{ textAlign: 'center' }}>
        {error ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h2 style={{ marginBottom: 8 }}>Verification Failed</h2>
            <p style={{ color: '#666', marginBottom: 24 }}>{error}</p>
            <a href="/login" className="btn btn-primary">
              Back to Login
            </a>
          </>
        ) : (
          <>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: '#666' }}>Verifying your link...</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="login-container" />}>
      <VerifyContent />
    </Suspense>
  );
}
