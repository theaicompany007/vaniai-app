'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Globe } from 'lucide-react';
import Image from 'next/image';

export default function CompleteSetupPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch('/api/auth/session', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.orgId) {
          router.replace('/home');
          return;
        }
        if (!data?.userId) {
          router.replace('/auth/login?next=' + encodeURIComponent('/auth/complete-setup'));
          return;
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/create-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          org_name: orgName.trim(),
          company_website_url: websiteUrl.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push('/home');
        router.refresh();
        return;
      }
      setError((data.error as string) ?? 'Failed to create organization');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--wo-bg)' }}>
        <p className="text-sm" style={{ color: 'var(--wo-text-muted)' }}>Loading…</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--wo-bg)' }}
    >
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 justify-center mb-8">
          <Image src="/vani-logo.png" alt="Vani" width={56} height={56} className="rounded-2xl object-contain" />
          <span className="text-lg font-bold" style={{ color: 'var(--wo-text)' }}>Complete your setup</span>
        </div>

        <div className="wo-card p-8">
          <p className="text-sm mb-6" style={{ color: 'var(--wo-text-muted)' }}>
            Create your organization to get started with Vani.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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

            {error && (
              <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={loading || !orgName.trim()} className="wo-btn wo-btn-primary w-full mt-1 disabled:opacity-50">
              {loading ? 'Creating…' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
