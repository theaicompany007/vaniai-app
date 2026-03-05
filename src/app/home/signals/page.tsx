'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SlidersHorizontal, Bookmark, Search, Clock, Zap, Flame, RefreshCw, X } from 'lucide-react';
import SignalCard from '@/components/SignalCard';
import { ALL_SIGNAL_TYPES } from '@/lib/constants';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import type { Signal } from '@/lib/mock-data';

// Raw snake_case shape from DB — kept in state for bookmarking & filtering
interface DbSignal {
  id: string; company: string; company_initials: string; company_color: string;
  score: number; tag: string; tag_color: string; source: string; posted_ago: string;
  title: string; summary: string; services: string[]; ai_relevance: string;
  url: string; is_bookmarked: boolean; created_at: string;
}

function toSignal(r: DbSignal): Signal {
  return {
    id: r.id, company: r.company,
    companyInitials: r.company_initials ?? r.company.slice(0, 2).toUpperCase(),
    companyColor: r.company_color ?? '#6366f1', score: r.score, tag: r.tag,
    tagColor: (r.tag_color as Signal['tagColor']) ?? 'blue', source: r.source,
    postedAgo: r.posted_ago ?? '',
    publishedDate: r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '',
    segmentMatch: 'High', title: r.title, summary: r.summary,
    services: r.services ?? [], aiRelevance: r.ai_relevance ?? '', url: r.url,
    isBookmarked: r.is_bookmarked ?? false,
  };
}

const SIGNAL_TAGS = ALL_SIGNAL_TYPES;

