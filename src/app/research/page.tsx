'use client';

import { useState, useCallback, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Home,
  ChevronRight,
  Plus,
  FileText,
  Newspaper,
  Send,
  Globe,
  Copy,
  Check,
  BookmarkPlus,
  Bookmark,
  Clock,
  X,
  Users,
  Search,
  Mic,
  MicOff,
  ChevronDown,
  ChevronLeft,
  Building2,
  TrendingUp,
  GitCompare,
  Radio,
  Target,
  Briefcase,
  Pin,
  type LucideIcon,
} from 'lucide-react';
import { useSpeechInput } from '@/hooks/useSpeechInput';
import { usePlaybook } from '@/context/PlaybookContext';
import { INDUSTRY_OPTIONS, ALL_SIGNAL_TYPES } from '@/lib/constants';

// ─── Research prompt cards (SPARK-style: icon, title, detailed description) ───
const RESEARCH_TEMPLATES: { id: string; title: string; prompt: string; accent: string; Icon: LucideIcon }[] = [
  {
    id: '1',
    title: 'Company Deep Dive',
    prompt: 'Perform a deep dive research on [company]. Cover: key initiatives and capabilities, leadership team and org structure, recent news and initiatives, buying signals and budget indicators, pain points and recommended sales entry points.',
    accent: 'violet',
    Icon: Building2,
  },
  {
    id: '2',
    title: 'Market Intelligence',
    prompt: 'Research market trends and expansion opportunities for [company/industry]. Include: market size and growth, key players and dynamics, regulatory or macro factors, whitespace opportunities, and recommended positioning.',
    accent: 'cyan',
    Icon: TrendingUp,
  },
  {
    id: '3',
    title: 'Competitor Analysis',
    prompt: 'Research the competitor landscape for [company/space]. Map main competitors, their strengths and weaknesses, pricing and GTM, differentiation angles, and where we can win or partner.',
    accent: 'emerald',
    Icon: GitCompare,
  },
  {
    id: '4',
    title: 'Signal Analysis',
    prompt: 'Analyze this buying signal and recommend an approach: [describe signal]. Explain relevance, urgency, who to contact, suggested messaging, and next steps to convert.',
    accent: 'orange',
    Icon: Radio,
  },
  {
    id: '5',
    title: 'Account Strategy',
    prompt: 'Build a strategic entry plan for target account [company]. Include: key stakeholders and champions, current state and initiatives, entry points and sequence, objection handling, and success metrics.',
    accent: 'pink',
    Icon: Target,
  },
  {
    id: '6',
    title: 'Industry Briefing',
    prompt: 'Provide a rapid industry briefing on [industry]. Cover: current challenges and priorities, adoption trends, budget and buying behavior, and how our solutions fit.',
    accent: 'amber',
    Icon: Briefcase,
  },
];

export type PromptContext = { company: string; industry: string; describeSignal: string };

function fillPromptPlaceholders(
  prompt: string,
  ctx: PromptContext
): string {
  const company = (ctx.company || '').trim();
  const industry = (ctx.industry || '').trim();
  const signal = (ctx.describeSignal || '').trim();
  return prompt
    .replace(/\[company\/industry\]/gi, company && industry ? `${company} / ${industry}` : '[company/industry]')
    .replace(/\[company\/space\]/gi, company ? company : '[company/space]')
    .replace(/\[describe signal\]/gi, signal || '[describe signal]')
    .replace(/\[company\]/gi, company || '[company]')
    .replace(/\[industry\]/gi, industry || '[industry]');
}

type PromptSegment = { text: string; type: 'normal' | 'filled' | 'placeholder' };

function placeholderRegex() {
  return /\[(?:company\/industry|company\/space|describe signal|company|industry)\]/gi;
}

function getPromptDisplaySegments(filledPrompt: string, ctx: PromptContext): PromptSegment[] {
  const company = (ctx.company || '').trim();
  const industry = (ctx.industry || '').trim();
  const signal = (ctx.describeSignal || '').trim();
  const values: string[] = [];
  if (company) values.push(company);
  if (industry) values.push(industry);
  if (company && industry) values.push(`${company} / ${industry}`);
  if (signal) values.push(signal);
  const uniq = Array.from(new Set(values)).filter(Boolean).sort((a, b) => b.length - a.length);
  const ranges: { start: number; end: number }[] = [];
  for (const val of uniq) {
    let idx = 0;
    while (idx < filledPrompt.length) {
      const pos = filledPrompt.indexOf(val, idx);
      if (pos === -1) break;
      ranges.push({ start: pos, end: pos + val.length });
      idx = pos + 1;
    }
  }
  ranges.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ start: r.start, end: r.end });
    }
  }
  const segments: PromptSegment[] = [];
  let prev = 0;
  for (const { start, end } of merged) {
    if (start > prev) segments.push({ text: filledPrompt.slice(prev, start), type: 'normal' });
    segments.push({ text: filledPrompt.slice(start, end), type: 'filled' });
    prev = end;
  }
  if (prev < filledPrompt.length) segments.push({ text: filledPrompt.slice(prev), type: 'normal' });
  const raw = segments.length ? segments : [{ text: filledPrompt, type: 'normal' as const }];
  const withPlaceholders: PromptSegment[] = [];
  for (const seg of raw) {
    if (seg.type !== 'normal') {
      withPlaceholders.push(seg);
      continue;
    }
    const re = placeholderRegex();
    const parts = seg.text.split(re);
    const matches = seg.text.match(placeholderRegex()) || [];
    for (let i = 0; i < parts.length; i++) {
      if (parts[i]) withPlaceholders.push({ text: parts[i], type: 'normal' });
      if (i < matches.length) withPlaceholders.push({ text: matches[i], type: 'placeholder' });
    }
  }
  return withPlaceholders.length ? withPlaceholders : [{ text: filledPrompt, type: 'normal' }];
}

const PROMPT_CONTEXT_STORAGE_KEY = 'vaniai_prompt_context';

function loadPromptContextFromStorage(): PromptContext {
  if (typeof window === 'undefined') return { company: '', industry: '', describeSignal: '' };
  try {
    const raw = localStorage.getItem(PROMPT_CONTEXT_STORAGE_KEY);
    if (!raw) return { company: '', industry: '', describeSignal: '' };
    const parsed = JSON.parse(raw) as Partial<PromptContext>;
    return {
      company: typeof parsed.company === 'string' ? parsed.company : '',
      industry: typeof parsed.industry === 'string' ? parsed.industry : '',
      describeSignal: typeof parsed.describeSignal === 'string' ? parsed.describeSignal : '',
    };
  } catch {
    return { company: '', industry: '', describeSignal: '' };
  }
}

