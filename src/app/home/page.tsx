'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, Sparkles, FlaskConical, FileText, Search, Map } from 'lucide-react';
import SignalCard from '@/components/SignalCard';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import PlaybookStartModal from '@/components/PlaybookStartModal';
import type { Signal } from '@/lib/mock-data';

// Raw DB shape (snake_case) — transformed to camelCase Signal before rendering
interface DbSignal {
  id: string;
  company: string;
  company_initials: string;
  company_color: string;
  score: number;
  tag: string;
  tag_color: string;
  source: string;
  posted_ago: string;
  title: string;
  summary: string;
  services: string[];
  ai_relevance: string;
  url: string;
  is_bookmarked: boolean;
  created_at?: string;
}

function toSignal(r: DbSignal): Signal {
  return {
    id: r.id,
    company: r.company,
    companyInitials: r.company_initials ?? r.company.slice(0, 2).toUpperCase(),
    companyColor: r.company_color ?? '#6366f1',
    score: r.score,
    tag: r.tag,
    tagColor: (r.tag_color as Signal['tagColor']) ?? 'blue',
    source: r.source,
    postedAgo: r.posted_ago ?? (r.created_at ? timeAgo(r.created_at) : ''),
    publishedDate: r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '',
    segmentMatch: 'High',
    title: r.title,
    summary: r.summary,
    services: r.services ?? [],
    aiRelevance: r.ai_relevance ?? '',
    url: r.url,
    isBookmarked: r.is_bookmarked ?? false,
  };
}

interface RecentWork {
  label: string;
  time: string;
  dot: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function HomePage() {
  const router = useRouter();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [recentWorks, setRecentWorks] = useState<RecentWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPlaybookModal, setShowPlaybookModal] = useState(false);