function SignalsPageInner() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('signal');
  const companyParam = searchParams.get('company');
  const highlightRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'lead' | 'focus'>('lead');
  const [searchQuery, setSearchQuery] = useState(companyParam ?? '');
  const [signals, setSignals] = useState<DbSignal[]>([]);
  const [focusAccounts, setFocusAccounts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [bookmarksOnly, setBookmarksOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterTag, setFilterTag] = useState('');
  const [filterScore, setFilterScore] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const filtersRef = useRef<HTMLDivElement>(null);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    try {
      const [sigRes, accRes] = await Promise.all([
        fetch('/api/signals'),
        fetch('/api/accounts'),
      ]);
      if (sigRes.ok) setSignals(await sigRes.json());
      if (accRes.ok) {
        const accs = await accRes.json();
        setFocusAccounts(
          (Array.isArray(accs) ? accs : [])
            .filter((a: { is_watchlisted?: boolean }) => a.is_watchlisted)
            .map((a: { name?: string }) => (a.name ?? '').toLowerCase())
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSignals(); }, [fetchSignals]);

  // Scroll to and highlight a specific signal when linked from Opportunities
  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightId, signals]);

  // Close filter panel when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) setShowFilters(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function generateSignals(targetCompany?: string) {
    setGenerating(true);
    try {
      const body: { limit: number; keywords?: string } = { limit: 5 };
      // Priority: explicit target (from playbook/search) > focus accounts tab
      if (targetCompany) {
        body.keywords = targetCompany;
      } else if (activeTab === 'focus' && focusAccounts.length > 0) {
        body.keywords = focusAccounts.join(', ');
      } else if (searchQuery.trim()) {
        body.keywords = searchQuery.trim();
      }
      const res = await fetch('/api/agents/vigil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) await fetchSignals();
    } catch (e) {
      console.error('Generate signals failed:', e);
    } finally {
      setGenerating(false);
    }
  }

  async function toggleBookmark(signal: DbSignal) {
    await fetch('/api/signals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: signal.id, is_bookmarked: !signal.is_bookmarked }),
    });
    setSignals((prev) =>
      prev.map((s) => (s.id === signal.id ? { ...s, is_bookmarked: !s.is_bookmarked } : s))
    );
  }

  const bookmarkCount = signals.filter((s) => s.is_bookmarked).length;
  const q = searchQuery.toLowerCase();
  const filtered = signals.filter((s) => {
    const matchSearch = !q || (
      s.company.toLowerCase().includes(q) ||
      s.title.toLowerCase().includes(q) ||
      (s.tag ?? '').toLowerCase().includes(q) ||
      (s.summary ?? '').toLowerCase().includes(q) ||
      (s.ai_relevance ?? '').toLowerCase().includes(q)
    );
    const matchTag = !filterTag || s.tag === filterTag;
    const matchScore = !filterScore || (
      filterScore === 'high' ? s.score >= 75 :
      filterScore === 'medium' ? s.score >= 50 && s.score < 75 :
      s.score < 50
    );
    const matchDate = !filterDate || (() => {
      const created = new Date(s.created_at);
      const ms = Date.now() - created.getTime();
      if (filterDate === '7d') return ms <= 7 * 86400000;
      if (filterDate === '30d') return ms <= 30 * 86400000;
      if (filterDate === '90d') return ms <= 90 * 86400000;
      return true;
    })();
    return matchSearch && matchTag && matchScore && matchDate && (!bookmarksOnly || s.is_bookmarked);
  });

  // Match signals to focus accounts: exact substring, or any significant word (e.g. "Parle Agro" matches "Parle", "Parle Industries")
  const focusFiltered = signals.filter((s) =>
    focusAccounts.some((acc) => {
      const companyLower = s.company.toLowerCase();
      if (companyLower.includes(acc) || acc.includes(companyLower)) return true;
      const accWords = acc.split(/\s+/).filter((w) => w.length > 2);
      return accWords.some((w) => companyLower.includes(w) || companyLower.startsWith(w));
    })
  );

  const activeFiltersCount = (filterTag ? 1 : 0) + (filterScore ? 1 : 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Playbook company banner */}
      {companyParam && (
        <div className="flex items-center justify-between gap-4 mb-4 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(0,217,255,0.07)', border: '1px solid rgba(0,217,255,0.2)' }}>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--wo-primary)' }} />
            <p className="text-sm" style={{ color: 'var(--wo-text)' }}>
              Playbook: finding signals for <strong style={{ color: 'var(--wo-primary)' }}>{companyParam}</strong>
            </p>
          </div>
          <button
            onClick={() => generateSignals(companyParam)}
            disabled={generating}
            className="wo-btn wo-btn-primary text-xs gap-1.5 flex-shrink-0 disabled:opacity-60"
          >
            {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {generating ? 'Generating…' : `Generate for ${companyParam}`}
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm" style={{ color: 'var(--wo-text-muted)' }}>
          Total Signals:{' '}
          <span className="font-semibold" style={{ color: 'var(--wo-text)' }}>
            {signals.length}
          </span>
        </p>
        <div />
      </div>

      {/* Tabs */}
      <div
        className="flex items-center gap-6 mb-5"
        style={{ borderBottom: '1px solid var(--wo-border)' }}
      >
        <button
          onClick={() => setActiveTab('lead')}
          className="pb-3 text-sm font-medium flex items-center gap-1.5 border-b-2 transition-all"
          style={activeTab === 'lead' ? {
            borderColor: 'var(--wo-primary)',
            color: 'var(--wo-primary)',
          } : {
            borderColor: 'transparent',
            color: 'var(--wo-text-muted)',
          }}
        >
          <Flame className="w-4 h-4" />
          Lead Signal
        </button>
        <button
          onClick={() => setActiveTab('focus')}
          className="pb-3 text-sm font-medium flex items-center gap-1.5 border-b-2 transition-all"
          style={activeTab === 'focus' ? {
            borderColor: 'var(--wo-primary)',
            color: 'var(--wo-primary)',
          } : {
            borderColor: 'transparent',
            color: 'var(--wo-text-muted)',
          }}
        >
          <Zap className="w-4 h-4" />
          Focus Accounts
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {/* Filters dropdown */}
        <div className="relative" ref={filtersRef}>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="wo-btn wo-btn-ghost gap-1.5"
            style={{
              border: '1px solid var(--wo-border)',
              color: activeFiltersCount > 0 ? 'var(--wo-primary)' : undefined,
            }}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}
          </button>
          {showFilters && (
            <div
              className="absolute left-0 top-full mt-1 z-30 rounded-xl p-4 flex flex-col gap-3"
              style={{ background: 'var(--wo-surface)', border: '1px solid var(--wo-border)', minWidth: 220, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
            >
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--wo-text-muted)' }}>Signal Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {['', ...SIGNAL_TAGS].map((t) => (
                    <button key={t || 'all'} onClick={() => setFilterTag(t)}
                      className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                      style={{
                        background: filterTag === t ? 'rgba(0,217,255,0.15)' : 'rgba(255,255,255,0.04)',
                        border: filterTag === t ? '1px solid rgba(0,217,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                        color: filterTag === t ? 'var(--wo-primary)' : 'var(--wo-text-muted)',
                      }}>
                      {t || 'All'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--wo-text-muted)' }}>Score</label>
                <div className="flex flex-wrap gap-1.5">
                  {([['', 'All'], ['high', 'High (75+)'], ['medium', 'Medium (50–74)'], ['low', 'Low (<50)']] as [string, string][]).map(([val, label]) => (
                    <button key={val || 'all'} onClick={() => setFilterScore(val)}
                      className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                      style={{
                        background: filterScore === val ? 'rgba(0,217,255,0.15)' : 'rgba(255,255,255,0.04)',
                        border: filterScore === val ? '1px solid rgba(0,217,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                        color: filterScore === val ? 'var(--wo-primary)' : 'var(--wo-text-muted)',
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {activeFiltersCount > 0 && (
                <button
                  className="wo-btn wo-btn-ghost text-xs gap-1 self-start"
                  onClick={() => { setFilterTag(''); setFilterScore(''); }}
                >
                  <X className="w-3 h-3" /> Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => setBookmarksOnly((v) => !v)}
          className="wo-btn wo-btn-ghost gap-1.5"
          style={{
            border: '1px solid var(--wo-border)',
            color: bookmarksOnly ? 'var(--wo-primary)' : undefined,
          }}
        >
          <Bookmark className="w-4 h-4" />
          Bookmarks: {bookmarkCount}
        </button>
        <div className="relative flex-1 max-w-sm">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--wo-text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search company, title, tag, summary…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="wo-input pl-10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--wo-text-muted)' }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--wo-text-muted)' }} />
          {([['', 'All'], ['7d', '7d'], ['30d', '30d'], ['90d', '90d']] as [string, string][]).map(([val, label]) => (
            <button key={val || 'all'} onClick={() => setFilterDate(val)}
              className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
              style={{
                background: filterDate === val ? 'rgba(0,217,255,0.15)' : 'rgba(255,255,255,0.04)',
                border: filterDate === val ? '1px solid rgba(0,217,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                color: filterDate === val ? 'var(--wo-primary)' : 'var(--wo-text-muted)',
              }}>
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => generateSignals()}
          disabled={generating}
          className="wo-btn wo-btn-primary gap-1.5 disabled:opacity-60"
        >
          {generating ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          {generating ? 'Generating...' : 'Generate Signals'}
        </button>
      </div>

      {/* Signal Cards */}
      {activeTab === 'lead' ? (
        loading ? (
          <LoadingSkeleton rows={4} type="card" />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Flame className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--wo-border)' }} />
            {searchQuery ? (
              <>
                <p className="font-medium mb-1" style={{ color: 'var(--wo-text)' }}>
                  No signals found for &quot;{searchQuery}&quot;
                </p>
                <p className="text-sm mb-5" style={{ color: 'var(--wo-text-muted)' }}>
                  Vigil hasn&apos;t scanned for this company yet. Generate signals now to find buying triggers.
                </p>
                <button
                  onClick={() => generateSignals(searchQuery)}
                  disabled={generating}
                  className="wo-btn wo-btn-primary gap-2 disabled:opacity-60"
                >
                  {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {generating ? 'Generating…' : `Generate Signals for ${searchQuery}`}
                </button>
              </>
            ) : (
              <>
                <p className="font-medium mb-1" style={{ color: 'var(--wo-text)' }}>No signals yet</p>
                <p className="text-sm" style={{ color: 'var(--wo-text-muted)' }}>
                  Click &quot;Generate Signals&quot; to let Vigil find buying signals.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map((signal) => (
              <div
                key={signal.id}
                ref={signal.id === highlightId ? highlightRef : null}
                className={signal.id === highlightId ? 'ring-2 ring-offset-2 ring-cyan-400 rounded-2xl transition-all' : ''}
                style={signal.id === highlightId ? { '--tw-ring-offset-color': 'var(--wo-bg)' } as React.CSSProperties : {}}
              >
                <SignalCard signal={toSignal(signal)} onBookmark={() => toggleBookmark(signal)} />
              </div>
            ))}
          </div>
        )
      ) : (
        loading ? (
          <LoadingSkeleton rows={4} type="card" />
        ) : focusAccounts.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--wo-text-muted)' }}>
            <Zap className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--wo-border)' }} />
            <p className="font-medium">No watchlisted accounts yet.</p>
            <p className="text-xs mt-1">
              Go to{' '}
              <a href="/home/accounts" style={{ color: 'var(--wo-primary)' }}>Accounts</a>
              {' '}and click the ★ star on the companies you want to track here.
            </p>
          </div>
        ) : focusFiltered.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--wo-text-muted)' }}>
            <Zap className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--wo-border)' }} />
            <p className="font-medium">No signals yet for your focus accounts.</p>
            <p className="text-xs mt-1 mb-4">
              Tracking: {focusAccounts.map((a) => <span key={a} className="font-semibold" style={{ color: 'var(--wo-primary)' }}>{a}</span>).reduce<React.ReactNode[]>((acc, el, i) => i === 0 ? [el] : [...acc, ', ', el], [])}
            </p>
            <button
              onClick={() => generateSignals()}
              disabled={generating}
              className="wo-btn wo-btn-primary gap-1.5 text-sm"
            >
              {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {generating ? 'Generating...' : 'Generate Signals'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-xs" style={{ color: 'var(--wo-text-muted)' }}>
              Showing signals for: {focusAccounts.map((a) => (
                <span key={a} className="font-semibold px-1.5 py-0.5 rounded mr-1" style={{ background: 'rgba(0,217,255,0.1)', color: 'var(--wo-primary)' }}>{a}</span>
              ))}
            </p>
            {focusFiltered.map((signal) => (
              <div
                key={signal.id}
                ref={signal.id === highlightId ? highlightRef : null}
                className={signal.id === highlightId ? 'ring-2 ring-offset-2 ring-cyan-400 rounded-2xl transition-all' : ''}
                style={signal.id === highlightId ? { '--tw-ring-offset-color': 'var(--wo-bg)' } as React.CSSProperties : {}}
              >
                <SignalCard signal={toSignal(signal)} onBookmark={() => toggleBookmark(signal)} />
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

export default function SignalsPage() {
  return (
    <Suspense>
      <SignalsPageInner />
    </Suspense>
  );
}
