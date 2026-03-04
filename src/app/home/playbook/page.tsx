'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  usePlaybook, STEP_ORDER, type StepId,
} from '@/context/PlaybookContext';
import PlaybookStartModal from '@/components/PlaybookStartModal';
import {
  CheckCircle2, Circle, ChevronRight, ExternalLink,
  RefreshCw, Trophy, RotateCcw, Building2, FlaskConical,
  Flame, Target, Mail, LayoutGrid, Map, Sparkles,
} from 'lucide-react';

// ─── Step definitions ─────────────────────────────────────────────────────────

interface StepDef {
  id: StepId;
  number: number;
  title: string;
  description: string;
  icon: React.ElementType;
  href?: (c: string, industry: string) => string;
  actionLabel?: string;
  storyLine: (c: string, industry: string) => string;
  autoDetect?: (c: string) => Promise<boolean>;
}

const STEP_DEFS: StepDef[] = [
  {
    id: 'company',
    number: 1,
    title: 'Set Target',
    description: 'Define your target company and industry to begin the sales play.',
    icon: Map,
    storyLine: (c, ind) => `You set **${c}** (${ind || 'unknown industry'}) as your target — the first move in a calculated sales play.`,
  },
  {
    id: 'account',
    number: 2,
    title: 'Add Account',
    description: 'Add this company to your CRM accounts so contacts and opportunities can be linked.',
    icon: Building2,
    href: (c, ind) => `/home/accounts?name=${encodeURIComponent(c)}${ind ? `&industry=${encodeURIComponent(ind)}` : ''}`,
    actionLabel: 'Open Accounts →',
    storyLine: (c) => `**${c}** was added to your accounts — you can now track every contact, signal, and deal in one place.`,
    autoDetect: async (c) => {
      try {
        const res = await fetch('/api/accounts');
        if (!res.ok) return false;
        const data: { name: string }[] = await res.json();
        return data.some(a => a.name.toLowerCase().includes(c.toLowerCase()));
      } catch { return false; }
    },
  },
  {
    id: 'research',
    number: 3,
    title: 'Deep Research',
    description: 'Run 3 targeted Vivek research queries — leadership, tech stack, and pitch angle.',
    icon: FlaskConical,
    href: (c) => `/research?playbook=${encodeURIComponent(c)}`,
    actionLabel: 'Open Research →',
    storyLine: (c) => `Vivek uncovered **${c}**'s leadership, digital initiatives, and the sharpest pitch angles. You're armed with insight.`,
    autoDetect: async (c) => {
      try {
        const res = await fetch('/api/research-sessions');
        if (!res.ok) return false;
        const data: { title: string; query: string }[] = await res.json();
        return data.some(s =>
          (s.title ?? '').toLowerCase().includes(c.toLowerCase()) ||
          (s.query ?? '').toLowerCase().includes(c.toLowerCase())
        );
      } catch { return false; }
    },
  },
  {
    id: 'signals',
    number: 4,
    title: 'Find Signals',
    description: 'Vigil scans for buying triggers — leadership changes, funding, expansion, tech investments.',
    icon: Flame,
    href: (c) => `/home/signals?company=${encodeURIComponent(c)}`,
    actionLabel: 'Find Signals →',
    storyLine: (c) => `Vigil surfaced live buying signals for **${c}** — you now have a sharp, timely hook for your outreach.`,
    autoDetect: async (c) => {
      try {
        const res = await fetch('/api/signals');
        if (!res.ok) return false;
        const data: { company: string }[] = await res.json();
        return data.some(s => s.company.toLowerCase().includes(c.toLowerCase()));
      } catch { return false; }
    },
  },
  {
    id: 'opportunity',
    number: 5,
    title: 'Create Opportunity',
    description: 'Add this company to your pipeline at the Discovery stage.',
    icon: Target,
    href: (c, ind) => `/home/opportunities?new=1&account=${encodeURIComponent(c)}${ind ? `&industry=${encodeURIComponent(ind)}` : ''}`,
    actionLabel: 'Add to Pipeline →',
    storyLine: (c) => `**${c}** entered your Discovery pipeline — the deal is now officially in motion.`,
    autoDetect: async (c) => {
      try {
        const res = await fetch('/api/opportunities');
        if (!res.ok) return false;
        const data: { account: string }[] = await res.json();
        return data.some(o => (o.account ?? '').toLowerCase().includes(c.toLowerCase()));
      } catch { return false; }
    },
  },
  {
    id: 'outreach',
    number: 6,
    title: 'Personalised Outreach',
    description: 'Use a signal card to generate Email / LinkedIn / WhatsApp outreach tied to a live trigger.',
    icon: Mail,
    href: (c) => `/home/signals?company=${encodeURIComponent(c)}`,
    actionLabel: 'Generate Outreach →',
    storyLine: (c) => `Personalised outreach was sent to **${c}** using a live buying signal as the hook — relevance that cuts through noise.`,
  },
  {
    id: 'pipeline',
    number: 7,
    title: 'Track Pipeline',
    description: 'Move the opportunity through Discovery → Qualified → Proposal → Won.',
    icon: LayoutGrid,
    href: () => `/home/pipeline`,
    actionLabel: 'View Pipeline →',
    storyLine: (c) => `**${c}** is being actively tracked through your pipeline — every stage move brings you closer to the close.`,
  },
];

