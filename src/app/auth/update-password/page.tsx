'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setError('Invalid or expired reset link. Request a new one from the sign-in page.');
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }
      setDone(true);
      setTimeout(() => router.replace('/home'), 2000);
    } catch {
      setError('Something went wrong');
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
          <span className="text-lg font-bold" style={{ color: 'var(--wo-text)' }}>Set new password</span>
        </div>

        <div className="wo-card p-8">
          {done ? (
            <p className="text-sm" style={{ color: 'var(--wo-primary)' }}>
              Password updated. Redirecting to Vani…
            </p>
          ) : (
            <>
              <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--wo-text)' }}>New password</h1>
              <p className="text-sm mb-6" style={{ color: 'var(--wo-text-muted)' }}>
                Enter your new password below.
              </p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--wo-text-muted)' }} />
                  <input
                    type="password"
                    placeholder="New password (min 8 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                    className="wo-input pl-10 w-full"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--wo-text-muted)' }} />
                  <input
                    type="password"
                    placeholder="Confirm password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    minLength={8}
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
                  {loading ? 'Updating…' : 'Update password'}
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
