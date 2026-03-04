'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock } from 'lucide-react';
import Image from 'next/image';

function getNextRedirect(searchParams: ReturnType<typeof useSearchParams>): string {
  const next = searchParams.get('next');
  if (!next || typeof next !== 'string') return '/home';
  if (!next.startsWith('/')) return '/home';
  return next;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Supabase auth endpoint occasionally returns HTML transiently — retry up to 3 times
    const MAX_ATTEMPTS = 3;
    let lastError = 'Login failed';

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (res.ok) {
          const nextUrl = getNextRedirect(searchParams);
          if (nextUrl === '/home') {
            const sessionRes = await fetch('/api/auth/session', { credentials: 'include' });
            const sessionData = sessionRes.ok ? await sessionRes.json().catch(() => null) : null;
            if (sessionData && sessionData.orgId == null) {
              router.push('/auth/complete-setup');
              router.refresh();
              return;
            }
          }
          router.push(nextUrl);
          router.refresh();
          return;
        }

        // Parse error message
        let errorMsg = 'Login failed';
        try {
          const data = await res.json();
          errorMsg = data.error ?? 'Login failed';
        } catch {
          // Response was HTML — transient Supabase blip
          errorMsg = 'Connecting to auth server…';
        }

        // Only retry on transient errors (not real credential failures)
        const isTransient = res.status === 500 || errorMsg.includes('DOCTYPE') || errorMsg.includes('token');
        if (!isTransient || attempt === MAX_ATTEMPTS) {
          lastError = errorMsg.includes('DOCTYPE') ? 'Login failed — please try again' : errorMsg;
          break;
        }

        // Wait before retry (700ms, 1400ms)
        await new Promise((r) => setTimeout(r, attempt * 700));
      } catch {
        if (attempt === MAX_ATTEMPTS) lastError = 'Network error — please try again';
        else await new Promise((r) => setTimeout(r, attempt * 700));
      }
    }

    setLoading(false);
    setError(lastError);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--wo-bg)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo + title + tagline (same styling as app header) */}
        <div className="flex flex-col items-center gap-2 justify-center mb-8 text-center font-vani-brand">
          <Image src="/vani-logo.png" alt="Vani" width={56} height={56} className="rounded-2xl object-contain" />
          <h1 className="vani-brand-title text-lg font-bold tracking-wide" style={{ color: 'var(--wo-text)' }}>
            Vani AI - Sales Intelligence Platform
          </h1>
          <p className="text-sm leading-tight">
            <span className="font-bold animate-tagline-glow" style={{ color: 'var(--wo-primary)' }}>
              Don&apos;t app, just talk.
            </span>
          </p>
        </div>

        <div className="wo-card p-8">
          <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--wo-text)' }}>Sign in</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--wo-text-muted)' }}>
            {getNextRedirect(searchParams).includes('accept-invite')
              ? 'You were invited to join a team. Sign in if you already have an account, or create one with your invite email below.'
              : 'Welcome back to your AI sales intelligence platform'}
          </p>

          <form onSubmit={handleEmailLogin} className="flex flex-col gap-3">
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
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--wo-text-muted)' }} />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
            <p className="text-center text-xs" style={{ color: 'var(--wo-text-muted)' }}>
              <a href="/auth/forgot-password" style={{ color: 'var(--wo-primary)' }}>Forgot password?</a>
            </p>
          </form>

          <p className="text-center text-sm mt-4" style={{ color: 'var(--wo-text-muted)' }}>
            No account?{' '}
            <a
              href={'/auth/signup' + (getNextRedirect(searchParams).includes('accept-invite') ? '?next=' + encodeURIComponent(getNextRedirect(searchParams)) : '')}
              style={{ color: 'var(--wo-primary)' }}
            >
              Create one
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--wo-bg)' }}>
        <p className="text-sm" style={{ color: 'var(--wo-text-muted)' }}>Loading…</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
