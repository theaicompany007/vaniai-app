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
const STORAGE_KEY = 'vani_playbook';

// ─── Context ──────────────────────────────────────────────────────────────────

const PlaybookContext = createContext<PlaybookContextValue>({
  playbook: null,
  startPlaybook: () => {},
  markDone: () => {},
  markPending: () => {},
  reset: () => {},
  activeStep: null,
  completedCount: 0,
});

export function PlaybookProvider({ children }: { children: ReactNode }) {
  const [playbook, setPlaybook] = useState<PlaybookState | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPlaybook(JSON.parse(raw));
    } catch {}
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    if (playbook) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(playbook));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [playbook]);

  const startPlaybook = useCallback((company: string, industry: string) => {
    const fresh: PlaybookState = {
      company,
      industry,
      steps: { ...DEFAULT_STEPS, company: 'done' },
      startedAt: new Date().toISOString(),
    };
    setPlaybook(fresh);
  }, []);

  const markDone = useCallback((stepId: StepId) => {
    setPlaybook(prev => prev ? { ...prev, steps: { ...prev.steps, [stepId]: 'done' } } : prev);
  }, []);

  const markPending = useCallback((stepId: StepId) => {
    setPlaybook(prev => prev ? { ...prev, steps: { ...prev.steps, [stepId]: 'pending' } } : prev);
  }, []);

  const reset = useCallback(() => setPlaybook(null), []);

  // Derive the current active step (first non-done step)
  const activeStep: StepId | null = playbook
    ? STEP_ORDER.find(id => playbook.steps[id] === 'pending') ?? null
    : null;

  const completedCount = playbook
    ? STEP_ORDER.filter(id => playbook.steps[id] === 'done').length
    : 0;

  return (
    <PlaybookContext.Provider value={{ playbook, startPlaybook, markDone, markPending, reset, activeStep, completedCount }}>
      {children}
    </PlaybookContext.Provider>
  );
}

export function usePlaybook() {
  return useContext(PlaybookContext);
}

export { STEP_ORDER };
