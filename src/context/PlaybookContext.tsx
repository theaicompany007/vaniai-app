'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StepId = 'company' | 'account' | 'research' | 'signals' | 'opportunity' | 'outreach' | 'pipeline';
export type StepStatus = 'pending' | 'done';

export interface PlaybookState {
  company: string;
  industry: string;
  steps: Record<StepId, StepStatus>;
  startedAt: string;
}

interface PlaybookContextValue {
  playbook: PlaybookState | null;
  playbookLoading: boolean;
  startPlaybook: (company: string, industry: string) => void;
  markDone: (stepId: StepId) => void;
  markPending: (stepId: StepId) => void;
  reset: () => void;
  activeStep: StepId | null;
  completedCount: number;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_STEPS: Record<StepId, StepStatus> = {
  company:     'pending',
  account:     'pending',
  research:    'pending',
  signals:     'pending',
  opportunity: 'pending',
  outreach:    'pending',
  pipeline:    'pending',
};

const STEP_ORDER: StepId[] = ['company', 'account', 'research', 'signals', 'opportunity', 'outreach', 'pipeline'];

// ─── Context ──────────────────────────────────────────────────────────────────

const PlaybookContext = createContext<PlaybookContextValue>({
  playbook: null,
  playbookLoading: true,
  startPlaybook: () => {},
  markDone: () => {},
  markPending: () => {},
  reset: () => {},
  activeStep: null,
  completedCount: 0,
});

async function savePlaybook(state: PlaybookState): Promise<void> {
  const res = await fetch('/api/playbook', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  if (!res.ok) throw new Error('Failed to save playbook');
}

export function PlaybookProvider({ children }: { children: ReactNode }) {
  const [playbook, setPlaybook] = useState<PlaybookState | null>(null);
  const [playbookLoading, setPlaybookLoading] = useState(true);

  // Load from API on mount
  useEffect(() => {
    let cancelled = false;
    fetch('/api/playbook')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data && data.company != null && data.steps != null) {
          setPlaybook({
            company:   data.company ?? '',
            industry:  data.industry ?? '',
            steps:     data.steps ?? {},
            startedAt: data.startedAt ?? new Date().toISOString(),
          });
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPlaybookLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const startPlaybook = useCallback((company: string, industry: string) => {
    const fresh: PlaybookState = {
      company,
      industry,
      steps: { ...DEFAULT_STEPS, company: 'done' },
      startedAt: new Date().toISOString(),
    };
    setPlaybook(fresh);
    savePlaybook(fresh).catch(() => {});
  }, []);

  const markDone = useCallback((stepId: StepId) => {
    setPlaybook((prev) => {
      if (!prev) return prev;
      const next = { ...prev, steps: { ...prev.steps, [stepId]: 'done' as StepStatus } };
      savePlaybook(next).catch(() => {});
      return next;
    });
  }, []);

  const markPending = useCallback((stepId: StepId) => {
    setPlaybook((prev) => {
      if (!prev) return prev;
      const next = { ...prev, steps: { ...prev.steps, [stepId]: 'pending' as StepStatus } };
      savePlaybook(next).catch(() => {});
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setPlaybook(null);
    fetch('/api/playbook', { method: 'DELETE' }).catch(() => {});
  }, []);

  // Derive the current active step (first non-done step)
  const activeStep: StepId | null = playbook
    ? STEP_ORDER.find(id => playbook.steps[id] === 'pending') ?? null
    : null;

  const completedCount = playbook
    ? STEP_ORDER.filter(id => playbook.steps[id] === 'done').length
    : 0;

  return (
    <PlaybookContext.Provider value={{ playbook, playbookLoading, startPlaybook, markDone, markPending, reset, activeStep, completedCount }}>
      {children}
    </PlaybookContext.Provider>
  );
}

export function usePlaybook() {
  return useContext(PlaybookContext);
}

export { STEP_ORDER };
