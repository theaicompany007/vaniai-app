'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import html2canvas from 'html2canvas';
import { Flame, Sparkles, Map, Mail, Linkedin, MessageCircle } from 'lucide-react';
import SignalCard from '@/components/SignalCard';
import type { Signal } from '@/lib/mock-data';

// ─── Flyer design tokens ─────────────────────────────────────────────────────
const FLYER_BG = '#080B14';
const TEAL = '#00C9B1';
const PURPLE = '#7C5CFC';
const AMBER = '#F59E0B';

// ─── Fallback mock signals (exact spec from plan) ─────────────────────────────
const FALLBACK_SIGNALS: Signal[] = [
  {
    id: 'flyer-1',
    company: 'Multiple FMCG Companies',
    companyInitials: 'MF',
    companyColor: TEAL,
    score: 4,
    tag: 'Tech Adoption',
    tagColor: 'blue',
    source: 'Business Standard',
    postedAgo: 'just now',
    publishedDate: '',
    segmentMatch: 'High',
    title: "FMCG sector's AI and digital adoption trends in India",
    summary: 'Real-time insights on FMCG sector adoption.',
    services: [],
    aiRelevance: 'High relevance for AI and digital transformation outreach.',
    url: '#',
  },
  {
    id: 'flyer-2',
    company: 'Star Localmart',
    companyInitials: 'SL',
    companyColor: '#14b8a6',
    score: 4.5,
    tag: 'Tech Adoption',
    tagColor: 'blue',
    source: 'EY report',
    postedAgo: 'just now',
    publishedDate: '',
    segmentMatch: 'High',
    title: "Star Localmart's Tech Expansion with 20,000 Vending Machines",
    summary: 'Tech expansion and vending machine rollout.',
    services: [],
    aiRelevance: 'Strong fit for retail tech and automation.',
    url: '#',
  },
  {
    id: 'flyer-3',
    company: 'Unilever',
    companyInitials: 'UL',
    companyColor: '#6366f1',
    score: 5,
    tag: 'Leadership',
    tagColor: 'purple',
    source: 'LinkedIn',
    postedAgo: 'just now',
    publishedDate: '',
    segmentMatch: 'High',
    title: 'Unilever appoints Reema Jain as CIO, focusing on AI',
    summary: 'New CIO appointment with AI focus.',
    services: [],
    aiRelevance: 'Leadership change signals buying intent for AI solutions.',
    url: '#',
  },
];

// ─── Demo / override signals (for ?company= or ?demo=) ───────────────────────
const PARLE_AGRO_SIGNAL: Signal = {
  id: 'flyer-parle',
  company: 'Parle Agro',
  companyInitials: 'PA',
  companyColor: '#ec4899',
  score: 4.5,
  tag: 'Expansion',
  tagColor: 'blue',
  source: 'Economic Times',
  postedAgo: 'just now',
  publishedDate: '3/3/2026',
  segmentMatch: 'High',
  title: 'Parle Agro sets Rs 30,000 crore revenue target with expansion',
  summary: 'Parle Agro has announced its ambitious plans to expand its distribution reach to 4 million outlets and set a revenue target of Rs 30,000 crore. The company plans to introduce new p...',
  services: [],
  aiRelevance: "Parle Agro's expansion and focus on increasing distribution channels signal a potential need for advanced ERP and digital transformation services to support their growing operations and ambitious revenue goals.",
  url: '#',
};

/** Predefined signal sets for flyer control. Use ?demo=parle-agro or ?company=Parle Agro */
const DEMO_SIGNALS: Record<string, Signal[]> = {
  'parle-agro': [PARLE_AGRO_SIGNAL, FALLBACK_SIGNALS[1], FALLBACK_SIGNALS[2]],
  'parle': [PARLE_AGRO_SIGNAL, FALLBACK_SIGNALS[1], FALLBACK_SIGNALS[2]],
};

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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
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

// ─── Capture target: Signals (full-width snapshot) ─────────────────────────────
const CAPTURE_WIDTH = 920;

