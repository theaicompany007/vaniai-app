'use client';

import { useState } from 'react';
import { Bookmark, Sparkles, Mail, Linkedin, MessageCircle, X, Copy, Check, ExternalLink } from 'lucide-react';
import type { Signal } from '@/lib/mock-data';

// ─── Score Dots ───────────────────────────────────────────────────────────────

const TAG_COLORS: Record<string, string> = {
  blue:   'wo-tag-blue',
  green:  'wo-tag-green',
  purple: 'wo-tag-purple',
  orange: 'wo-tag-orange',
  yellow: 'wo-tag-yellow',
};

function ScoreDots({ score }: { score: number }) {
  const full = Math.floor(score);
  const half = score % 1 >= 0.5;
  return (
    <div className="flex items-center gap-1">
      <span className="text-sm font-bold" style={{ color: '#e2e8f0' }}>{score}</span>
      <div className="wo-score-dots">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="wo-score-dot"
            style={{
              background: i <= full ? '#00d9ff'
                : i === full + 1 && half ? 'rgba(0,217,255,0.4)'
                : '#2a2a3e',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Outreach Modal ───────────────────────────────────────────────────────────

type Channel = 'email' | 'linkedin' | 'whatsapp';

const CHANNEL_CONFIG: Record<Channel, { label: string; icon: React.ElementType; color: string }> = {
  email:    { label: 'Draft Email',       icon: Mail,          color: '#00d9ff' },
  linkedin: { label: 'LinkedIn Note',     icon: Linkedin,      color: '#0a66c2' },
  whatsapp: { label: 'WhatsApp Message',  icon: MessageCircle, color: '#25d366' },
};

interface OutreachState {
  type: Channel | null;
  subject: string;
  message: string;
  loading: boolean;
}

function OutreachModal({
  state,
  signal,
  onClose,
  onSubjectChange,
  onMessageChange,
}: {
  state: OutreachState;
  signal: Signal;
  onClose: () => void;
  onSubjectChange: (v: string) => void;
  onMessageChange: (v: string) => void;
}) {
  const [copiedMsg,  setCopiedMsg]  = useState(false);
  const [copiedSubj, setCopiedSubj] = useState(false);

  if (!state.type) return null;
  const cfg  = CHANNEL_CONFIG[state.type];
  const Icon = cfg.icon;

  function copyText(text: string, which: 'msg' | 'subj') {
    navigator.clipboard.writeText(text).then(() => {
      if (which === 'msg') { setCopiedMsg(true);  setTimeout(() => setCopiedMsg(false),  2000); }
      else                 { setCopiedSubj(true); setTimeout(() => setCopiedSubj(false), 2000); }
    });
  }

  function getActionLink(): { label: string; href: string } | null {
    if (state.type === 'email') {
      const s = encodeURIComponent(state.subject);
      const b = encodeURIComponent(state.message);
      return { label: 'Open in Mail Client', href: `mailto:?subject=${s}&body=${b}` };
    }
    if (state.type === 'linkedin') {
      return { label: 'Search on LinkedIn', href: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(signal.company)}` };
    }
    if (state.type === 'whatsapp') {
      return { label: 'Open WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(state.message)}` };
    }
    return null;
  }

  const actionLink = getActionLink();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="wo-card w-full max-w-lg p-6 relative"
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5" style={{ color: cfg.color }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--wo-text)' }}>
              {cfg.label}
            </h2>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(0,217,255,0.1)', color: 'var(--wo-primary)' }}
            >
              {signal.company}
            </span>
          </div>
          <button onClick={onClose} className="wo-topnav-btn">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Loading — Vani thinking animation */}
        {state.loading && (
          <div className="flex flex-col items-center gap-4 py-10">
            <div className="vani-avatar-bot" style={{ width: '3rem', height: '3rem' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/vani-logo.png" alt="Vani" className="h-full w-full object-contain" />
            </div>
            <div className="flex items-center gap-3">
              <div className="vani-thinking-dots"><span /><span /><span /></div>
              <span className="text-sm" style={{ color: 'var(--wo-text-muted)' }}>
                Generating your message…
              </span>
            </div>
          </div>
        )}

        {/* Generated content */}
        {!state.loading && state.message && (
          <div className="flex flex-col gap-3">
            {/* Subject line (email only) */}
            {state.type === 'email' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="wo-label">Subject</label>
                  <button
                    onClick={() => copyText(state.subject, 'subj')}
                    className="flex items-center gap-1 text-xs"
                    style={{ color: 'var(--wo-text-muted)' }}
                  >
                    {copiedSubj ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    {copiedSubj ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <input
                  className="wo-input text-sm"
                  value={state.subject}
                  onChange={(e) => onSubjectChange(e.target.value)}
                />
              </div>
            )}

            {/* Message body */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="wo-label">Message</label>
                <span className="text-xs" style={{ color: 'var(--wo-text-muted)' }}>
                  {state.message.length} chars
                  {state.type === 'linkedin' && ' / 300 max for connection note'}
                  {state.type === 'whatsapp' && ' — keep it short!'}
                </span>
              </div>
              <textarea
                className="wo-input resize-none text-sm"
                rows={state.type === 'email' ? 8 : 4}
                value={state.message}
                onChange={(e) => onMessageChange(e.target.value)}
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() =>
                  copyText(
                    state.type === 'email'
                      ? `Subject: ${state.subject}\n\n${state.message}`
                      : state.message,
                    'msg'
                  )
                }
                className="wo-btn wo-btn-secondary flex-1 text-sm gap-2"
              >
                {copiedMsg ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                {copiedMsg ? 'Copied!' : 'Copy'}
              </button>

              {actionLink && (
                <a
                  href={actionLink.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wo-btn wo-btn-primary flex-1 text-sm gap-2 text-center"
                >
                  <ExternalLink className="w-4 h-4" />
                  {actionLink.label}
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Signal Card ──────────────────────────────────────────────────────────────

export default function SignalCard({ signal, onBookmark }: { signal: Signal; onBookmark?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [outreach, setOutreach] = useState<OutreachState>({
    type: null, subject: '', message: '', loading: false,
  });
  const [showSaveOpp, setShowSaveOpp] = useState(false);
  const [saveOppName, setSaveOppName] = useState('');
  const [savingOpp, setSavingOpp] = useState(false);
  const [savedOpp, setSavedOpp] = useState(false);
  const [saveOppError, setSaveOppError] = useState('');

  async function handleSaveToOpp() {
    const name = saveOppName.trim() || `${signal.company} — Signal`;
    setSavingOpp(true);
    setSaveOppError('');
    try {
      // Resolve account_id + industry + people (contact count for this account)
      let accountId: string | null = null;
      let industry: string | undefined;
      let people = 0;
      const [existingRes, accRes, contactsRes] = await Promise.all([
        fetch('/api/opportunities').catch(() => null),
        fetch('/api/accounts').catch(() => null),
        fetch('/api/contacts').catch(() => null),
      ]);

      if (accRes?.ok) {
        const accs = await accRes.json().catch(() => []);
        const lower = signal.company.toLowerCase();
        const match = Array.isArray(accs)
          ? accs.find((a: { id: string; name: string; industry?: string }) =>
              a.name.toLowerCase().includes(lower) || lower.includes(a.name.toLowerCase())
            )
          : null;
        accountId = match?.id ?? null;
        industry  = match?.industry ?? undefined;
      }

      if (accountId && contactsRes?.ok) {
        const contacts = await contactsRes.json().catch(() => []);
        people = Array.isArray(contacts)
          ? contacts.filter((c: { account_id?: string }) => c.account_id === accountId).length
          : 0;
      }

      // Check for existing opportunity with same name — PATCH missing fields instead of creating duplicate
      let existingOpp: { id: string; account_id?: string; industry?: string; source_url?: string; signal_id?: string; people?: number } | null = null;
      if (existingRes?.ok) {
        const opps = await existingRes.json().catch(() => []);
        existingOpp = Array.isArray(opps)
          ? opps.find((o: { id: string; name: string }) => o.name.toLowerCase() === name.toLowerCase()) ?? null
          : null;
      }

      const signalUrl = signal.url && signal.url !== '#' ? signal.url : null;

      let res: Response;
      if (existingOpp) {
        // PATCH — only fill in blank fields
        const updates: Record<string, string | number | null> = {};
        if (accountId    && !existingOpp.account_id) updates.account_id = accountId;
        if (industry     && !existingOpp.industry)   updates.industry   = industry;
        if (signalUrl    && !existingOpp.source_url) updates.source_url = signalUrl;
        if (signal.id    && !existingOpp.signal_id)  updates.signal_id  = signal.id;
        if (people > 0   && !existingOpp.people)     updates.people     = people;
        if (Object.keys(updates).length === 0) {
          setSavedOpp(true);
          setShowSaveOpp(false);
          setSaveOppName('');
          setSavingOpp(false);
          return;
        }
        res = await fetch('/api/opportunities', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: existingOpp.id, ...updates }),
        });
      } else {
        res = await fetch('/api/opportunities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            account:    signal.company,
            account_id: accountId,
            industry,
            source_url: signalUrl,
            signal_id:  signal.id || undefined,
            people:     people || undefined,
            stage:      'Discovery',
          }),
        });
      }

      if (res.ok) {
        setSavedOpp(true);
        setShowSaveOpp(false);
        setSaveOppName('');
      } else {
        setSaveOppError('Failed to save. Please try again.');
      }
    } catch {
      setSaveOppError('Network error. Please try again.');
    } finally {
      setSavingOpp(false);
    }
  }

  async function openOutreach(type: Channel) {
    setOutreach({ type, subject: '', message: '', loading: true });
    try {
      const res = await fetch('/api/agents/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company:     signal.company,
          title:       signal.title,
          summary:     signal.summary,
          aiRelevance: signal.aiRelevance,
          services:    signal.services,
          tag:         signal.tag,
          type,
        }),
      });
      const data = await res.json();
      setOutreach({
        type,
        subject: data.subject ?? '',
        message: data.message ?? 'Unable to generate message. Please try again.',
        loading: false,
      });
    } catch {
      setOutreach({ type, subject: '', message: 'Network error. Please try again.', loading: false });
    }
  }

  return (
    <>
      <div className="wo-signal-card">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: signal.companyColor }}
            >
              {signal.companyInitials}
            </div>
            <div>
              <h3 className="font-semibold text-sm" style={{ color: '#00d9ff' }}>{signal.company}</h3>
              <p className="text-xs" style={{ color: '#8892a4' }}>
                {signal.url && signal.url !== '#' ? (
                  <a
                    href={signal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                    style={{ color: '#00d9ff' }}
                  >
                    {signal.source}
                  </a>
                ) : (
                  signal.source
                )}
                {' '}&middot; {signal.postedAgo}
              </p>
              <p className="text-xs" style={{ color: '#8892a4' }}>
                Published: <span style={{ color: '#c4cdd8' }}>{signal.publishedDate}</span>
                {' '}&middot; Segment match:{' '}
                <span style={{ color: signal.segmentMatch === 'High' ? '#34d399' : '#8892a4', fontWeight: 500 }}>
                  {signal.segmentMatch}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <ScoreDots score={signal.score} />
            <span className={`wo-tag ${TAG_COLORS[signal.tagColor]}`}>{signal.tag}</span>
            <button
              onClick={onBookmark}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: signal.isBookmarked ? '#f59e0b' : '#8892a4' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              title={signal.isBookmarked ? 'Remove bookmark' : 'Bookmark'}
            >
              <Bookmark className="w-4 h-4" fill={signal.isBookmarked ? '#f59e0b' : 'none'} />
            </button>
            {savedOpp ? (
              <span className="wo-btn text-xs py-1 px-3" style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>
                <Check className="w-3 h-3 inline mr-1" />Saved
              </span>
            ) : showSaveOpp ? (
              <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    className="wo-input text-xs py-1 px-2"
                    style={{ width: 160 }}
                    placeholder={`${signal.company} — Signal`}
                    value={saveOppName}
                    onChange={(e) => { setSaveOppName(e.target.value); setSaveOppError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveToOpp(); if (e.key === 'Escape') setShowSaveOpp(false); }}
                  />
                  <button onClick={handleSaveToOpp} disabled={savingOpp} className="wo-btn wo-btn-primary text-xs py-1 px-2 disabled:opacity-50">
                    {savingOpp ? '…' : 'Save'}
                  </button>
                  <button onClick={() => { setShowSaveOpp(false); setSaveOppError(''); }} className="wo-btn wo-btn-ghost text-xs py-1 px-1.5">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                {saveOppError && (
                  <span className="text-[11px]" style={{ color: '#ef4444' }}>{saveOppError}</span>
                )}
              </div>
            ) : (
              <button onClick={() => setShowSaveOpp(true)} className="wo-btn wo-btn-outline text-xs py-1 px-3">
                Save to opportunity
              </button>
            )}
          </div>
        </div>

        {/* Title */}
        <h4 className="font-semibold mb-2 leading-snug flex items-start gap-2" style={{ color: '#e2e8f0' }}>
          {signal.url && signal.url !== '#' ? (
            <a
              href={signal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline flex-1"
              style={{ color: '#e2e8f0' }}
              title="Open source article"
            >
              {signal.title}
            </a>
          ) : (
            <span className="flex-1">{signal.title}</span>
          )}
          {signal.url && signal.url !== '#' && (
            <a
              href={signal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 mt-0.5 opacity-50 hover:opacity-100 transition-opacity"
              title="Open source article"
            >
              <ExternalLink className="w-3.5 h-3.5" style={{ color: '#00d9ff' }} />
            </a>
          )}
        </h4>

        {/* Summary */}
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm">📋</span>
            <span className="text-xs font-semibold" style={{ color: '#c4cdd8' }}>Summary</span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: '#8892a4' }}>
            {expanded ? signal.summary : signal.summary.slice(0, 180) + '...'}
            <button
              onClick={() => setExpanded(!expanded)}
              className="ml-1 text-xs font-medium"
              style={{ color: '#00d9ff' }}
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          </p>
        </div>

        {/* Services */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="text-xs font-semibold" style={{ color: '#8892a4' }}>Services:</span>
          {signal.services.map((s) => (
            <span key={s} className="wo-tag wo-tag-blue text-[11px]">{s}</span>
          ))}
        </div>

        {/* AI Relevance */}
        <div
          className="rounded-xl p-3 flex items-start gap-2 mb-3"
          style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.15)' }}
        >
          <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#a78bfa' }} />
          <div>
            <span className="text-xs font-semibold" style={{ color: '#a78bfa' }}>AI Relevance</span>
            <p className="text-xs mt-0.5" style={{ color: '#8892a4' }}>{signal.aiRelevance}</p>
          </div>
        </div>

        {/* ── Outreach Actions ── */}
        <div
          className="flex items-center gap-2 pt-2.5"
          style={{ borderTop: '1px solid var(--wo-border)' }}
        >
          <span className="text-xs font-medium mr-1" style={{ color: 'var(--wo-text-muted)' }}>
            Reach out:
          </span>
          <button
            onClick={() => openOutreach('email')}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all font-medium"
            style={{ background: 'rgba(0,217,255,0.08)', color: 'var(--wo-primary)', border: '1px solid rgba(0,217,255,0.2)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,217,255,0.15)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,217,255,0.08)'; }}
          >
            <Mail className="w-3.5 h-3.5" /> Email
          </button>
          <button
            onClick={() => openOutreach('linkedin')}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all font-medium"
            style={{ background: 'rgba(10,102,194,0.1)', color: '#0a66c2', border: '1px solid rgba(10,102,194,0.2)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(10,102,194,0.18)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(10,102,194,0.1)'; }}
          >
            <Linkedin className="w-3.5 h-3.5" /> LinkedIn
          </button>
          <button
            onClick={() => openOutreach('whatsapp')}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all font-medium"
            style={{ background: 'rgba(37,211,102,0.08)', color: '#25d366', border: '1px solid rgba(37,211,102,0.2)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(37,211,102,0.15)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(37,211,102,0.08)'; }}
          >
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </button>
        </div>
      </div>

      {/* Outreach modal (portal-style, rendered outside the card) */}
      {outreach.type && (
        <OutreachModal
          state={outreach}
          signal={signal}
          onClose={() => setOutreach({ type: null, subject: '', message: '', loading: false })}
          onSubjectChange={(v) => setOutreach((s) => ({ ...s, subject: v }))}
          onMessageChange={(v) => setOutreach((s) => ({ ...s, message: v }))}
        />
      )}
    </>
  );
}
