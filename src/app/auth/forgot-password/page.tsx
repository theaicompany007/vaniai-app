'use client';

import { useState } from 'react';
import { Mail } from 'lucide-react';
import Image from 'next/image';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSent(true);
      } else {
        setError((data.error as string) ?? 'Something went wrong');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--wo-bg)' }}
    >
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 justify-center mb-8">
          <Image src="/vani-logo.png" alt="Vani" width={56} height={56} className="rounded-2xl object-contain" />
          <span className="text-lg font-bold" style={{ color: 'var(--wo-text)' }}>Reset password</span>
        </div>

        <div className="wo-card p-8">
          {sent ? (
            <>
              <p className="text-sm" style={{ color: 'var(--wo-text)' }}>
                Check <strong>{email}</strong> for a link to reset your password.
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--wo-text-muted)' }}>
                If you don’t see it, check spam or try again.
              </p>
              <a href="/auth/login" className="wo-btn wo-btn-primary w-full mt-6 block text-center">
                Back to sign in
              </a>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--wo-text)' }}>Forgot password?</h1>
              <p className="text-sm mb-6" style={{ color: 'var(--wo-text-muted)' }}>
                Enter your email and we’ll send you a link to set a new password.
              </p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--wo-text-muted)' }} />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="wo-input pl-10 w-full"
                  />
                </div>
                {error && (
                  <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                    {error}
                  </p>
                )}
                <button type="submit" disabled={loading} className="wo-btn wo-btn-primary w-full mt-1">
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            </>
          )}

          <p className="text-center text-sm mt-6" style={{ color: 'var(--wo-text-muted)' }}>
            <a href="/auth/login" style={{ color: 'var(--wo-primary)' }}>Back to sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