function CaptureTargetSignals({ signals }: { signals: Signal[] }) {
  const list = signals.length > 0 ? signals : FALLBACK_SIGNALS;
  return (
    <div
      className="flex flex-col gap-3 p-4 rounded-2xl"
      style={{
        width: CAPTURE_WIDTH,
        background: '#0d0d14',
        border: '1px solid #1e1e2e',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h1 className="text-base font-bold" style={{ color: '#e2e8f0' }}>
          {list.length} new signals detected
        </h1>
        <button
          type="button"
          className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #00b8d9, #0099b8)', color: '#fff' }}
        >
          View all
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {list.slice(0, 3).map((s) => (
          <SignalCard key={s.id} signal={s} onBookmark={() => {}} />
        ))}
      </div>
    </div>
  );
}

function FlyerPageContent() {
  const searchParams = useSearchParams();
  const signalsCaptureRef = useRef<HTMLDivElement>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [signalsImage, setSignalsImage] = useState<string | null>(null);
  const [captureDone, setCaptureDone] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [queryOverride, setQueryOverride] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [showAllCompanies, setShowAllCompanies] = useState(false);

  const companyParam = searchParams.get('company')?.toLowerCase().trim();
  const demoParam = searchParams.get('demo')?.toLowerCase().trim();

  useEffect(() => {
    async function fetchData() {
      // Use creator org signals (CREATOR_ORG_SLUG, e.g. rajvins@theaicompany.co) for flyer content
      const res = await fetch('/api/flyer/signals');
      if (res.ok) {
        const data: DbSignal[] = await res.json();
        if (Array.isArray(data)) {
          setSignals(data.map(toSignal));
        }
      }
      setDataReady(true);
    }
    fetchData();
  }, []);

  // Only companies we have signals for (API + fallback + Parle). No demo-only names so every button shows real data.
  const allCollectedCompanies = (() => {
    const fromApi = signals.map((s) => s.company);
    const fromFallback = FALLBACK_SIGNALS.map((s) => s.company);
    const fromDemo = ['Parle Agro'];
    const uniq = Array.from(new Set([...fromApi, ...fromFallback, ...fromDemo]))
      .filter(Boolean)
      .sort();
    return uniq;
  })();

  const filterLower = companyFilter.toLowerCase().trim();
  const filteredCompanies = filterLower
    ? allCollectedCompanies.filter((c) => c.toLowerCase().includes(filterLower))
    : allCollectedCompanies;

  const COMPANY_BUTTON_LIMIT = 7;
  const visibleCompanies = showAllCompanies ? filteredCompanies : filteredCompanies.slice(0, COMPANY_BUTTON_LIMIT);
  const hasMoreCompanies = filteredCompanies.length > COMPANY_BUTTON_LIMIT;

  useEffect(() => {
    if (!dataReady || captureDone || !signalsCaptureRef.current) return;
    const timer = setTimeout(async () => {
      try {
        const canvas = await html2canvas(signalsCaptureRef.current!, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#0d0d14',
          logging: false,
        });
        setSignalsImage(canvas.toDataURL('image/png'));
      } finally {
        setCaptureDone(true);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [dataReady, captureDone]);

  // Resolve company/demo from embedded query input, then URL params
  const effectiveQuery = queryOverride.trim() || null;
  const effectiveDemo = effectiveQuery && DEMO_SIGNALS[effectiveQuery.toLowerCase()] ? effectiveQuery.toLowerCase() : null;
  const effectiveCompany = effectiveQuery && !effectiveDemo ? effectiveQuery : null;

  const displaySignals = (() => {
    if (effectiveDemo && DEMO_SIGNALS[effectiveDemo]) return DEMO_SIGNALS[effectiveDemo];
    const c = effectiveCompany?.toLowerCase();
    if (c === 'parle agro' || c === 'parle') return DEMO_SIGNALS['parle-agro'];
    if (effectiveCompany) {
      const fromApi = signals.filter((s) => s.company.toLowerCase().includes(effectiveCompany.toLowerCase()));
      if (fromApi.length > 0) return fromApi.slice(0, 3);
      const fromFallback = FALLBACK_SIGNALS.filter((s) => s.company.toLowerCase().includes(effectiveCompany.toLowerCase()));
      if (fromFallback.length > 0) return fromFallback.slice(0, 3);
      if (effectiveCompany.toLowerCase() === 'parle agro') return DEMO_SIGNALS['parle-agro'];
    }
    if (!effectiveQuery && demoParam && DEMO_SIGNALS[demoParam]) return DEMO_SIGNALS[demoParam];
    if (!effectiveQuery && companyParam === 'parle agro') return DEMO_SIGNALS['parle-agro'];
    if (!effectiveQuery && companyParam) {
      const fromApi = signals.filter((s) => s.company.toLowerCase().includes(companyParam));
      if (fromApi.length > 0) return fromApi.slice(0, 3);
      const fromFallback = FALLBACK_SIGNALS.filter((s) => s.company.toLowerCase().includes(companyParam));
      if (fromFallback.length > 0) return fromFallback.slice(0, 3);
    }
    return signals.length > 0 ? signals.slice(0, 3) : FALLBACK_SIGNALS;
  })();

  const handleQueryChange = (value: string) => {
    setQueryOverride(value);
    setCaptureDone(false);
    setSignalsImage(null);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          .print-only { display: none !important; }
          @media print {
            @page { size: 11.25in 14.0625in; margin: 0; }
            html, body {
              margin: 0 !important; padding: 0 !important;
              width: 1080px !important; height: 1350px !important;
              min-width: 1080px !important; min-height: 1350px !important;
              max-width: 1080px !important; max-height: 1350px !important;
              overflow: hidden !important;
              background: #080B14 !important;
            }
            .flyer-print-wrapper {
              margin: 0 !important; padding: 0 !important; gap: 0 !important;
              width: 1080px !important; height: 1350px !important;
              min-height: auto !important; max-height: 1350px !important;
              overflow: hidden !important;
            }
            .flyer-canvas {
              page-break-before: avoid !important;
              page-break-after: avoid !important;
              page-break-inside: avoid !important;
            }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .print-only { display: block !important; }
            .no-print-link { color: inherit; text-decoration: none; }
            .flyer-query-control { display: none !important; }
          }
        `,
      }} />
      <div
        className="flyer-print-wrapper min-h-screen flex flex-col items-center p-4 gap-4"
        style={{ background: '#050509' }}
      >
        {/* Query control — hidden when printing */}
        <div
          className="flyer-query-control flex flex-col gap-2 w-full max-w-[1080px] px-4 py-3 rounded-xl border"
          style={{
            background: '#0d0d14',
            borderColor: 'rgba(0,201,177,0.3)',
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              placeholder="Filter companies…"
              className="min-w-[140px] px-2.5 py-1.5 rounded-lg text-xs border bg-black/30"
              style={{
                borderColor: 'rgba(255,255,255,0.15)',
                color: '#e2e8f0',
              }}
            />
            <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>
              Show signals for:
            </span>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
              ({allCollectedCompanies.length} companies)
            </span>
          </div>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto overflow-x-hidden pr-1">
            <button
              type="button"
              onClick={() => handleQueryChange('')}
              className="px-3 py-2 rounded-lg text-sm font-medium border transition-colors flex-shrink-0"
              style={{
                background: !queryOverride ? 'rgba(0,201,177,0.2)' : '#1a1a2e',
                borderColor: !queryOverride ? TEAL : 'rgba(255,255,255,0.2)',
                color: '#e2e8f0',
              }}
            >
              Default
            </button>
            {visibleCompanies.map((company) => {
              const isActive = queryOverride.toLowerCase() === company.toLowerCase();
              return (
                <button
                  key={company}
                  type="button"
                  onClick={() => handleQueryChange(company)}
                  className="px-3 py-2 rounded-lg text-sm font-medium border transition-colors flex-shrink-0"
                  style={{
                    background: isActive ? 'rgba(0,201,177,0.2)' : '#1a1a2e',
                    borderColor: isActive ? TEAL : 'rgba(255,255,255,0.2)',
                    color: '#e2e8f0',
                  }}
                >
                  {company}
                </button>
              );
            })}
            {hasMoreCompanies && (
              <button
                type="button"
                onClick={() => setShowAllCompanies((v) => !v)}
                className="px-3 py-2 rounded-lg text-sm font-medium border transition-colors flex-shrink-0"
                style={{
                  background: '#1a1a2e',
                  borderColor: 'rgba(0,201,177,0.5)',
                  color: TEAL,
                }}
              >
                {showAllCompanies ? 'Show less' : `More (+${filteredCompanies.length - COMPANY_BUTTON_LIMIT})`}
              </button>
            )}
          </div>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Showing: {displaySignals.length ? displaySignals.map((s) => s.company).join(', ') : '—'}
          </span>
        </div>

        <div
          className="flyer-canvas relative overflow-hidden rounded-lg"
          style={{
            width: 1080,
            height: 1350,
            background: FLYER_BG,
          }}
        >
          {/* Background blobs */}
          <div
            className="absolute pointer-events-none w-[600px] h-[600px] rounded-full blur-[120px] -top-40 -left-40"
            style={{ background: TEAL, opacity: 0.13 }}
          />
          <div
            className="absolute pointer-events-none w-[500px] h-[500px] rounded-full blur-[100px] -top-32 -right-32"
            style={{ background: PURPLE, opacity: 0.14 }}
          />
          <div
            className="absolute pointer-events-none w-[700px] h-[700px] rounded-full blur-[140px] bottom-0 left-1/2 -translate-x-1/2"
            style={{ background: TEAL, opacity: 0.08 }}
          />

          <div className="relative z-10 flex flex-col h-full px-10 pt-6 pb-6 overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between mb-4 flex-shrink-0">
              <div className="flex items-center gap-3 font-vani-brand">
                <Image
                  src="/vani-logo.png"
                  alt="Vani"
                  width={40}
                  height={40}
                  className="flex-shrink-0 rounded-xl object-contain"
                />
                <span
                  className="text-xl font-bold bg-clip-text text-transparent"
                  style={{ backgroundImage: `linear-gradient(135deg, ${TEAL}, ${PURPLE})` }}
                >
                  Vani AI
                </span>
              </div>
              <div
                className="text-sm font-medium px-4 py-2 rounded-full border"
                style={{ borderColor: TEAL, color: 'rgba(255,255,255,0.9)' }}
              >
                Don&apos;t app, just talk.
              </div>
            </header>

            {/* Hero */}
            <section className="text-center mb-4 flex-shrink-0">
              <div
                className="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-2"
                style={{
                  background: `linear-gradient(90deg, ${TEAL}20, ${PURPLE}20)`,
                  color: 'rgba(255,255,255,0.9)',
                }}
              >
                AI Sales Intelligence Platform
              </div>
              <h1 className="font-vani-brand text-[48px] font-black leading-tight mb-2" style={{ color: '#fff' }}>
                Know who to call.
                <br />
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: `linear-gradient(135deg, ${TEAL}, ${PURPLE})` }}
                >
                  Know exactly what to say.
                </span>
              </h1>
              <p className="text-sm max-w-[640px] mx-auto" style={{ color: 'rgba(255,255,255,0.7)' }}>
                Vani monitors thousands of sources in real time, surfaces buying signals, and gives your team AI-powered outreach — before your competition even notices.
              </p>
            </section>

            {/* Single full-width Signals snapshot */}
            <section className="flex-1 min-h-0 flex flex-col mb-4">
              <div className="relative flex-1 min-h-0 flex flex-col rounded-2xl overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.1)', background: '#0a0a12' }}>
                <div
                  className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
                  style={{ background: '#1a1a2e', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <span className="w-3 h-3 rounded-full bg-[#ef4444]" />
                  <span className="w-3 h-3 rounded-full bg-[#eab308]" />
                  <span className="w-3 h-3 rounded-full bg-[#22c55e]" />
                  <span className="text-xs ml-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    vaniai.theaicompany.co/home/signals
                  </span>
                </div>
                <div className="p-3 flex-1 min-h-0 relative overflow-hidden" style={{ background: '#080B14' }}>
                  {signalsImage ? (
                    <img
                      src={signalsImage}
                      alt="Signals"
                      className="absolute inset-0 w-full h-full object-cover rounded-lg"
                      style={{ objectPosition: 'top center' }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: TEAL }} />
                      <span className="text-sm">Loading signals…</span>
                    </div>
                  )}
                </div>
                <p className="text-center text-xs py-2 font-medium flex-shrink-0" style={{ color: TEAL }}>
                  Real-time buying signals — scored, ranked, and ready for outreach
                </p>
              </div>
            </section>

            {/* Feature cards — icons match app (Flame, Sparkles, Map) */}
            <section className="grid grid-cols-3 gap-3 mb-4 flex-shrink-0">
              {[
                { border: TEAL, Icon: Flame, title: 'Live Buying Signals', desc: 'Vani scans news, LinkedIn & EY reports in real time and scores every signal by relevance to your business.' },
                { border: PURPLE, Icon: Sparkles, title: 'AI-Powered Outreach', desc: 'One-click personalised messaging via Email, LinkedIn, and WhatsApp — written by Vani, sent by you.' },
                { border: AMBER, Icon: Map, title: 'Automated Playbooks', desc: 'Define your ICP and triggers once. Vani runs your sales playbook 24/7, so you never miss a warm lead.' },
              ].map(({ border, Icon, title, desc }) => (
                <div
                  key={title}
                  className="rounded-xl p-4 border border-white/10 pt-4"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    borderTopWidth: 3,
                    borderTopColor: border,
                  }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2" style={{ background: `${border}20` }}>
                    <Icon className="w-5 h-5" style={{ color: border }} />
                  </div>
                  <h3 className="font-bold text-white text-sm mb-0.5">{title}</h3>
                  <p className="text-xs leading-snug" style={{ color: 'rgba(255,255,255,0.6)' }}>{desc}</p>
                </div>
              ))}
            </section>

            {/* Divider */}
            <div
              className="h-px w-full mb-3 flex-shrink-0"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)' }}
            />

            {/* Social proof */}
            <section className="text-center mb-3 flex-shrink-0">
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Signals detected for brands like
              </p>
              <p className="text-base font-bold" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Unilever · Star Localmart · Multiple FMCG Companies · Parle Agro · boAt
              </p>
            </section>

            {/* CTA */}
            <section
              className="rounded-2xl p-5 border flex flex-col items-center text-center mb-3 flex-shrink-0"
              style={{
                background: `linear-gradient(180deg, ${TEAL}18, ${PURPLE}18)`,
                borderColor: 'rgba(255,255,255,0.1)',
              }}
            >
              <div
                className="w-full h-px mb-3 rounded-full"
                style={{ background: `linear-gradient(90deg, transparent, ${TEAL}, transparent)` }}
              />
              <h2 className="text-2xl font-black text-white mb-1">Stop guessing. Start closing.</h2>
              <p className="text-xs mb-3 max-w-xl" style={{ color: 'rgba(255,255,255,0.7)' }}>
                Join sales teams using Vani to reach prospects with the right message at the right time.
              </p>
              <div className="flex gap-3 flex-wrap justify-center">
                <a
                  href="https://vaniai.theaicompany.co"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-white text-sm"
                  style={{ background: `linear-gradient(135deg, ${TEAL}, ${PURPLE})` }}
                >
                  Book a Free Demo →
                </a>
                <a
                  href="https://vaniai.theaicompany.co"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm border"
                  style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.9)' }}
                >
                  See It in Action
                </a>
              </div>
              <p className="text-[10px] mt-2 flex flex-wrap items-center justify-center gap-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <span>vaniai.theaicompany.co</span>
                <span>·</span>
                <a href="mailto:rajvins@theaicompany.co" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-medium transition-colors hover:opacity-90 no-print-link" style={{ borderColor: 'rgba(0,201,177,0.4)', color: TEAL, background: 'rgba(0,201,177,0.08)' }} title="Email">
                  <Mail className="w-3.5 h-3.5" /> Email
                </a>
                <a href="https://www.linkedin.com/in/rajvindersingh007/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-medium transition-colors hover:opacity-90 no-print-link" style={{ borderColor: 'rgba(10,102,194,0.4)', color: '#0a66c2', background: 'rgba(10,102,194,0.08)' }} title="LinkedIn">
                  <Linkedin className="w-3.5 h-3.5" /> LinkedIn
                </a>
                <a href="https://wa.me/919873154007" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-medium transition-colors hover:opacity-90 no-print-link" style={{ borderColor: 'rgba(37,211,102,0.4)', color: '#25d366', background: 'rgba(37,211,102,0.08)' }} title="WhatsApp">
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </a>
              </p>
              <p className="print-only text-[9px] mt-1.5 text-center" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Contact: vaniai.theaicompany.co · rajvins@theaicompany.co · linkedin.com/in/rajvindersingh007 · WhatsApp +91 9873154007
              </p>
              <div className="flex flex-col items-center mt-3">
                <a href="https://vaniai.theaicompany.co" target="_blank" rel="noopener noreferrer" className="block p-2 rounded-xl" style={{ background: '#fff' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent('https://vaniai.theaicompany.co')}`}
                    alt="QR code: vaniai.theaicompany.co"
                    width={100}
                    height={100}
                    className="block"
                  />
                </a>
                <span className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Scan to visit</span>
              </div>
            </section>

            {/* Footer */}
            <footer className="flex items-center justify-between text-[10px] flex-shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <span>© 2025 The AI Company</span>
              <span
                className="font-vani-brand font-semibold bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(135deg, ${TEAL}, ${PURPLE})` }}
              >
                Vani AI — Sales Intelligence
              </span>
              <span>vaniai.theaicompany.co</span>
            </footer>
          </div>
        </div>
      </div>

      {/* Hidden capture target (off-screen) */}
      <div aria-hidden className="fixed left-[-9999px] top-0" style={{ width: CAPTURE_WIDTH }}>
        <div ref={signalsCaptureRef}>
          <CaptureTargetSignals signals={displaySignals} />
        </div>
      </div>
    </>
  );
}

function FlyerPageFallback() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 p-8"
      style={{ width: 1080, minHeight: 1350, background: FLYER_BG }}
    >
      <span style={{ color: 'rgba(255,255,255,0.6)' }}>Loading flyer…</span>
    </div>
  );
}

export default function FlyerPage() {
  return (
    <Suspense fallback={<FlyerPageFallback />}>
      <FlyerPageContent />
    </Suspense>
  );
}