// ─── Quick context form for pre-filling prompt placeholders ───
function PromptContextForm({
  context,
  onChange,
  playbookHint,
  compact = false,
}: {
  context: PromptContext;
  onChange: (c: PromptContext) => void;
  playbookHint?: { company: string; industry: string } | null;
  compact?: boolean;
}) {
  const fromPlaybook = playbookHint && (playbookHint.company || playbookHint.industry);
  const labelClass = compact ? 'text-[10px] font-medium text-[var(--wo-text-muted)] mb-1' : 'text-xs font-medium mb-1.5';
  const inputClass = compact
    ? 'w-full px-2 py-1.5 rounded-lg border text-xs bg-[var(--wo-bg)] border-[var(--wo-border)] focus:border-[var(--wo-primary)] outline-none'
    : 'w-full px-3 py-2 rounded-lg border text-sm bg-[var(--wo-bg)] border-[var(--wo-border)] focus:border-[var(--wo-primary)] outline-none';
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3 p-4 rounded-xl border bg-[var(--wo-surface)] border-[var(--wo-border)]'}>
      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--wo-text-muted)' }}>
        Quick context for prompts
      </p>
      {fromPlaybook && (
        <p className="text-[10px]" style={{ color: 'var(--wo-primary)' }}>
          From playbook: {[playbookHint!.company, playbookHint!.industry].filter(Boolean).join(', ')}
        </p>
      )}
      <div>
        <label className={labelClass} style={{ color: 'var(--wo-text-muted)' }}>Company</label>
        <input
          type="text"
          placeholder="e.g. Acme Corp"
          value={context.company}
          onChange={e => onChange({ ...context, company: e.target.value })}
          className={inputClass}
          style={{ color: 'var(--wo-text)' }}
        />
      </div>
      <div>
        <label className={labelClass} style={{ color: 'var(--wo-text-muted)' }}>Industry</label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {INDUSTRY_OPTIONS.map((ind) => (
            <button
              key={ind}
              type="button"
              onClick={() => onChange({ ...context, industry: context.industry === ind ? '' : ind })}
              className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
              style={{
                background: context.industry === ind ? 'rgba(0,217,255,0.15)' : 'rgba(255,255,255,0.04)',
                border: context.industry === ind ? '1px solid rgba(0,217,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                color: context.industry === ind ? 'var(--wo-primary)' : 'var(--wo-text-muted)',
              }}
            >
              {ind}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Or type custom industry…"
          value={INDUSTRY_OPTIONS.includes(context.industry) ? '' : context.industry}
          onChange={e => onChange({ ...context, industry: e.target.value })}
          className={inputClass + ' mt-2'}
          style={{ color: 'var(--wo-text)' }}
        />
      </div>
      <div>
        <label className={labelClass} style={{ color: 'var(--wo-text-muted)' }}>Describe signal (optional)</label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {ALL_SIGNAL_TYPES.map((sig) => (
            <button
              key={sig}
              type="button"
              onClick={() => onChange({ ...context, describeSignal: context.describeSignal === sig ? '' : sig })}
              className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
              style={{
                background: context.describeSignal === sig ? 'rgba(0,217,255,0.15)' : 'rgba(255,255,255,0.04)',
                border: context.describeSignal === sig ? '1px solid rgba(0,217,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                color: context.describeSignal === sig ? 'var(--wo-primary)' : 'var(--wo-text-muted)',
              }}
            >
              {sig}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Or type custom signal (e.g. New CFO, expansion news)…"
          value={ALL_SIGNAL_TYPES.includes(context.describeSignal) ? '' : context.describeSignal}
          onChange={e => onChange({ ...context, describeSignal: e.target.value })}
          className={inputClass + ' mt-2'}
          style={{ color: 'var(--wo-text)' }}
        />
      </div>
    </div>
  );
}

// ─── Rotating hero copy (heading + subheading) ────────────────────────────────
const RESEARCH_HERO_VARIANTS: { heading: string; subheading: string }[] = [
  // Concise punchy two-liners (top recommendation first)
  { heading: 'Research Smarter. Sell Faster.', subheading: 'Ask Vivek anything — unlimited follow-ups, zero friction.' },
  { heading: 'Every Answer. Every Account. Instantly.', subheading: 'Vivek is your always-on sales intelligence engine.' },
  { heading: 'Stop Guessing. Start Winning.', subheading: 'Ask Vivek — deep research in seconds, not hours.' },
  { heading: 'Your Unfair Sales Advantage.', subheading: 'Ask anything. Vivek never runs out of answers.' },
  // Bold & power-driven
  { heading: 'Research at the Speed of Thought.', subheading: 'Ask Vivek anything — unlimited follow-ups, zero friction.' },
  { heading: 'Know Everything. Win Faster.', subheading: 'Your AI research analyst. Always on.' },
  { heading: 'Every Deal Starts with the Right Intel.', subheading: 'Vivek finds it. You close it.' },
  { heading: 'Outresearch. Outsell. Outwin.', subheading: 'Start with Vivek.' },
  // AI-forward & smart
  { heading: 'Your AI Research Analyst. Always On.', subheading: 'Deep insights. Instant answers. Real deals.' },
  { heading: 'Deep Insights. Instant Answers. Real Deals.', subheading: 'Your AI research analyst. Always on.' },
  { heading: 'From Signal to Strategy — In Seconds.', subheading: 'Ask Vivek. Close faster.' },
  { heading: 'Intelligence That Sells.', subheading: 'Deep research in seconds, not hours.' },
  // Conversational & Vivek-centric
  { heading: 'Ask Vivek. Close Faster.', subheading: 'Your smartest sales analyst is one question away.' },
  { heading: 'Your Smartest Sales Analyst Is One Question Away.', subheading: 'Vivek knows. Just ask.' },
  { heading: 'Vivek Knows. Just Ask.', subheading: 'Your always-on sales intelligence engine.' },
  { heading: 'Ask Once. Sell More.', subheading: 'Vivek never runs out of answers.' },
];

// ─── Types ───────────────────────────────────────────────────────────────────
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sessionId?: string | null;
  error?: boolean;
}

interface HistorySession {
  id: string;
  name: string;
  query: string;
  created_at: string;
}

// ─── Simple Markdown Renderer ───────────────────────────────────────────────
function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  function parseLine(text: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let k = 0;
    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);
      const codeMatch = remaining.match(/`(.+?)`/);

      const matches = [
        boldMatch ? { idx: remaining.indexOf(boldMatch[0]), match: boldMatch, type: 'bold' } : null,
        italicMatch ? { idx: remaining.indexOf(italicMatch[0]), match: italicMatch, type: 'italic' } : null,
        codeMatch ? { idx: remaining.indexOf(codeMatch[0]), match: codeMatch, type: 'code' } : null,
      ].filter(Boolean).sort((a, b) => a!.idx - b!.idx);

      if (matches.length === 0) { parts.push(remaining); break; }
      const first = matches[0]!;
      if (first.idx > 0) parts.push(remaining.slice(0, first.idx));
      if (first.type === 'bold')   parts.push(<strong key={k++} style={{ color: 'var(--wo-text)', fontWeight: 600 }}>{first.match[1]}</strong>);
      if (first.type === 'italic') parts.push(<em key={k++} style={{ fontStyle: 'italic' }}>{first.match[1]}</em>);
      if (first.type === 'code')   parts.push(<code key={k++} style={{ background: 'rgba(0,217,255,0.08)', color: 'var(--wo-primary)', padding: '1px 5px', borderRadius: 4, fontSize: '0.85em', fontFamily: 'monospace' }}>{first.match[1]}</code>);
      remaining = remaining.slice(first.idx + first.match[0].length);
    }
    return parts.length === 1 ? parts[0] : <>{parts}</>;
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      elements.push(<h1 key={key++} className="text-xl font-bold mt-6 mb-3" style={{ color: 'var(--wo-text)' }}>{parseLine(trimmed.slice(2))}</h1>);
    } else if (trimmed.startsWith('## ')) {
      elements.push(<h2 key={key++} className="text-base font-bold mt-5 mb-2 pb-1" style={{ color: 'var(--wo-text)', borderBottom: '1px solid var(--wo-border)' }}>{parseLine(trimmed.slice(3))}</h2>);
    } else if (trimmed.startsWith('### ')) {
      elements.push(<h3 key={key++} className="text-sm font-semibold mt-4 mb-1.5" style={{ color: 'var(--wo-primary)' }}>{parseLine(trimmed.slice(4))}</h3>);
    } else if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      elements.push(<hr key={key++} style={{ border: 'none', borderTop: '1px solid var(--wo-border)', margin: '16px 0' }} />);
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* ') || lines[i].trim().startsWith('• '))) {
        const bullet = lines[i].trim().slice(2).trim();
        listItems.push(
          <li key={i} className="flex items-start gap-2 text-sm leading-relaxed" style={{ color: 'var(--wo-text-muted)' }}>
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--wo-primary)' }} />
            <span>{parseLine(bullet)}</span>
          </li>
        );
        i++;
      }
      elements.push(<ul key={key++} className="space-y-1 pl-1 my-2">{listItems}</ul>);
      continue;
    } else if (/^\d+\.\s/.test(trimmed)) {
      const listItems: React.ReactNode[] = [];
      let num = 1;
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        const text = lines[i].trim().replace(/^\d+\.\s/, '');
        listItems.push(
          <li key={i} className="flex items-start gap-2 text-sm leading-relaxed" style={{ color: 'var(--wo-text-muted)' }}>
            <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5" style={{ background: 'rgba(0,217,255,0.12)', color: 'var(--wo-primary)' }}>{num++}</span>
            <span>{parseLine(text)}</span>
          </li>
        );
        i++;
      }
      elements.push(<ol key={key++} className="space-y-1.5 pl-1 my-2">{listItems}</ol>);
      continue;
    } else if (trimmed === '') {
      elements.push(<div key={key++} className="h-2" />);
    } else {
      elements.push(<p key={key++} className="text-sm leading-relaxed" style={{ color: 'var(--wo-text-muted)' }}>{parseLine(trimmed)}</p>);
    }
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}

// ─── User Bubble ─────────────────────────────────────────────────────────────
function UserBubble({ content, avatarUrl }: { content: string; avatarUrl?: string | null }) {
  return (
    <div className="flex items-start gap-3 mb-4 flex-row-reverse">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border-2 mt-0.5"
        style={{
          background: 'var(--wo-surface)',
          borderColor: 'var(--wo-primary)',
          boxShadow: '0 0 10px var(--wo-cyan-glow)',
          ...(avatarUrl ? {} : { background: 'linear-gradient(135deg, #00b8d9, #0099b8)' }),
        }}
      >
        {avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-white text-[10px] font-bold">You</span>
        )}
      </div>
      <div
        className="max-w-[70%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed"
        style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(0,217,255,0.15))',
          border: '1px solid rgba(139,92,246,0.3)',
          color: 'var(--wo-text)',
        }}
      >
        {content}
      </div>
    </div>
  );
}