  function toggleBookmark(signal: Signal) {
    const next = !signal.isBookmarked;
    // Optimistic update
    setSignals((prev) => prev.map((s) => s.id === signal.id ? { ...s, isBookmarked: next } : s));
    fetch('/api/signals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: signal.id, is_bookmarked: next }),
    }).catch(() => {
      // Revert on failure
      setSignals((prev) => prev.map((s) => s.id === signal.id ? { ...s, isBookmarked: !next } : s));
    });
  }

  useEffect(() => {
    // Retry helper — auth cookie sometimes isn't ready immediately after client-side navigation
    async function fetchWithRetry(url: string, retries = 3, delayMs = 800): Promise<Response> {
      const res = await fetch(url);
      if (!res.ok && retries > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
        return fetchWithRetry(url, retries - 1, delayMs * 1.5);
      }
      return res;
    }

    // Fetch signals with retry
    fetchWithRetry('/api/signals')
      .then((r) => r.ok ? r.json() : [])
      .then((data: DbSignal[]) => {
        setSignals(Array.isArray(data) ? data.slice(0, 3).map(toSignal) : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Fetch recent documents + research sessions with retry
    Promise.all([
      fetchWithRetry('/api/documents').then((r) => r.ok ? r.json() : []),
      fetchWithRetry('/api/research-sessions').then((r) => r.ok ? r.json() : []),
    ]).then(([docs, research]) => {
      const safeDocs = Array.isArray(docs) ? docs : [];
      const safeResearch = Array.isArray(research) ? research : [];
      const works: RecentWork[] = [
        ...safeDocs.slice(0, 2).map((d: { title: string; type: string; created_at: string }) => ({
          label: d.title,
          time: timeAgo(d.created_at),
          dot: '#34d399',
        })),
        ...safeResearch.slice(0, 3).map((r: { name?: string; query?: string; created_at: string }) => ({
          label: r.name ?? r.query ?? 'Research',
          time: timeAgo(r.created_at),
          dot: '#00d9ff',
        })),
      ]
        .sort((a, b) => a.time.localeCompare(b.time))
        .slice(0, 4);
      setRecentWorks(works);
    }).catch(() => {});
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Hero — content only, no banner */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--wo-text)' }}>
            {signals.length > 0 ? `${signals.length} new signals detected` : 'Welcome to Vani'}
          </h1>
          <p className="text-sm" style={{ color: 'var(--wo-text-muted)' }}>
            Signals are based on the current trigger settings. Customize triggers to search more relevant signals.
          </p>
        </div>
        <button
          onClick={() => router.push('/home/signals')}
          className="wo-btn wo-btn-primary flex-shrink-0 text-sm"
        >
          View all signals
        </button>
      </div>

      <div className="flex gap-6">
        {/* Signal Feed */}
        <div className="flex-1 flex flex-col gap-4">
          {loading ? (
            <LoadingSkeleton rows={3} type="card" />
          ) : signals.length === 0 ? (
            <div className="wo-card p-8 text-center" style={{ color: 'var(--wo-text-muted)' }}>
              <Flame className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--wo-border)' }} />
              <p className="font-medium mb-1" style={{ color: 'var(--wo-text)' }}>No signals yet</p>
              <p className="text-sm">Go to Signals and click "Generate Signals" to let Vigil find buying signals.</p>
              <button
                onClick={() => router.push('/home/signals')}
                className="wo-btn wo-btn-primary mt-4 text-sm"
              >
                Go to Signals
              </button>
            </div>
          ) : (
            signals.map((signal) => <SignalCard key={signal.id} signal={signal} onBookmark={() => toggleBookmark(signal)} />)
          )}
        </div>

        {/* Quick Actions + Recent Works */}
        <div className="w-72 flex-shrink-0">
          <div className="wo-card p-4 sticky top-6">
            <h2 className="font-bold mb-3" style={{ color: '#e2e8f0' }}>Quick Actions</h2>
            <div className="flex flex-col gap-1">
              {[
                { label: 'Check Hot Leads',    Icon: Flame,        href: '/home/signals',   color: '#fb923c', bg: 'rgba(251,146,60,0.1)',    modal: false },
                { label: 'Create AI Document', Icon: Sparkles,     href: '/home/documents', color: '#00d9ff', bg: 'rgba(0,217,255,0.08)',    modal: false },
                { label: 'Do Research',        Icon: FlaskConical, href: '/research',       color: '#a78bfa', bg: 'rgba(139,92,246,0.1)',    modal: false },
                { label: 'Chat with Vidya',    Icon: Search,       href: '/home/chat',      color: '#10b981', bg: 'rgba(16,185,129,0.1)',    modal: false },
                { label: 'Run Playbook',       Icon: Map,          href: '/home/playbook',  color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',    modal: true  },
              ].map(({ label, Icon, href, color, bg, modal }) => (
                <button
                  key={label}
                  onClick={() => modal ? setShowPlaybookModal(true) : router.push(href)}
                  className="wo-quick-action"
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: '#c4cdd8' }}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Works */}
          <div className="wo-card p-4 mt-4">
            <h2 className="font-bold mb-3" style={{ color: '#e2e8f0' }}>Recent Works</h2>
            <div className="flex flex-col gap-1">
              {recentWorks.length === 0 ? (
                <p className="text-xs py-2" style={{ color: 'var(--wo-text-muted)' }}>
                  No recent activity yet.
                </p>
              ) : (
                recentWorks.map(({ label, time, dot }) => (
                  <div
                    key={label + time}
                    className="flex items-center justify-between py-2 px-1 rounded-lg cursor-pointer transition-colors"
                    style={{ color: '#8892a4' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dot }} />
                      <span className="text-sm truncate" style={{ color: '#c4cdd8' }}>{label}</span>
                    </div>
                    <span className="text-xs flex-shrink-0 ml-2">{time}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {showPlaybookModal && <PlaybookStartModal onClose={() => setShowPlaybookModal(false)} />}
    </div>
  );
}