// ─── Accomplishment cards ─────────────────────────────────────────────────────

function AccomplishmentCards({ completedIds, company }: { completedIds: StepId[]; company: string }) {
  const cards = STEP_DEFS.filter(s => completedIds.includes(s.id));
  if (cards.length === 0) return null;
  return (
    <div className="mt-6">
      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--wo-text-muted)' }}>
        Accomplished so far
      </p>
      <div className="flex flex-wrap gap-2">
        {cards.map(s => {
          const Icon = s.icon;
          return (
            <div
              key={s.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: 'rgba(0,217,255,0.08)', border: '1px solid rgba(0,217,255,0.2)', color: 'var(--wo-primary)' }}
            >
              <Icon className="w-3 h-3" />
              <span>{s.title}</span>
              <CheckCircle2 className="w-3 h-3" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Horizontal Stepper ───────────────────────────────────────────────────────

function HorizontalStepper({
  steps, activeStep, doneSteps, onStepClick,
}: {
  steps: StepDef[];
  activeStep: StepId | null;
  doneSteps: StepId[];
  onStepClick: (id: StepId) => void;
}) {
  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex items-center min-w-max mx-auto px-4">
        {steps.map((step, idx) => {
          const isDone = doneSteps.includes(step.id);
          const isActive = step.id === activeStep;
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex items-center">
              {/* Step node */}
              <button
                onClick={() => onStepClick(step.id)}
                className="flex flex-col items-center gap-1.5 group transition-all"
                style={{ width: 72 }}
              >
                {/* Circle */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all"
                  style={{
                    background: isDone
                      ? 'linear-gradient(135deg, rgba(0,217,255,0.25), rgba(0,217,255,0.1))'
                      : isActive
                      ? 'linear-gradient(135deg, rgba(0,217,255,0.15), rgba(139,92,246,0.1))'
                      : 'rgba(255,255,255,0.04)',
                    border: isDone
                      ? '2px solid rgba(0,217,255,0.6)'
                      : isActive
                      ? '2px solid rgba(0,217,255,0.45)'
                      : '2px solid rgba(255,255,255,0.1)',
                    boxShadow: isActive ? '0 0 12px rgba(0,217,255,0.25)' : 'none',
                  }}
                >
                  {isDone
                    ? <CheckCircle2 className="w-5 h-5" style={{ color: '#00d9ff' }} />
                    : <Icon className="w-4.5 h-4.5" style={{ color: isActive ? '#00d9ff' : 'var(--wo-text-muted)', width: 18, height: 18 }} />
                  }
                </div>
                {/* Label */}
                <span
                  className="text-[10px] text-center leading-tight"
                  style={{
                    color: isDone ? '#00d9ff' : isActive ? 'var(--wo-text)' : 'var(--wo-text-muted)',
                    fontWeight: isActive || isDone ? 600 : 400,
                    maxWidth: 68,
                  }}
                >
                  {step.title}
                </span>
              </button>

              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div
                  className="h-0.5 flex-shrink-0 transition-all"
                  style={{
                    width: 36,
                    background: doneSteps.includes(steps[idx + 1].id) || steps[idx + 1].id === activeStep
                      ? 'linear-gradient(90deg, rgba(0,217,255,0.5), rgba(0,217,255,0.2))'
                      : 'rgba(255,255,255,0.08)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Research Queries helper ──────────────────────────────────────────────────

function getResearchQueries(company: string) {
  return [
    `Deep dive into ${company} — digital transformation initiatives, technology stack, and AI/automation investments`,
    `Who is the best person to contact at ${company} for AI sales intelligence? Best entry angle?`,
    `How to pitch our AI sales intelligence platform to ${company} — key pain points and ROI angles`,
  ];
}

// ─── Story Panel ──────────────────────────────────────────────────────────────

function StoryPanel({ company, industry, doneSteps }: { company: string; industry: string; doneSteps: StepId[] }) {
  const lines = STEP_DEFS
    .filter(s => doneSteps.includes(s.id))
    .map(s => s.storyLine(company, industry));

  if (lines.length === 0) {
    return (
      <div className="h-full flex flex-col justify-center items-center text-center p-6">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
          style={{ background: 'rgba(0,217,255,0.08)', border: '1px solid rgba(0,217,255,0.15)' }}>
          <Sparkles className="w-6 h-6" style={{ color: 'var(--wo-primary)' }} />
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--wo-text)' }}>Your story begins here</p>
        <p className="text-xs" style={{ color: 'var(--wo-text-muted)' }}>
          Complete each step and your progress narrative will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-1">
      {lines.map((line, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
              style={{ background: '#00d9ff', boxShadow: '0 0 6px rgba(0,217,255,0.5)' }} />
            {i < lines.length - 1 && (
              <div className="w-px flex-1 mt-1" style={{ background: 'rgba(0,217,255,0.15)' }} />
            )}
          </div>
          <p className="text-sm pb-3" style={{ color: 'var(--wo-text-muted)', lineHeight: 1.6 }}
            dangerouslySetInnerHTML={{
              __html: line.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:var(--wo-text)">$1</strong>'),
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Action Panel ─────────────────────────────────────────────────────────────

function ActionPanel({
  step, company, industry, onMarkDone, onSkip,
}: {
  step: StepDef;
  company: string;
  industry: string;
  onMarkDone: () => void;
  onSkip: () => void;
}) {
  const router = useRouter();
  const Icon = step.icon;
  const queries = step.id === 'research' ? getResearchQueries(company) : [];

  function handleAction() {
    if (step.href) {
      router.push(step.href(company, industry));
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Step badge */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(0,217,255,0.1)', border: '1px solid rgba(0,217,255,0.25)' }}>
          <Icon className="w-4 h-4" style={{ color: 'var(--wo-primary)' }} />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--wo-text-muted)' }}>
            Step {step.number} of {STEP_ORDER.length}
          </p>
          <p className="text-sm font-bold" style={{ color: 'var(--wo-text)' }}>{step.title}</p>
        </div>
      </div>

      <p className="text-sm mb-4" style={{ color: 'var(--wo-text-muted)' }}>{step.description}</p>

      {/* Research: show 3 query chips */}
      {step.id === 'research' && (
        <div className="mb-4 space-y-2">
          <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--wo-text-muted)' }}>
            Suggested queries for Vivek
          </p>
          {queries.map((q, i) => (
            <button
              key={i}
              onClick={() => router.push(`/research?playbook=${encodeURIComponent(company)}&q=${encodeURIComponent(q)}`)}
              className="w-full text-left p-2.5 rounded-xl text-xs transition-colors flex items-start gap-2"
              style={{ background: 'rgba(0,217,255,0.05)', border: '1px solid rgba(0,217,255,0.15)', color: 'var(--wo-text)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,217,255,0.1)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,217,255,0.05)'; }}
            >
              <span className="mt-0.5 text-[10px] font-bold flex-shrink-0" style={{ color: 'var(--wo-primary)' }}>Q{i + 1}</span>
              <span>{q}</span>
              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--wo-text-muted)' }} />
            </button>
          ))}
        </div>
      )}

      {/* Target info chip */}
      <div className="p-2.5 rounded-xl mb-4 text-xs"
        style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
        <span style={{ color: 'var(--wo-text-muted)' }}>Target: </span>
        <strong style={{ color: 'var(--wo-text)' }}>{company}</strong>
        {industry && <><span style={{ color: 'var(--wo-text-muted)' }}> · </span><span style={{ color: 'var(--wo-text-muted)' }}>{industry}</span></>}
      </div>

      <div className="flex-1" />

      {/* Actions */}
      <div className="space-y-2">
        {step.href && (
          <button onClick={handleAction} className="wo-btn wo-btn-primary w-full flex items-center justify-center gap-2">
            <ExternalLink className="w-3.5 h-3.5" />
            {step.actionLabel ?? 'Go →'}
          </button>
        )}
        <button onClick={onMarkDone} className="wo-btn w-full flex items-center justify-center gap-2"
          style={{ background: 'rgba(0,217,255,0.08)', border: '1px solid rgba(0,217,255,0.2)', color: 'var(--wo-primary)' }}>
          <CheckCircle2 className="w-3.5 h-3.5" />
          Mark as Done
        </button>
        <button onClick={onSkip} className="wo-btn wo-btn-ghost w-full text-xs" style={{ color: 'var(--wo-text-muted)' }}>
          Skip for now
        </button>
      </div>
    </div>
  );
}

// ─── Celebration ──────────────────────────────────────────────────────────────

function Celebration({ company, onReset, onViewPlaybook }: { company: string; onReset: () => void; onViewPlaybook?: () => void }) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: 'linear-gradient(135deg, rgba(0,217,255,0.2), rgba(139,92,246,0.15))', border: '2px solid rgba(0,217,255,0.3)', boxShadow: '0 0 32px rgba(0,217,255,0.2)' }}>
        <Trophy className="w-10 h-10" style={{ color: '#00d9ff' }} />
      </div>
      <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--wo-text)' }}>Playbook Complete!</h2>
      <p className="text-sm mb-1" style={{ color: 'var(--wo-text-muted)' }}>
        You completed the full sales play for
      </p>
      <p className="text-base font-bold mb-6" style={{ color: 'var(--wo-primary)' }}>{company}</p>
      <div className="flex flex-wrap gap-3 justify-center">
        {onViewPlaybook && (
          <button onClick={onViewPlaybook} className="wo-btn wo-btn-primary flex items-center gap-2"
            style={{ background: 'rgba(0,217,255,0.12)', border: '1px solid rgba(0,217,255,0.3)', color: 'var(--wo-primary)' }}>
            <Map className="w-3.5 h-3.5" />
            View Playbook
          </button>
        )}
        <button onClick={() => router.push('/home/pipeline')} className="wo-btn wo-btn-primary flex items-center gap-2">
          <LayoutGrid className="w-3.5 h-3.5" />
          View Pipeline
        </button>
        <button onClick={onReset} className="wo-btn wo-btn-ghost flex items-center gap-2">
          <RotateCcw className="w-3.5 h-3.5" />
          New Playbook
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlaybookPage() {
  const router = useRouter();
  const { playbook, startPlaybook, markDone, markPending, reset, activeStep, completedCount } = usePlaybook();
  const [viewingStep, setViewingStep] = useState<StepId | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [viewingCompletedPlaybook, setViewingCompletedPlaybook] = useState(false);

  const doneSteps = playbook
    ? (Object.entries(playbook.steps).filter(([, v]) => v === 'done').map(([k]) => k as StepId))
    : [];

  const total = STEP_ORDER.length;
  const allDone = completedCount === total;

  // Select the step to show in the action panel
  const panelStepId = viewingStep ?? activeStep;
  const panelStep = STEP_DEFS.find(s => s.id === panelStepId) ?? null;

  // Auto-detect completed steps on load
  const runAutoDetect = useCallback(async () => {
    if (!playbook) return;
    setDetecting(true);
    for (const step of STEP_DEFS) {
      if (!step.autoDetect) continue;
      if (playbook.steps[step.id] === 'done') continue;
      try {
        const found = await step.autoDetect(playbook.company);
        if (found) markDone(step.id);
      } catch {}
    }
    setDetecting(false);
  }, [playbook, markDone]);

  useEffect(() => { runAutoDetect(); }, []); // run once on mount

  if (!playbook) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(0,217,255,0.08)', border: '1px solid rgba(0,217,255,0.2)' }}>
          <Map className="w-8 h-8" style={{ color: 'var(--wo-primary)' }} />
        </div>
        <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--wo-text)' }}>No Active Playbook</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--wo-text-muted)' }}>
          Start a playbook from the Home page to guide your full sales play for a company.
        </p>
        <button onClick={() => router.push('/home')} className="wo-btn wo-btn-primary">
          Go to Home →
        </button>
      </div>
    );
  }

  const { company, industry } = playbook;
  const progressPct = Math.round((completedCount / total) * 100);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ padding: '20px 24px 24px' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(0,217,255,0.1)', border: '1px solid rgba(0,217,255,0.2)' }}>
            <Map className="w-5 h-5" style={{ color: 'var(--wo-primary)' }} />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none" style={{ color: 'var(--wo-text)' }}>
              {company} Playbook
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--wo-text-muted)' }}>
              {industry && <span>{industry} · </span>}
              {completedCount} of {total} steps complete
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {detecting && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--wo-text-muted)' }}>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Detecting progress…
            </div>
          )}
          <button
            onClick={() => setShowStartModal(true)}
            className="wo-btn wo-btn-ghost text-xs flex items-center gap-1.5"
          >
            <RotateCcw className="w-3 h-3" />
            New Playbook
          </button>
        </div>
      </div>

      {/* ── Progress bar ───────────────────────────────────────── */}
      <div className="flex-shrink-0 mb-4">
        <div className="w-full rounded-full overflow-hidden" style={{ height: 5, background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, #00d9ff, #8b5cf6)',
              boxShadow: '0 0 8px rgba(0,217,255,0.4)',
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px]" style={{ color: 'var(--wo-text-muted)' }}>Progress</span>
          <span className="text-[10px] font-semibold" style={{ color: 'var(--wo-primary)' }}>{progressPct}%</span>
        </div>
      </div>

      {/* ── Horizontal Stepper ─────────────────────────────────── */}
      <div className="wo-card flex-shrink-0 mb-4 py-4 px-2 overflow-hidden">
        <HorizontalStepper
          steps={STEP_DEFS}
          activeStep={activeStep}
          doneSteps={doneSteps}
          onStepClick={(id) => setViewingStep(id)}
        />
      </div>

      {/* ── Two-column layout ──────────────────────────────────── */}
      {allDone && !viewingCompletedPlaybook ? (
        <div className="flex-1 wo-card overflow-hidden">
          <Celebration
            company={company}
            onReset={() => { reset(); router.push('/home'); }}
            onViewPlaybook={() => setViewingCompletedPlaybook(true)}
          />
        </div>
      ) : (
        <div className="flex-1 grid gap-4 min-h-0" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {/* Story Panel */}
          <div className="wo-card overflow-y-auto p-5">
            {allDone && viewingCompletedPlaybook && (
              <button
                onClick={() => setViewingCompletedPlaybook(false)}
                className="wo-btn wo-btn-ghost text-xs mb-3 flex items-center gap-1.5"
                style={{ color: 'var(--wo-text-muted)' }}
              >
                ← Back to summary
              </button>
            )}
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--wo-text-muted)' }}>
              Your Story So Far
            </p>
            <StoryPanel company={company} industry={industry} doneSteps={doneSteps} />
            <AccomplishmentCards completedIds={doneSteps} company={company} />
          </div>

          {/* Action Panel */}
          <div className="wo-card overflow-y-auto p-5">
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--wo-text-muted)' }}>
              {allDone && viewingCompletedPlaybook ? 'Step Details' : (viewingStep && viewingStep !== activeStep ? 'Step Details' : 'Your Next Move')}
            </p>
            {panelStep ? (
              <ActionPanel
                step={panelStep}
                company={company}
                industry={industry}
                onMarkDone={() => {
                  markDone(panelStep.id);
                  setViewingStep(null);
                }}
                onSkip={() => {
                  markDone(panelStep.id);
                  setViewingStep(null);
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <CheckCircle2 className="w-8 h-8 mb-2" style={{ color: '#00d9ff' }} />
                <p className="text-sm" style={{ color: 'var(--wo-text-muted)' }}>All remaining steps completed!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step nav pills (click to undo) ─────────────────────── */}
      {!allDone && (
        <div className="flex-shrink-0 mt-3 flex flex-wrap gap-1.5">
          {STEP_DEFS.filter(s => doneSteps.includes(s.id)).map(s => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => markPending(s.id)}
                title="Click to mark as pending"
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all"
                style={{ background: 'rgba(0,217,255,0.06)', border: '1px solid rgba(0,217,255,0.15)', color: 'var(--wo-text-muted)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.6'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
              >
                <Icon style={{ width: 10, height: 10 }} />
                {s.title} ✓
              </button>
            );
          })}
        </div>
      )}

      {/* ── Start new playbook modal (replaces current one) ───────── */}
      {showStartModal && (
        <PlaybookStartModal
          onClose={() => setShowStartModal(false)}
          existingCompany={company}
          onStart={(c, i) => {
            reset();
            startPlaybook(c, i);
            setShowStartModal(false);
          }}
        />
      )}
    </div>
  );
}
