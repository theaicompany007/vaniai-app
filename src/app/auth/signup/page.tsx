'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, Building2, Globe } from 'lucide-react';
import Image from 'next/image';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next') ?? '';
  const inviteToken = searchParams.get('invite') ?? '';
  const isInvite = inviteToken.length > 0 || nextUrl.includes('accept-invite');
  const acceptInviteUrl = inviteToken ? `/auth/accept-invite?token=${encodeURIComponent(inviteToken)}` : nextUrl;

  const [orgName, setOrgName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    // 1. Server-side signup (avoids CORS, sets session cookie immediately)
    const signupRes = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    let signupData: { user?: { id: string }; confirmed?: boolean; error?: string } = {};
    try {
      signupData = await signupRes.json();
    } catch {
      setError('Signup failed — unexpected server response');
      setLoading(false);
      return;
    }

    if (!signupRes.ok) {
      setError(signupData.error ?? 'Signup failed');
      setLoading(false);
      return;
    }

    // If email confirmation is required, do not create org yet — user will complete setup after confirming
    if (!signupData.confirmed) {
      setInfo(`Check your email (${email}) to confirm your account, then sign in to complete setup.`);
      setLoading(false);
      return;
    }

    // Invited user: redirect to accept-invite so they get added to the org (no new org)
    if (isInvite && acceptInviteUrl.startsWith('/')) {
      router.push(acceptInviteUrl);
      router.refresh();
      return;
    }

    // New org creator: create org then go to home
    const orgRes = await fetch('/api/auth/create-org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        org_name: orgName,
        company_website_url: websiteUrl || undefined,
      }),
    });

    if (!orgRes.ok) {
      let errMsg = 'Failed to create organization';
      try {
        const resBody = await orgRes.json();
        errMsg = (resBody.error as string) ?? errMsg;
      } catch { /* ignore */ }
      setError(errMsg);
      setLoading(false);
      return;
    }

    router.push('/home');
    router.refresh();
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--wo-bg)' }}
    >
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 justify-center mb-8">
          <Image src="/vani-logo.png" alt="Vani" width={56} height={56} className="rounded-2xl object-contain" />
          <span className="text-lg font-bold" style={{ color: 'var(--wo-text)' }}>Vani Sales Intelligence</span>
        </div>

        <div className="wo-card p-8">
          <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--wo-text)' }}>
            {isInvite ? 'Create your account to join the team' : 'Create account'}
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--wo-text-muted)' }}>
            {isInvite
              ? 'Use the same email address you were invited with. After this, you’ll be added to the team.'
              : '14-day free trial · No credit card required'}
          </p>

          {!isInvite && (
            <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ background: 'rgba(0,217,255,0.08)', color: 'var(--wo-text-muted)' }}>
              Were you invited to join a team? Use the <strong>link in your invite email</strong> instead — you’ll only need to enter your email and password, not company details.
            </p>
          )}

          <form onSubmit={handleSignup} className="flex flex-col gap-3">
            {!isInvite && (
              <>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--wo-text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Company / Organization name"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    required
                    className="wo-input pl-10 w-full"
                  />
                </div>

                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--wo-text-muted)' }} />
                  <input
                    type="url"
                    placeholder="Company website (optional)"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="wo-input pl-10 w-full"
                  />
                </div>
              </>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--wo-text-muted)' }} />
              <input
                type="email"
                placeholder="Work email"
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
                placeholder="Password (min 8 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

            {info && (
              <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                {info}
              </p>
            )}

            <button type="submit" disabled={loading} className="wo-btn wo-btn-primary w-full mt-1">
              {loading ? 'Creating account...' : isInvite ? 'Create account & join team' : 'Start free trial'}
            </button>
          </form>

          <p className="text-center text-sm mt-4" style={{ color: 'var(--wo-text-muted)' }}>
            Already have an account?{' '}
            <a href={isInvite ? '/auth/login?next=' + encodeURIComponent(acceptInviteUrl) : '/auth/login'} style={{ color: 'var(--wo-primary)' }}>Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--wo-bg)' }}>
        <p className="text-sm" style={{ color: 'var(--wo-text-muted)' }}>Loading…</p>
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