// ─── Vivek Thinking Bubble ────────────────────────────────────────────────────
function VivekThinking() {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="vani-avatar-bot flex-shrink-0 mt-0.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/vani-logo.png" alt="Vani" className="h-full w-full object-contain" />
      </div>
      <div
        className="rounded-2xl rounded-tl-sm px-4 py-3"
        style={{ background: 'var(--wo-surface)', border: '1px solid var(--wo-border)' }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-semibold" style={{ color: 'var(--wo-primary)' }}>Vivek</span>
          <span className="text-xs" style={{ color: 'var(--wo-text-muted)' }}>is researching…</span>
        </div>
        <div className="vani-thinking-dots">
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
}

// ─── Vivek Response Bubble ────────────────────────────────────────────────────
// ─── Contact Extraction ──────────────────────────────────────────────────────
interface ExtractedContact {
  name: string;
  role: string;
  email: string;
  phone: string;
  linkedin_url: string;
  location: string;
}

function extractContacts(markdown: string): ExtractedContact[] {
  const contacts: ExtractedContact[] = [];
  const seen = new Set<string>();

  const lines = markdown.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // All bold-name patterns Vivek uses:
    // 1. **Name (Role)**  — role INSIDE bold  ← Entry Points
    // 2. **Name** — Role  (em/en-dash)
    // 3. **Name**, who is the Role
    // 4. **Name** is/was/serves as Role
    // 5. - **Name**, Role  (bullet)
    // 6. **Name** (Role)  — role OUTSIDE bold
    // 7. | Name | Role |  (table)
    // 8. Plain-text: Name (Role) — catches leadership lists without bold
    const nameRolePatterns: RegExp[] = [
      /\*\*([A-Z][a-z]+(?:\s[A-Z][a-zA-Z]+)+)\s*\(([^)]{2,80})\)\*\*/,
      /\*\*([^*]{3,60})\*\*\s*[—–]\s*([^*\n]{3,80})/,
      /\*\*([^*]{3,60})\*\*,?\s+who\s+(?:is|was|serves as)\s+(?:the\s+)?([^*\n,]{3,80})/i,
      /\*\*([^*]{3,60})\*\*\s+(?:is|was|serves as)\s+(?:the\s+)?([A-Z][^*\n,]{3,80})/,
      /[-•]\s*\*\*([^*]{3,60})\*\*,?\s+([A-Z][^\n,*]{3,60})/,
      /\*\*([^*]{3,60})\*\*\s*\(([^)]{2,60})\)/,
      /\|\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)\s*\|\s*([^|]{3,60})\s*\|/,
      // Plain-text "Firstname Lastname (Job Title)" — for leadership lists
      /\b([A-Z][a-z]{1,15}\s[A-Z][a-zA-Z]{1,20})\s*\(([A-Z][^)]{2,60})\)/,
    ];

    let rawName = '';
    let rawRole = '';

    for (const pat of nameRolePatterns) {
      const m = line.match(pat);
      if (m) { rawName = m[1].trim(); rawRole = m[2].trim(); break; }
    }

    if (!rawName) continue;

    // Reject headings and non-name text
    if (rawName.length > 60 || !/^[A-Z]/.test(rawName)) continue;
    if (/^(Note|Source|Key|The|Our|This|See|For|With|Use|Company|Data|Market|Contact|Email|Phone|Recommended|Entry|Approach|Strategy)/i.test(rawName)) continue;
    // Must look like a person's name: at least two words or one word ≤ 20 chars that is title-cased
    const wordCount = rawName.trim().split(/\s+/).length;
    if (wordCount < 2 && rawName.length > 20) continue;

    const key = rawName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    // Scan nearby lines for contact details
    const nearby = lines.slice(Math.max(0, i - 1), i + 8).join(' ');
    const emailM    = nearby.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
    const phoneM    = nearby.match(/(?:\+91[\s-]?|0)?[6-9]\d{9}|\+\d[\d\s-]{8,16}|\(\d{3,4}\)[\s-]?\d{3,4}[\s-]?\d{4}/);
    const linkedinM = nearby.match(/linkedin\.com\/in\/[\w-]+/i);
    // Look for location near this contact first, then fall back to anywhere in the document
    const locationPatterns = /(?:based in|located in|headquartered in|from|offices? in)\s+([A-Z][a-z]+(?:[,\s]+[A-Za-z]+)*)/gi;
    let locationM: RegExpMatchArray | null = null;
    for (const src of [nearby, markdown]) {
      const pat = new RegExp(locationPatterns.source, 'i');
      const m = src.match(pat);
      if (m) { locationM = m; break; }
    }

    // Clean up role: strip trailing fluff after comma/period
    const cleanRole = rawRole
      .replace(/^(the|a|an)\s+/i, '')
      .replace(/,.*$/, '')
      .trim()
      .slice(0, 80);

    contacts.push({
      name:         rawName,
      role:         cleanRole,
      email:        emailM    ? emailM[0] : '',
      phone:        phoneM    ? phoneM[0] : '',
      linkedin_url: linkedinM ? `https://${linkedinM[0]}` : '',
      location:     locationM ? locationM[1] : '',
    });
  }

  return contacts;
}

// ─── ContactImportModal ───────────────────────────────────────────────────────
interface ContactImportModalProps {
  contacts: ExtractedContact[];
  researchQuery: string;
  onClose: () => void;
}

