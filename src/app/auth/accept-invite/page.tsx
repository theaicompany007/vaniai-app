'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

function AcceptInviteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing invite token');
      return;
    }

    (async () => {
      const res = await fetch('/api/settings/members/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (res.status === 401) {
        router.replace(`/auth/signup?invite=${encodeURIComponent(token)}`);
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus('success');
        setTimeout(() => router.replace('/home'), 1500);
        return;
      }

      setStatus('error');
      setMessage((data.error as string) ?? 'Failed to accept invite');
    })();
  }, [token, router]);

  if (status === 'loading') {
    return (
      <div className="text-center py-12">
        <p className="text-sm" style={{ color: 'var(--wo-text-muted)' }}>Accepting invite…</p>
      </div>
    );
  }
  if (status === 'success') {
    return (
      <div className="text-center py-12">
        <p className="text-sm font-medium" style={{ color: 'var(--wo-primary)' }}>You’ve joined the team.</p>
        <p className="text-xs mt-1" style={{ color: 'var(--wo-text-muted)' }}>Redirecting to Vani…</p>
      </div>
    );
  }
  const alreadyMember = message.toLowerCase().includes('already a member');
  return (
    <div className="text-center py-12">
      <p className="text-sm font-medium" style={{ color: alreadyMember ? 'var(--wo-text-muted)' : '#f87171' }}>
        {message}
      </p>
      {alreadyMember && (
        <p className="text-xs mt-2" style={{ color: 'var(--wo-text-muted)' }}>
          Sign in with the same email you were invited with and your password.
        </p>
      )}
      <a
        href={alreadyMember ? '/auth/login?next=%2Fhome' : '/auth/login'}
        className="wo-btn wo-btn-primary text-sm mt-4 inline-block"
      >
        Sign in
      </a>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'var(--wo-bg)' }}
    >
      <div className="flex flex-col items-center gap-2 mb-8">
        <Image src="/vani-logo.png" alt="Vani" width={56} height={56} className="rounded-2xl object-contain" />
        <span className="text-lg font-bold" style={{ color: 'var(--wo-text)' }}>Accept invite</span>
      </div>
      <div className="wo-card p-8 max-w-sm w-full">
        <Suspense fallback={<div className="text-center py-8 text-sm text-[var(--wo-text-muted)]">Loading…</div>}>
          <AcceptInviteInner />
        </Suspense>
      </div>
    </div>
  );
}