function ContactImportModal({ contacts, researchQuery, onClose }: ContactImportModalProps) {
  const [accounts, setAccounts] = useState<{ id: string; name: string; industry: string }[]>([]);
  const [existingContacts, setExistingContacts] = useState<{ id: string; name: string; company?: string; email?: string; phone?: string; linkedin_url?: string; location?: string }[]>([]);

  // Guess company name from the research query.
  // Try patterns in priority order so "at Parle Agro" wins over "about AI".
  const guessedCompany = (() => {
    const patterns = [
      /\bat\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)+)/,                      // "at Parle Agro"
      /\bof\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)+)/,                      // "CEO of Parle Agro"
      /\bon\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)+)/,                      // "on Parle Agro"
      /\babout\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)+)/,                   // "about Parle Agro"
      /(?:deep.?dive|research|analyze|strategy\s+for)\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)+)/i,
      /\bfor\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)+)/,                     // "for Parle Agro" — last, greedy
    ];

    // Collect all candidates
    const candidates: string[] = [];
    for (const pat of patterns) {
      const m = researchQuery.match(pat);
      if (m && m[1].trim().split(/\s+/).length >= 2) candidates.push(m[1].trim());
    }

    // Prefer a candidate that matches a known account
    for (const c of candidates) {
      const lower = c.toLowerCase();
      if (accounts.find((a) => a.name.toLowerCase().includes(lower) || lower.includes(a.name.toLowerCase()))) {
        return c;
      }
    }

    // Otherwise return first candidate
    if (candidates.length > 0) return candidates[0];

    // Last resort: first run of 2+ consecutive Title-Cased words
    const m = researchQuery.match(/([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)+)/);
    return m ? m[1].trim() : '';
  })();

  type Row = ExtractedContact & { selected: boolean; company: string };

  const [rows, setRows] = useState<Row[]>(
    contacts.map((c) => ({ ...c, selected: true, company: guessedCompany }))
  );
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/accounts')
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d) => { if (Array.isArray(d)) setAccounts(d); })
      .catch(() => {});
    fetch('/api/contacts')
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d) => { if (Array.isArray(d)) setExistingContacts(d); })
      .catch(() => {});
  }, []);

  function resolveAccount(company: string) {
    const lower = company.toLowerCase();
    return accounts.find((a) => a.name.toLowerCase().includes(lower) || lower.includes(a.name.toLowerCase()));
  }

  function findExisting(name: string, company: string) {
    const nameLower = name.toLowerCase();
    return existingContacts.find(
      (c) => c.name.toLowerCase() === nameLower &&
        (!company || !c.company || c.company.toLowerCase().includes(company.toLowerCase()) || company.toLowerCase().includes(c.company.toLowerCase()))
    );
  }

  function update(idx: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  async function handleImport() {
    const selected = rows.filter((r) => r.selected);
    if (!selected.length) return;
    setSaving(true);
    let saved = 0;
    for (const row of selected) {
      const acc = resolveAccount(row.company);
      const existing = findExisting(row.name, row.company);

      if (existing) {
        // PATCH — only fill in fields that are currently blank on the existing record
        const updates: Record<string, string | null> = {};
        if (row.email        && !existing.email)        updates.email        = row.email;
        if (row.phone        && !existing.phone)        updates.phone        = row.phone;
        if (row.linkedin_url && !existing.linkedin_url) updates.linkedin_url = row.linkedin_url;
        if (row.location     && !existing.location)     updates.location     = row.location;
        if (acc?.id)                                    updates.account_id   = acc.id;
        if (acc?.industry)                              updates.industry     = acc.industry;
        if (Object.keys(updates).length > 0) {
          await fetch('/api/contacts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: existing.id, ...updates }),
          }).catch(() => null);
        }
      } else {
        // POST — new contact
        await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:         row.name,
            job_title:    row.role,
            company:      row.company || guessedCompany,
            email:        row.email,
            phone:        row.phone,
            linkedin_url: row.linkedin_url,
            location:     row.location,
            industry:     acc?.industry ?? '',
            account_id:   acc?.id ?? null,
            source:       'Vani Research',
          }),
        }).catch(() => null);
      }
      saved++;
    }
    setSaving(false);
    setSavedCount(saved);
    setTimeout(onClose, 1400);
  }

  const selectedCount = rows.filter((r) => r.selected).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="wo-card w-full max-w-2xl flex flex-col"
        style={{ maxHeight: '88vh', overflow: 'hidden' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--wo-border)' }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--wo-text)' }}>Import Contacts from Research</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--wo-text-muted)' }}>
              Review and edit before saving to Contacts
            </p>
          </div>
          <button onClick={onClose} className="wo-topnav-btn"><X className="w-4 h-4" /></button>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-3">
          {rows.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: 'var(--wo-text-muted)' }}>
              No contacts detected in this report. Try a Company Deep Dive query.
            </p>
          )}
          {rows.map((row, idx) => (
            <div
              key={idx}
              className="rounded-xl p-3 flex gap-3"
              style={{
                border: `1px solid ${row.selected ? 'rgba(0,217,255,0.25)' : 'var(--wo-border)'}`,
                background: row.selected ? 'rgba(0,217,255,0.04)' : 'var(--wo-surface-2)',
                opacity: row.selected ? 1 : 0.5,
              }}
            >
              <input
                type="checkbox"
                checked={row.selected}
                onChange={(e) => update(idx, { selected: e.target.checked })}
                className="mt-1 flex-shrink-0 accent-cyan-400"
              />
              <div className="flex-1 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-xs mb-0.5 block" style={{ color: 'var(--wo-text-muted)' }}>Name</label>
                  <input className="wo-input py-1 text-xs" value={row.name}
                    onChange={(e) => update(idx, { name: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs mb-0.5 block" style={{ color: 'var(--wo-text-muted)' }}>Role / Title</label>
                  <input className="wo-input py-1 text-xs" value={row.role}
                    onChange={(e) => update(idx, { role: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs mb-0.5 block" style={{ color: 'var(--wo-text-muted)' }}>Company</label>
                  <input className="wo-input py-1 text-xs" value={row.company}
                    onChange={(e) => update(idx, { company: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs mb-0.5 block" style={{ color: 'var(--wo-text-muted)' }}>Email</label>
                  <input className="wo-input py-1 text-xs" value={row.email}
                    onChange={(e) => update(idx, { email: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs mb-0.5 block" style={{ color: 'var(--wo-text-muted)' }}>Phone</label>
                  <input className="wo-input py-1 text-xs" value={row.phone}
                    onChange={(e) => update(idx, { phone: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs mb-0.5 block" style={{ color: 'var(--wo-text-muted)' }}>LinkedIn URL</label>
                  <input className="wo-input py-1 text-xs" value={row.linkedin_url}
                    onChange={(e) => update(idx, { linkedin_url: e.target.value })} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderTop: '1px solid var(--wo-border)' }}
        >
          {savedCount !== null ? (
            <span className="text-sm" style={{ color: '#4ade80' }}>
              <Check className="inline w-3.5 h-3.5 mr-1" />{savedCount} contact{savedCount !== 1 ? 's' : ''} saved / updated!
            </span>
          ) : (
            <span className="text-xs" style={{ color: 'var(--wo-text-muted)' }}>
              {selectedCount} of {rows.length} selected · existing contacts will be updated · source: Vani Research
            </span>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="wo-btn wo-btn-secondary text-xs" disabled={saving}>Cancel</button>
            <button
              onClick={handleImport}
              disabled={saving || selectedCount === 0 || savedCount !== null}
              className="wo-btn wo-btn-primary text-xs gap-1.5 disabled:opacity-40"
            >
              {saving ? 'Saving…' : `Import ${selectedCount} Contact${selectedCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── VivekBubble ─────────────────────────────────────────────────────────────
function VivekBubble({ msg, onCopy, researchQuery }: { msg: ChatMessage; onCopy: (text: string) => void; researchQuery: string }) {
  const [copied, setCopied] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveForm, setSaveForm] = useState({ name: '', account: '' });
  const [saving, setSaving] = useState(false);
  const [savedOpportunity, setSavedOpportunity] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [extractedContacts, setExtractedContacts] = useState<ExtractedContact[]>([]);
  const [knownAccounts, setKnownAccounts] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch('/api/accounts')
      .then((r) => r.json())
      .then((d) => setKnownAccounts(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  function handleCopy() {
    onCopy(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSaveToPipeline() {
    if (!saveForm.name.trim()) return;
    setSaving(true);
    try {
      const accountName = saveForm.account.trim();
      // Resolve account_id so the Accounts page opp_count stays in sync
      const matched = accountName
        ? knownAccounts.find((a) =>
            a.name.toLowerCase().includes(accountName.toLowerCase()) ||
            accountName.toLowerCase().includes(a.name.toLowerCase())
          )
        : null;

      await fetch('/api/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:       saveForm.name.trim(),
          account:    accountName || undefined,
          account_id: matched?.id ?? null,
          stage:      'Discovery',
        }),
      });
      setSavedOpportunity(saveForm.name.trim());
      setShowSaveForm(false);
      setSaveForm({ name: '', account: '' });
    } catch {
      // silently fail — user can retry
    } finally {
      setSaving(false);
    }
  }

  if (msg.error) {
    return (
      <div className="flex items-start gap-3 mb-4">
        <div className="vani-avatar-bot flex-shrink-0 mt-0.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/vani-logo.png" alt="Vani" className="h-full w-full object-contain" />
        </div>
        <div
          className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm max-w-[80%]"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
        >
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="vani-avatar-bot flex-shrink-0 mt-0.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/vani-logo.png" alt="Vani" className="h-full w-full object-contain" />
      </div>
      <div className="flex-1 min-w-0">
        {/* Bubble header */}
        <div
          className="rounded-2xl rounded-tl-sm overflow-hidden"
          style={{ border: '1px solid var(--wo-border)', background: 'var(--wo-surface)' }}
        >
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{ borderBottom: '1px solid var(--wo-border)', background: 'rgba(139,92,246,0.06)' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold" style={{ color: 'var(--wo-primary)' }}>Vivek</span>
              <span className="text-xs" style={{ color: 'var(--wo-text-muted)' }}>Research Report</span>
              {savedOpportunity && (
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>
                  Saved: {savedOpportunity}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all"
                style={{ background: 'var(--wo-surface-2)', color: 'var(--wo-text-muted)', border: '1px solid var(--wo-border)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--wo-text)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--wo-text-muted)'; }}
              >
                {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={() => setShowSaveForm((v) => !v)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all"
                style={{
                  background: savedOpportunity ? 'rgba(34,197,94,0.12)' : 'rgba(0,217,255,0.08)',
                  color: savedOpportunity ? '#4ade80' : 'var(--wo-primary)',
                  border: savedOpportunity ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(0,217,255,0.2)',
                }}
              >
                {savedOpportunity ? <Check className="w-3 h-3" /> : <BookmarkPlus className="w-3 h-3" />}
                {savedOpportunity ? 'Saved' : 'Save'}
              </button>
              <button
                onClick={() => {
                  const found = extractContacts(msg.content);
                  setExtractedContacts(found);
                  setShowImportModal(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all"
                style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.25)' }}
              >
                <Users className="w-3 h-3" />
                Import Contacts
              </button>
            </div>
          </div>

          {/* Save to Opportunity inline form */}
          {showSaveForm && !savedOpportunity && (
            <div
              className="px-4 py-3 flex items-end gap-2 flex-wrap"
              style={{ borderBottom: '1px solid var(--wo-border)', background: 'rgba(0,217,255,0.03)' }}
            >
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs mb-1" style={{ color: 'var(--wo-text-muted)' }}>Opportunity Name *</label>
                <input
                  className="wo-input text-xs py-1.5"
                  placeholder="e.g. Parle Agro — Vani Pilot"
                  value={saveForm.name}
                  onChange={e => setSaveForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveToPipeline(); if (e.key === 'Escape') setShowSaveForm(false); }}
                  autoFocus
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs mb-1" style={{ color: 'var(--wo-text-muted)' }}>Account (optional)</label>
                <input
                  className="wo-input text-xs py-1.5"
                  placeholder="e.g. Parle Agro"
                  value={saveForm.account}
                  onChange={e => setSaveForm(f => ({ ...f, account: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveToPipeline(); if (e.key === 'Escape') setShowSaveForm(false); }}
                />
              </div>
              <div className="flex gap-1.5 pb-0.5">
                <button
                  onClick={handleSaveToPipeline}
                  disabled={!saveForm.name.trim() || saving}
                  className="wo-btn wo-btn-primary text-xs px-3 py-1.5 disabled:opacity-40"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setShowSaveForm(false)}
                  className="wo-btn wo-btn-ghost text-xs px-3 py-1.5"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="px-4 py-4">
            <MarkdownRenderer content={msg.content} />
          </div>
        </div>
      </div>

      {showImportModal && (
        <ContactImportModal
          contacts={extractedContacts}
          researchQuery={researchQuery}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
function ResearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { playbook } = usePlaybook();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [researchHistory, setResearchHistory] = useState<HistorySession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [historyPinned, setHistoryPinned] = useState(() => {
    try { return localStorage.getItem('vaniai_history_pinned') !== '0'; } catch { return true; }
  });
  const [historyVisibleCount, setHistoryVisibleCount] = useState(6);
  const [historyPanelCollapsed, setHistoryPanelCollapsed] = useState(false);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/session', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.avatar_url) setUserAvatarUrl(data.avatar_url); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try { localStorage.setItem('vaniai_history_pinned', historyPinned ? '1' : '0'); } catch {}
  }, [historyPinned]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [promptsPanelExpanded, setPromptsPanelExpanded] = useState(false);
  const [promptsPanelPinned, setPromptsPanelPinned] = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem('vaniai_prompts_panel_pinned') === '1'; } catch { return false; }
  });
  const [hoveredPromptIndex, setHoveredPromptIndex] = useState<number | null>(null);
  const promptsPanelLeaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PROMPTS_PANEL_LEAVE_DELAY_MS = 700;

  const [promptContext, setPromptContext] = useState<PromptContext>(() => ({ company: '', industry: '', describeSignal: '' }));
  const [promptContextMounted, setPromptContextMounted] = useState(false);
  useEffect(() => {
    setPromptContext(loadPromptContextFromStorage());
    setPromptContextMounted(true);
  }, []);
  useEffect(() => {
    if (!promptContextMounted) return;
    try { localStorage.setItem(PROMPT_CONTEXT_STORAGE_KEY, JSON.stringify(promptContext)); } catch {}
  }, [promptContext, promptContextMounted]);

  const effectivePromptContext: PromptContext = {
    company: promptContext.company || playbook?.company || '',
    industry: promptContext.industry || playbook?.industry || '',
    describeSignal: promptContext.describeSignal || '',
  };

  // Auto-fill from playbook ?q= or ?playbook= params
  useEffect(() => {
    const q = searchParams.get('q');
    const company = searchParams.get('playbook');
    if (q) {
      setInput(q);
      setTimeout(() => textareaRef.current?.focus(), 100);
    } else if (company) {
      setInput(`Perform a deep dive research on ${company} — their digital transformation initiatives, technology stack, leadership team, and buying signals`);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup prompts panel leave timeout on unmount
  useEffect(() => {
    return () => { if (promptsPanelLeaveRef.current) clearTimeout(promptsPanelLeaveRef.current); };
  }, []);

  // Persist prompts panel pinned state
  useEffect(() => {
    try { localStorage.setItem('vaniai_prompts_panel_pinned', promptsPanelPinned ? '1' : '0'); } catch {}
  }, [promptsPanelPinned]);

  const { listening: micListening, supported: micSupported, startListening, stopListening, error: micError } = useSpeechInput({
    onResult: (transcript) => setInput(prev => (prev.trim() ? prev.trimEnd() + ' ' : '') + transcript),
    onInterim: (transcript) => setInput(transcript),
  });

  const hasMessages = messages.length > 0;

  // When chat is active and panel is pinned, keep panel expanded on mount / when entering view
  useEffect(() => {
    if (hasMessages && promptsPanelPinned) setPromptsPanelExpanded(true);
  }, [hasMessages, promptsPanelPinned]);

  // Rotate hero heading/subheading (landing and when conversation active — header panel)
  useEffect(() => {
    const interval = setInterval(() => {
      setHeroIndex((i) => (i + 1) % RESEARCH_HERO_VARIANTS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Track scroll position to show/hide scroll-to-bottom button
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    function onScroll() {
      if (!el) return;
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollBtn(distFromBottom > 120);
    }
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [hasMessages]);

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  // Load research history on mount
  useEffect(() => {
    fetch('/api/research-sessions')
      .then(r => r.json())
      .then(d => setResearchHistory(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }, [input]);

  const sendMessage = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setActiveSessionId(null);

    // Build history for multi-turn: all prior turns excluding the new user message
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('/api/agents/vivek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed, history }),
      });
      const data = await res.json() as { result?: string; session_id?: string | null; error?: string };

      if (data.error || !data.result) {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: data.error ?? 'Research failed. Please try again.',
          error: true,
        }]);
      } else {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: data.result!,
          sessionId: data.session_id,
        }]);
        // Refresh history sidebar after a new research session is saved
        fetch('/api/research-sessions')
          .then(r => r.json())
          .then(d => {
            const sessions = Array.isArray(d) ? d : [];
            setResearchHistory(sessions);
            // Highlight the newly saved session
            if (data.session_id) setActiveSessionId(data.session_id);
          })
          .catch(() => {});
      }
    } catch {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'Research failed. Please check your connection and try again.',
        error: true,
      }]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages]);

  async function loadSession(sessionId: string) {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/research-sessions/${sessionId}`);
      const data = await res.json() as { id: string; name: string; query: string; result: string; created_at: string };
      if (data.query && data.result) {
        setMessages([
          { role: 'user', content: data.query },
          { role: 'assistant', content: data.result, sessionId: data.id },
        ]);
      }
    } catch {
      // silently fail
    } finally {
      setHistoryLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleCopyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  function handleNewChat() {
    setMessages([]);
    setInput('');
    setActiveSessionId(null);
  }

  /** Extract a short title for grouping and badge (e.g. "Asian Paints", "Parle Agro") */
  function getBadge(name: string): string | null {
    const m = name.match(/^(?:Research:\s*)?([A-Z][a-zA-Z0-9]+(?:\s[A-Z][a-zA-Z0-9]+)*)/);
    return m ? m[1].trim() : null;
  }

  function groupByDate(sessions: HistorySession[]) {
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now.getTime() - 86400000).toDateString();
    const groups: Record<string, HistorySession[]> = { Today: [], Yesterday: [], 'This Week': [], Earlier: [] };
    sessions.forEach(s => {
      const d = new Date(s.created_at);
      const ds = d.toDateString();
      const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
      if (ds === today) groups['Today'].push(s);
      else if (ds === yesterday) groups['Yesterday'].push(s);
      else if (diffDays <= 7) groups['This Week'].push(s);
      else groups['Earlier'].push(s);
    });
    return groups;
  }

  /** Group sessions by title (badge) e.g. "Asian Paints", "Parle Agro"; within each group sort by date newest first */
  function groupByTitle(sessions: HistorySession[]): Array<{ _groupTitle: string; _groupKey: string } & HistorySession> {
    const byTitle: Record<string, HistorySession[]> = {};
    sessions.forEach(s => {
      const title = getBadge(s.name) || s.name.slice(0, 30) || 'Other';
      if (!byTitle[title]) byTitle[title] = [];
      byTitle[title].push(s);
    });
    // Sort each group by date (newest first), then sort groups by most recent session
    const groupKeys = Object.keys(byTitle).sort((a, b) => {
      const maxA = Math.max(...byTitle[a].map(x => new Date(x.created_at).getTime()));
      const maxB = Math.max(...byTitle[b].map(x => new Date(x.created_at).getTime()));
      return maxB - maxA;
    });
    const out: Array<{ _groupTitle: string; _groupKey: string } & HistorySession> = [];
    groupKeys.forEach(key => {
      const sorted = [...byTitle[key]].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      sorted.forEach(s => out.push({ ...s, _groupTitle: key, _groupKey: key }));
    });
    return out;
  }

  const historyQ = historySearch.toLowerCase();
  const filteredHistory = researchHistory.filter(s =>
    !historyQ || s.name.toLowerCase().includes(historyQ) || s.query.toLowerCase().includes(historyQ)
  );
  const groupedByDate = groupByDate(filteredHistory);
  // Flatten by date buckets, then apply title grouping so we can show group headers
  const byDateFlat = (['Today', 'Yesterday', 'This Week', 'Earlier'] as const).flatMap(
    (g) => (groupedByDate[g] ?? []).map((s) => ({ ...s, _dateGroup: g }))
  );
  const flatHistoryList = groupByTitle(byDateFlat);
  const visibleHistory = flatHistoryList.slice(0, historyVisibleCount);
  const hasMoreHistory = flatHistoryList.length > historyVisibleCount;

  async function loadSessionById(sessionId: string) {
    setActiveSessionId(sessionId);
    await loadSession(sessionId);
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden w-full">

      {/* ── Left History: when unpinned, collapse on leave and expand on hover over this area ── */}
      <div
        className="flex-shrink-0 h-full min-h-0 flex flex-col"
        onMouseEnter={() => { if (!historyPinned) setHistoryPanelCollapsed(false); }}
        onMouseLeave={() => { if (!historyPinned) setHistoryPanelCollapsed(true); }}
      >
      {!historyPanelCollapsed && (
      <div
        className="w-64 flex flex-col flex-shrink-0 overflow-hidden h-full min-h-0"
        style={{ background: 'var(--wo-surface)', borderRight: '1px solid var(--wo-border)' }}
      >
        {/* History header: Clock + "History" + Pin/Unpin (bookmark) — hover feedback */}
        <div
          className="px-3 py-2.5 flex items-center justify-between gap-2 flex-shrink-0 transition-colors rounded-t-lg"
          style={{ borderBottom: '1px solid var(--wo-border)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--wo-surface-2)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Clock className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--wo-text-muted)' }} />
            <span className="text-sm font-semibold whitespace-nowrap" style={{ color: 'var(--wo-text)' }}>History</span>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !historyPinned;
              setHistoryPinned(next);
              if (!next) setHistoryPanelCollapsed(true); // unpin → collapse
            }}
            title={historyPinned ? 'Unpin sidebar' : 'Pin sidebar'}
            className="p-1.5 rounded-lg transition-colors flex-shrink-0"
            style={{ color: historyPinned ? 'var(--wo-primary)' : 'var(--wo-text-muted)' }}
            onMouseEnter={e => {
              const t = e.currentTarget as HTMLElement;
              t.style.background = 'rgba(0,217,255,0.1)';
              t.style.color = 'var(--wo-primary)';
            }}
            onMouseLeave={e => {
              const t = e.currentTarget as HTMLElement;
              t.style.background = 'transparent';
              t.style.color = historyPinned ? 'var(--wo-primary)' : 'var(--wo-text-muted)';
            }}
          >
            <Bookmark className={`w-4 h-4 ${historyPinned ? '' : 'opacity-60'}`} strokeWidth={2} />
          </button>
        </div>

        {/* + and < icons only — just the plus, no colored box */}
        <div className="p-3 flex items-center gap-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--wo-border)' }}>
          <button
            type="button"
            onClick={handleNewChat}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--wo-text-muted)', background: 'transparent' }}
            title="New research"
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--wo-primary)'; (e.currentTarget as HTMLElement).style.background = 'var(--wo-surface-2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--wo-text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => setHistoryPanelCollapsed(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--wo-text-muted)', background: 'var(--wo-surface-2)' }}
            title="Collapse history"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--wo-border)' }}>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--wo-text-muted)' }} />
            <input
              className="wo-input pl-8 text-xs py-1.5 w-full"
              placeholder="Search history…"
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
            />
            {historySearch && (
              <button onClick={() => setHistorySearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--wo-text-muted)' }}>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Recent label */}
        <div className="px-3 pt-2 pb-1 flex-shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--wo-text-muted)' }}>Recent</p>
        </div>

        {/* Session list: no scrollbar, show 5–7 then "... More" */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-1 hide-scrollbar">
          {researchHistory.length === 0 && (
            <div className="text-center py-8 px-4">
              <Newspaper className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--wo-text-muted)' }} />
              <p className="text-xs" style={{ color: 'var(--wo-text-muted)' }}>No research yet.</p>
            </div>
          )}
          {flatHistoryList.length === 0 && researchHistory.length > 0 && (
            <p className="text-xs text-center py-4 px-3" style={{ color: 'var(--wo-text-muted)' }}>
              No sessions match &quot;{historySearch}&quot;
            </p>
          )}
          {visibleHistory.map((session, idx) => {
            const badge = getBadge(session.name);
            const isActive = session.id === activeSessionId;
            const showGroupHeader = session._groupTitle && (idx === 0 || visibleHistory[idx - 1]._groupTitle !== session._groupTitle);
            return (
              <div key={session.id}>
                {showGroupHeader && (
                  <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider truncate" style={{ color: 'var(--wo-text-muted)' }}>
                    {session._groupTitle}
                  </p>
                )}
                <button
                  onClick={() => loadSessionById(session.id)}
                  className="w-full text-left px-3 py-2 transition-all rounded-lg mx-1"
                  style={{
                    background: isActive ? 'rgba(0,217,255,0.08)' : 'transparent',
                    borderLeft: isActive ? '2px solid var(--wo-primary)' : '2px solid transparent',
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--wo-surface-2)'; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div className="flex items-start gap-1.5">
                    <Newspaper className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: isActive ? 'var(--wo-primary)' : 'var(--wo-text-muted)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate leading-tight" style={{ color: isActive ? 'var(--wo-primary)' : 'var(--wo-text)' }}>
                        {session.name}
                      </p>
                      {badge && (
                        <span className="inline-block mt-0.5 text-[9px] px-1 py-0.5 rounded font-medium"
                          style={{ background: 'rgba(0,217,255,0.15)', color: 'var(--wo-primary)', border: '1px solid rgba(0,217,255,0.25)' }}>
                          {badge}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
          {hasMoreHistory && (
            <button
              type="button"
              onClick={() => setHistoryVisibleCount((n) => n + 5)}
              className="w-full px-3 py-2 text-left text-xs rounded-lg mx-1 transition-colors"
              style={{ color: 'var(--wo-text-muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--wo-surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--wo-text)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--wo-text-muted)'; }}
            >
              … More
            </button>
          )}
        </div>
      </div>
      )}

      {historyPanelCollapsed && (
        <button
          type="button"
          onClick={() => setHistoryPanelCollapsed(false)}
          className="flex-shrink-0 w-9 flex items-center justify-center py-4 border-r transition-colors rounded-r"
          style={{ background: 'var(--wo-surface-2)', borderColor: 'var(--wo-border)', color: 'var(--wo-primary)' }}
          title={historyPinned ? 'Show history' : 'Hover to expand history'}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
      </div>

      {/* ── Main Content (min-h-0 so input bar stays at bottom) ── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Breadcrumb + when conversation active: same rotating hero animation as landing */}
        <div className="flex-shrink-0 px-6 py-3 text-sm" style={{ borderBottom: '1px solid var(--wo-border)' }}>
          <div className="flex items-center gap-2">
            <Home className="w-4 h-4" style={{ color: 'var(--wo-primary)' }} />
            <span className="cursor-pointer hover:underline" style={{ color: 'var(--wo-primary)' }} onClick={() => router.push('/home')}>Home</span>
            <ChevronRight className="w-3 h-3" style={{ color: 'var(--wo-text-muted)' }} />
            <span
              style={{ color: hasMessages ? 'var(--wo-primary)' : 'var(--wo-text)' }}
              className={hasMessages ? 'cursor-pointer hover:underline' : ''}
              onClick={hasMessages ? handleNewChat : undefined}
            >
              Research
            </span>
            {hasMessages && messages.find(m => m.role === 'user') && (
              <>
                <ChevronRight className="w-3 h-3" style={{ color: 'var(--wo-text-muted)' }} />
                <span className="truncate max-w-[300px] text-xs" style={{ color: 'var(--wo-text-muted)' }}>
                  {(messages.find(m => m.role === 'user')?.content ?? '').slice(0, 60)}
                  {(messages.find(m => m.role === 'user')?.content ?? '').length > 60 ? '…' : ''}
                </span>
              </>
            )}
          </div>
          {hasMessages && (
            <div className="research-hero mt-2">
              <h1 key={heroIndex} className="research-hero-rotate-in text-lg sm:text-xl font-bold bg-gradient-to-r from-violet-500 via-cyan-400 to-cyan-300 bg-clip-text text-transparent">
                {RESEARCH_HERO_VARIANTS[heroIndex].heading}
              </h1>
              <p key={`sub-${heroIndex}`} className="research-hero-rotate-in sub-delay text-xs mt-0.5" style={{ color: 'var(--wo-text-muted)' }}>
                {RESEARCH_HERO_VARIANTS[heroIndex].subheading}
              </p>
            </div>
          )}
        </div>

        {/* ── Empty State (landing): hero + 2x3 prompt grid as before, input fixed at bottom ── */}
        {!hasMessages && (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden research-landing">
              <div className="min-w-0 w-full max-w-6xl mx-auto px-6 py-6">
                <div className="research-hero text-center mb-4">
                  <h1 key={heroIndex} className="research-hero-rotate-in text-2xl sm:text-3xl font-bold bg-gradient-to-r from-violet-500 via-cyan-400 to-cyan-300 bg-clip-text text-transparent mb-2">
                    {RESEARCH_HERO_VARIANTS[heroIndex].heading}
                  </h1>
                  <p key={`sub-${heroIndex}`} className="research-hero-rotate-in sub-delay text-sm" style={{ color: 'var(--wo-text-muted)' }}>
                    {RESEARCH_HERO_VARIANTS[heroIndex].subheading}
                  </p>
                </div>
                <div className="mb-6 max-w-xl">
                  <PromptContextForm
                    context={promptContext}
                    onChange={setPromptContext}
                    playbookHint={playbook ? { company: playbook.company, industry: playbook.industry } : null}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {RESEARCH_TEMPLATES.map((tmpl) => {
                    const accentStyles: Record<string, { iconBg: string; iconColor: string; cardBorder: string; cardBg: string; cardHover: string }> = {
                      violet:  { iconBg: 'rgba(139,92,246,0.2)', iconColor: '#a78bfa', cardBorder: 'rgba(139,92,246,0.3)', cardBg: 'rgba(139,92,246,0.06)', cardHover: 'rgba(139,92,246,0.12)' },
                      cyan:     { iconBg: 'rgba(0,217,255,0.15)', iconColor: 'var(--wo-primary)', cardBorder: 'rgba(0,217,255,0.25)', cardBg: 'rgba(0,217,255,0.04)', cardHover: 'rgba(0,217,255,0.1)' },
                      emerald: { iconBg: 'rgba(16,185,129,0.2)', iconColor: '#34d399', cardBorder: 'rgba(16,185,129,0.3)', cardBg: 'rgba(16,185,129,0.06)', cardHover: 'rgba(16,185,129,0.12)' },
                      orange:  { iconBg: 'rgba(249,115,22,0.2)', iconColor: '#fb923c', cardBorder: 'rgba(249,115,22,0.3)', cardBg: 'rgba(249,115,22,0.06)', cardHover: 'rgba(249,115,22,0.12)' },
                      pink:    { iconBg: 'rgba(236,72,153,0.2)', iconColor: '#f472b6', cardBorder: 'rgba(236,72,153,0.3)', cardBg: 'rgba(236,72,153,0.06)', cardHover: 'rgba(236,72,153,0.12)' },
                      amber:   { iconBg: 'rgba(245,158,11,0.2)', iconColor: '#fbbf24', cardBorder: 'rgba(245,158,11,0.3)', cardBg: 'rgba(245,158,11,0.06)', cardHover: 'rgba(245,158,11,0.12)' },
                    };
                    const s = accentStyles[tmpl.accent] ?? accentStyles.cyan;
                    const Icon = tmpl.Icon;
                    const filledPrompt = fillPromptPlaceholders(tmpl.prompt, effectivePromptContext);
                    const segments = promptContextMounted ? getPromptDisplaySegments(filledPrompt, effectivePromptContext) : null;
                    return (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => { setInput(filledPrompt); setTimeout(() => textareaRef.current?.focus(), 50); }}
                        className="research-prompt-card text-left rounded-xl border p-5 transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]"
                        style={{
                          background: s.cardBg,
                          borderColor: s.cardBorder,
                          color: 'var(--wo-text)',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = s.cardHover; }}
                        onMouseLeave={e => { e.currentTarget.style.background = s.cardBg; }}
                      >
                        <div
                          className="flex h-11 w-11 items-center justify-center rounded-xl mb-3"
                          style={{ background: s.iconBg, color: s.iconColor }}
                        >
                          <Icon className="h-5 w-5" aria-hidden />
                        </div>
                        <h3 className="font-semibold text-sm mb-1.5" style={{ color: 'var(--wo-text)' }}>{tmpl.title}</h3>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--wo-text-muted)' }}>
                          {segments
                            ? segments.map((seg, i) =>
                                seg.type === 'filled'
                                  ? <span key={i} className="underline decoration-2 decoration-[var(--wo-primary)] underline-offset-1" style={{ color: 'var(--wo-primary)' }}>{seg.text}</span>
                                  : seg.type === 'placeholder'
                                    ? <span key={i} className="underline decoration-dashed decoration-[var(--wo-text-muted)] underline-offset-1" style={{ color: 'var(--wo-text-muted)' }}>{seg.text}</span>
                                    : seg.text
                              )
                            : filledPrompt}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Input bar fixed at bottom */}
            <div className="flex-shrink-0 px-6 pb-5 pt-0 relative">
              <div className="max-w-3xl mx-auto relative">
                <div className="wo-card p-3" style={{
                  border: '1px solid rgba(0,217,255,0.18)',
                  borderRadius: '18px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,217,255,0.06), 0 2px 16px rgba(0,217,255,0.08)',
                }}>
                  <textarea
                    ref={textareaRef}
                    placeholder="Ask anything… or pick a prompt above"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                    className="w-full resize-none border-none outline-none text-sm"
                    style={{ background: 'transparent', color: 'var(--wo-text)', minHeight: '44px', maxHeight: '160px', overflowY: 'auto' }}
                    rows={1}
                  />
                  <div className="flex items-center justify-between pt-2 mt-1" style={{ borderTop: '1px solid var(--wo-border)' }}>
                    <div className="flex items-center gap-2">
                      <button onClick={() => router.push('/home/documents')} className="wo-btn wo-btn-ghost text-xs gap-1 py-1" title="Upload documents" disabled={loading}>
                        <Plus className="w-3.5 h-3.5" /> Add Data Sources
                      </button>
                      <button onClick={() => router.push('/home/opportunities')} className="wo-btn wo-btn-ghost text-xs gap-1 py-1" title="Go to Opportunities" disabled={loading}>
                        <FileText className="w-3.5 h-3.5" /> Opportunity
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                        style={{ background: 'rgba(0,217,255,0.08)', color: 'var(--wo-primary)', border: '1px solid rgba(0,217,255,0.2)' }}>
                        <Globe className="w-3.5 h-3.5" /> Web Search
                      </span>
                      {micSupported && (
                        <div className="relative">
                          {micListening && <span className="vani-mic-ring" />}
                          <button
                            onClick={micListening ? stopListening : startListening}
                            disabled={loading}
                            className={`p-2 rounded-xl transition-all disabled:opacity-40 ${micListening ? 'vani-mic-recording' : ''}`}
                            style={micListening ? { background: '#ef4444', color: '#fff' } : { background: 'var(--wo-surface-2)', color: 'var(--wo-text-muted)' }}
                            title={micListening ? 'Stop recording' : 'Speak your query'}
                          >
                            {micListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                          </button>
                        </div>
                      )}
                      <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading}
                        className="wo-btn wo-btn-primary p-2 rounded-xl disabled:opacity-40" title="Send (Enter)">
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {micListening && (
                    <p className="text-xs mt-1 text-center" style={{ color: '#ef4444' }}>Listening… speak now, then click the mic to stop</p>
                  )}
                  {micError && (
                    <p className="text-xs mt-1 text-center" style={{ color: '#ef4444' }}>{micError}</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── When chat started: thread + input on left; right = hover-to-reveal prompts (staircase/piano) ── */}
        {hasMessages && (
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Left: chat thread + input */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden min-w-0">
              <div className="flex-1 min-h-0 overflow-y-auto relative" ref={scrollContainerRef}>
                <div className="max-w-3xl mx-auto py-6 px-6">
                  {messages.map((msg, idx) =>
                    msg.role === 'user'
                      ? <UserBubble key={idx} content={msg.content} avatarUrl={userAvatarUrl} />
                      : <VivekBubble
                          key={idx}
                          msg={msg}
                          onCopy={handleCopyToClipboard}
                          researchQuery={messages.slice(0, idx).reverse().find((m) => m.role === 'user')?.content ?? ''}
                        />
                  )}
                  {loading && <VivekThinking />}
                  <div ref={bottomRef} />
                </div>
                {showScrollBtn && (
                  <button
                    onClick={scrollToBottom}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-all"
                    style={{
                      background: 'var(--wo-surface)',
                      border: '1px solid rgba(0,217,255,0.25)',
                      color: 'var(--wo-text-muted)',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                    }}
                    title="Scroll to bottom"
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--wo-primary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--wo-primary)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--wo-text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,217,255,0.25)'; }}
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                )}
              </div>
              <div className="flex-shrink-0 px-6 pb-5 pt-0 relative">
                <div className="absolute top-0 left-0 right-0 h-10 pointer-events-none"
                  style={{ background: 'linear-gradient(to bottom, transparent, var(--wo-bg, #0f0f1a))' }} />
                <div className="max-w-3xl mx-auto relative">
                  <div className="wo-card p-3" style={{
                    border: '1px solid rgba(0,217,255,0.18)',
                    borderRadius: '18px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,217,255,0.06), 0 2px 16px rgba(0,217,255,0.08)',
                  }}>
                    <textarea
                      ref={textareaRef}
                      placeholder="Follow up on anything…"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={loading}
                      className="w-full resize-none border-none outline-none text-sm"
                      style={{ background: 'transparent', color: 'var(--wo-text)', minHeight: '44px', maxHeight: '160px', overflowY: 'auto' }}
                      rows={1}
                    />
                    <div className="flex items-center justify-between pt-2 mt-1" style={{ borderTop: '1px solid var(--wo-border)' }}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => router.push('/home/documents')} className="wo-btn wo-btn-ghost text-xs gap-1 py-1" title="Upload documents" disabled={loading}>
                          <Plus className="w-3.5 h-3.5" /> Add Data
                        </button>
                        <button onClick={() => router.push('/home/opportunities')} className="wo-btn wo-btn-ghost text-xs gap-1 py-1" title="Go to Opportunities" disabled={loading}>
                          <FileText className="w-3.5 h-3.5" /> Opportunity
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                          style={{ background: 'rgba(0,217,255,0.08)', color: 'var(--wo-primary)', border: '1px solid rgba(0,217,255,0.2)' }}>
                          <Globe className="w-3.5 h-3.5" /> Web ✓
                        </span>
                        {micSupported && (
                          <div className="relative">
                            {micListening && <span className="vani-mic-ring" />}
                            <button
                              onClick={micListening ? stopListening : startListening}
                              disabled={loading}
                              className={`p-2 rounded-xl transition-all disabled:opacity-40 ${micListening ? 'vani-mic-recording' : ''}`}
                              style={micListening ? { background: '#ef4444', color: '#fff' } : { background: 'var(--wo-surface-2)', color: 'var(--wo-text-muted)' }}
                              title={micListening ? 'Stop recording' : 'Speak your query'}
                            >
                              {micListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                            </button>
                          </div>
                        )}
                        <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading}
                          className="wo-btn wo-btn-primary p-2 rounded-xl disabled:opacity-40" title="Send (Enter)">
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  {micError && <p className="text-center text-xs mt-1" style={{ color: '#ef4444' }}>{micError}</p>}
                  {micListening && <p className="text-center text-xs mt-1" style={{ color: '#ef4444' }}>Listening… speak now, then click the mic to stop</p>}
                  {!micListening && !micError && (
                    <p className="text-center text-xs mt-2" style={{ color: 'var(--wo-text-muted)' }}>
                      Vivek can make mistakes. Verify important information.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Right: hidden until hover — prompts panel with staircase/piano animation */}
            <div
              className="flex-shrink-0 flex transition-[width] duration-200 ease-out overflow-hidden"
              style={{ width: promptsPanelExpanded ? 280 : 20 }}
              onMouseEnter={() => {
                if (promptsPanelLeaveRef.current) {
                  clearTimeout(promptsPanelLeaveRef.current);
                  promptsPanelLeaveRef.current = null;
                }
                setPromptsPanelExpanded(true);
              }}
              onMouseLeave={() => {
                if (!promptsPanelPinned) {
                  promptsPanelLeaveRef.current = setTimeout(() => setPromptsPanelExpanded(false), PROMPTS_PANEL_LEAVE_DELAY_MS);
                }
              }}
            >
              {!promptsPanelExpanded && (
                <div
                  className="w-5 h-full flex items-center justify-center flex-shrink-0 cursor-default py-4"
                  style={{ background: 'var(--wo-surface-2)', borderLeft: '1px solid var(--wo-border)' }}
                  title="Hover for prompts"
                >
                  <span className="text-[10px] font-medium uppercase tracking-wider whitespace-nowrap -rotate-90 origin-center" style={{ color: 'var(--wo-text-muted)' }}>
                    Prompts
                  </span>
                </div>
              )}
              {promptsPanelExpanded && (
                <aside
                  className="w-[280px] flex-shrink-0 h-full flex flex-col overflow-hidden border-l py-4 px-3"
                  style={{ borderColor: 'var(--wo-border)', background: 'var(--wo-surface-2)' }}
                >
                  <div className="flex items-center justify-between gap-2 mb-3 flex-shrink-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--wo-text-muted)' }}>Quick prompts</p>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !promptsPanelPinned;
                        setPromptsPanelPinned(next);
                        if (!next) setPromptsPanelExpanded(false);
                      }}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: promptsPanelPinned ? 'var(--wo-primary)' : 'var(--wo-text-muted)' }}
                      title={promptsPanelPinned ? 'Unpin panel' : 'Pin panel open'}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--wo-hover-btn)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <Pin className={`w-4 h-4 ${promptsPanelPinned ? '' : 'opacity-60'}`} strokeWidth={2} style={{ transform: promptsPanelPinned ? 'rotate(-45deg)' : 'none' }} />
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto overflow-x-visible py-1 pr-1 hide-scrollbar">
                    <div className="space-y-3">
                      <PromptContextForm
                        compact
                        context={promptContext}
                        onChange={setPromptContext}
                        playbookHint={playbook ? { company: playbook.company, industry: playbook.industry } : null}
                      />
                      <div className="space-y-2">
                    {RESEARCH_TEMPLATES.map((tmpl, index) => {
                      const accentStyles: Record<string, { iconBg: string; iconColor: string; cardBorder: string; cardBg: string; cardHover: string }> = {
                        violet:  { iconBg: 'rgba(139,92,246,0.2)', iconColor: '#a78bfa', cardBorder: 'rgba(139,92,246,0.3)', cardBg: 'rgba(139,92,246,0.06)', cardHover: 'rgba(139,92,246,0.12)' },
                        cyan:     { iconBg: 'rgba(0,217,255,0.15)', iconColor: 'var(--wo-primary)', cardBorder: 'rgba(0,217,255,0.25)', cardBg: 'rgba(0,217,255,0.04)', cardHover: 'rgba(0,217,255,0.1)' },
                        emerald: { iconBg: 'rgba(16,185,129,0.2)', iconColor: '#34d399', cardBorder: 'rgba(16,185,129,0.3)', cardBg: 'rgba(16,185,129,0.06)', cardHover: 'rgba(16,185,129,0.12)' },
                        orange:  { iconBg: 'rgba(249,115,22,0.2)', iconColor: '#fb923c', cardBorder: 'rgba(249,115,22,0.3)', cardBg: 'rgba(249,115,22,0.06)', cardHover: 'rgba(249,115,22,0.12)' },
                        pink:    { iconBg: 'rgba(236,72,153,0.2)', iconColor: '#f472b6', cardBorder: 'rgba(236,72,153,0.3)', cardBg: 'rgba(236,72,153,0.06)', cardHover: 'rgba(236,72,153,0.12)' },
                        amber:   { iconBg: 'rgba(245,158,11,0.2)', iconColor: '#fbbf24', cardBorder: 'rgba(245,158,11,0.3)', cardBg: 'rgba(245,158,11,0.06)', cardHover: 'rgba(245,158,11,0.12)' },
                      };
                      const s = accentStyles[tmpl.accent] ?? accentStyles.cyan;
                      const Icon = tmpl.Icon;
                      const filledPrompt = fillPromptPlaceholders(tmpl.prompt, effectivePromptContext);
                      const segments = promptContextMounted ? getPromptDisplaySegments(filledPrompt, effectivePromptContext) : null;
                      const isHovered = hoveredPromptIndex === index;
                      const stepOffset = 10;
                      return (
                        <button
                          key={tmpl.id}
                          type="button"
                          onClick={() => { setInput(filledPrompt); setTimeout(() => textareaRef.current?.focus(), 50); }}
                          onMouseEnter={() => setHoveredPromptIndex(index)}
                          onMouseLeave={() => setHoveredPromptIndex(null)}
                          className="research-piano-card w-full text-left rounded-xl border p-3 transition-all duration-200 ease-out z-10"
                          style={{
                            marginLeft: index * stepOffset,
                            transform: isHovered ? 'translateX(-8px) scale(1.18)' : 'translateX(0) scale(1)',
                            transformOrigin: 'left center',
                            background: isHovered ? s.cardHover : s.cardBg,
                            borderColor: s.cardBorder,
                            color: 'var(--wo-text)',
                            boxShadow: isHovered ? '0 8px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.1)' : 'none',
                          }}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <div
                              className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0"
                              style={{ background: s.iconBg, color: s.iconColor }}
                            >
                              <Icon className="h-4 w-4" aria-hidden />
                            </div>
                            <h3 className="font-semibold text-xs truncate" style={{ color: 'var(--wo-text)' }}>{tmpl.title}</h3>
                          </div>
                          <p
                            className={`text-[11px] leading-relaxed pl-10 ${isHovered ? 'max-h-[220px] overflow-y-auto pr-1' : 'line-clamp-2'}`}
                            style={{ color: 'var(--wo-text-muted)' }}
                          >
                            {segments
                              ? segments.map((seg, i) =>
                                  seg.type === 'filled'
                                    ? <span key={i} className="underline decoration-2 decoration-[var(--wo-primary)] underline-offset-1" style={{ color: 'var(--wo-primary)' }}>{seg.text}</span>
                                    : seg.type === 'placeholder'
                                      ? <span key={i} className="underline decoration-dashed decoration-[var(--wo-text-muted)] underline-offset-1" style={{ color: 'var(--wo-text-muted)' }}>{seg.text}</span>
                                      : seg.text
                                )
                              : filledPrompt}
                          </p>
                        </button>
                      );
                    })}
                      </div>
                    </div>
                  </div>
                </aside>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function ResearchPage() {
  return (
    <Suspense>
      <ResearchPageInner />
    </Suspense>
  );
}
