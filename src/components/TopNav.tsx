'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Settings, Bell, Sun, Moon, HelpCircle, LogOut, X,
  BookOpen, Flame, FlaskConical, FileText, MessageCircle, ArrowRight, User, Map,
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { usePlaybook } from '@/context/PlaybookContext';

const PLAYBOOK_CHIP_HIDDEN_KEY = 'vaniai_header_playbook_hidden';

// ─── Workflow steps shown in the Help panel ───────────────────────────────────

const WORKFLOW_STEPS = [
  {
    step: 1,
    icon: Settings,
    title: 'Set Up Your Profile',
    description: 'Add your company details, ICP (target industry, personas, segment), and configure sales triggers.',
    href: '/settings',
    linkLabel: 'Open Settings',
  },
  {
    step: 2,
    icon: BookOpen,
    title: 'Build Your Knowledge Base',
    description: 'Upload pitch decks, case studies, and service docs. Agents use this context when writing pitches.',
    href: '/settings',
    linkLabel: 'Go to Knowledge Base',
  },
  {
    step: 3,
    icon: Flame,
    title: 'Generate Lead Signals',
    description: 'Vigil scans the web for buying signals — funding, hiring, leadership changes — at your target companies.',
    href: '/home/signals',
    linkLabel: 'View Lead Signals',
  },
  {
    step: 4,
    icon: FlaskConical,
    title: 'Research a Company',
    description: 'Vivek does a deep-dive on any account: tech stack, pain points, entry points, and recommended services.',
    href: '/research',
    linkLabel: 'Start Research',
  },
  {
    step: 5,
    icon: FileText,
    title: 'Create a Pitch Document',
    description: 'Varta generates a tailored pitch deck or proposal in seconds. Download as PPTX ready to present.',
    href: '/home/documents',
    linkLabel: 'Create Document',
  },
  {
    step: 6,
    icon: MessageCircle,
    title: 'Chat with Vidya',
    description: 'Ask your AI co-pilot for strategy, first-contact email drafts, next-best-action, or deal coaching.',
    href: '/home/chat',
    linkLabel: 'Open Chat',
  },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function TopNav() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { playbook, completedCount } = usePlaybook();
  const [playbookChipHidden, setPlaybookChipHidden] = useState<boolean>(false);

  useEffect(() => {
    try {
      setPlaybookChipHidden(localStorage.getItem(PLAYBOOK_CHIP_HIDDEN_KEY) === '1');
    } catch {}
  }, []);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const hidePlaybookChip = () => {
    setPlaybookChipHidden(true);
    try { localStorage.setItem(PLAYBOOK_CHIP_HIDDEN_KEY, '1'); } catch {}
  };
  const showPlaybookChip = () => {
    setPlaybookChipHidden(false);
    try { localStorage.removeItem(PLAYBOOK_CHIP_HIDDEN_KEY); } catch {}
  };

  useEffect(() => {
    fetch('/api/auth/session', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.email) setUserEmail(data.email);
        if (data?.role) {
          const roleMap: Record<string, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' };
          setUserRole(roleMap[data.role as string] ?? (data.role as string));
        }
      })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  function navigateFromHelp(href: string) {
    setShowHelp(false);
    router.push(href);
  }

  return (
    <>
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header
        className="wo-header h-14 flex items-center justify-between pl-0 pr-4 sm:pr-6 flex-shrink-0 z-30 gap-3"
        style={{
          background: 'var(--wo-surface)',
          borderBottom: '1px solid var(--wo-border)',
          transition: 'background 0.25s ease, border-color 0.2s ease, box-shadow 0.2s ease',
        }}
      >
        {/* ── Left: logo + title + tagline (Syne font, Co-Pilot style) ─────────── */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0 font-vani-brand">
          <Image
            src="/vani-logo.png"
            alt="Vani"
            width={32}
            height={32}
            className="object-contain flex-shrink-0"
          />
          <div className="min-w-0 flex-1 pb-0.5">
            <h1 className="vani-brand-title text-sm font-bold tracking-wide truncate" style={{ color: 'var(--wo-text)' }}>
              Vani AI - Sales Intelligence Platform
            </h1>
            <p className="mt-0 text-xs leading-tight" style={{ color: 'var(--wo-text-muted)' }}>
              <span className="font-bold animate-tagline-glow" style={{ color: 'var(--wo-primary)' }}>
                Don&apos;t app, just talk.
              </span>
            </p>
          </div>
        </div>

        {/* ── Center/Right: Playbook chip (when active) or Show Playbook ───── */}
        {playbook && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {playbookChipHidden ? (
              <button
                type="button"
                onClick={showPlaybookChip}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: 'rgba(0,217,255,0.08)',
                  border: '1px solid rgba(0,217,255,0.2)',
                  color: 'var(--wo-primary)',
                }}
                title="Show Playbook chip"
              >
                <Map className="w-3.5 h-3.5" />
                Show Playbook
              </button>
            ) : (
              <div
                className="flex items-center gap-2 pl-2.5 pr-1 py-1.5 rounded-full"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,217,255,0.12), rgba(139,92,246,0.1))',
                  border: '1px solid rgba(0,217,255,0.3)',
                  color: 'var(--wo-primary)',
                }}
              >
                <button
                  type="button"
                  onClick={() => router.push('/home/playbook')}
                  className="flex items-center gap-1.5 text-xs font-medium"
                >
                  <Map className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[120px]">{playbook.company} Playbook</span>
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: 'rgba(0,217,255,0.2)', color: 'var(--wo-primary)' }}
                  >
                    {completedCount}/7
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); hidePlaybookChip(); }}
                  className="p-1 rounded-full hover:bg-black/10 transition-colors"
                  title="Hide Playbook chip"
                  aria-label="Hide"
                >
                  <X className="w-3.5 h-3.5" style={{ color: 'var(--wo-text-muted)' }} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Right: user info + icon row ─────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-shrink-0">

          {/* User email + role pill */}
          {userEmail && (
            <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
              <User className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--wo-text-muted)' }} />
              <span className="text-xs truncate max-w-[200px] lg:max-w-[280px]" style={{ color: 'var(--wo-text-muted)' }}>
                {userEmail}
              </span>
              {userRole && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{
                    background: userRole === 'Owner' ? 'rgba(251,146,60,0.15)' : userRole === 'Admin' ? 'rgba(167,139,250,0.15)' : 'rgba(0,217,255,0.1)',
                    color: userRole === 'Owner' ? '#fb923c' : userRole === 'Admin' ? '#a78bfa' : 'var(--wo-primary)',
                  }}
                >
                  {userRole}
                </span>
              )}
            </div>
          )}

          {/* Divider */}
          {userEmail && <div className="hidden sm:block h-4 w-px flex-shrink-0" style={{ background: 'var(--wo-border)' }} />}

          {/* Help */}
          <button onClick={() => setShowHelp(true)} className="wo-topnav-btn" title="Help & Workflow Guide" aria-label="Help">
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Theme icon toggle (CoPilot style: single icon, no switch) */}
          <button
            onClick={toggleTheme}
            className="wo-topnav-btn"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4" style={{ color: 'var(--wo-text-muted)' }} />
            ) : (
              <Moon className="w-4 h-4" style={{ color: 'var(--wo-text-muted)' }} />
            )}
          </button>

          {/* Notifications */}
          <button className="wo-topnav-btn" aria-label="Notifications">
            <Bell className="w-4 h-4" />
          </button>

          {/* Settings */}
          <button onClick={() => router.push('/settings')} className="wo-topnav-btn" aria-label="Settings">
            <Settings className="w-4 h-4" />
          </button>

          {/* Sign out */}
          <button
            onClick={handleLogout}
            className="wo-topnav-btn"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" style={{ color: 'rgba(239,68,68,0.6)' }} />
          </button>

        </div>
      </header>

      {/* ── Help Panel ───────────────────────────────────────────────────────── */}
      {showHelp && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.45)' }}
            onClick={() => setShowHelp(false)}
          />

          {/* Drawer */}
          <div
            className="fixed right-0 top-0 h-full z-50 flex flex-col"
            style={{
              width: 400,
              background: 'var(--wo-surface)',
              borderLeft: '1px solid var(--wo-border)',
              boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
            }}
          >
            {/* Drawer header */}
            <div
              className="flex items-center justify-between px-5 py-4 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--wo-border)' }}
            >
              <div>
                <h2 className="text-base font-semibold" style={{ color: 'var(--wo-text)' }}>
                  How to use Vani
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--wo-text-muted)' }}>
                  Your 6-step AI sales workflow
                </p>
              </div>
              <button onClick={() => setShowHelp(false)} className="wo-topnav-btn">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Steps list */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              {WORKFLOW_STEPS.map(({ step, icon: Icon, title, description, href, linkLabel }) => (
                <div key={step} className="wo-card p-4">
                  <div className="flex items-start gap-3">
                    {/* Step number badge */}
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                      style={{ background: 'rgba(0,217,255,0.12)', color: 'var(--wo-primary)' }}
                    >
                      {step}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Title row */}
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--wo-primary)' }} />
                        <span className="text-sm font-semibold" style={{ color: 'var(--wo-text)' }}>
                          {title}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-xs leading-relaxed mb-2" style={{ color: 'var(--wo-text-muted)' }}>
                        {description}
                      </p>

                      {/* Link */}
                      <button
                        onClick={() => navigateFromHelp(href)}
                        className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
                        style={{ color: 'var(--wo-primary)' }}
                      >
                        {linkLabel} <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer CTA */}
            <div
              className="px-5 py-4 flex-shrink-0"
              style={{ borderTop: '1px solid var(--wo-border)' }}
            >
              <p className="text-xs mb-3" style={{ color: 'var(--wo-text-muted)' }}>
                Testing with a specific company? Start here:
              </p>
              <button
                onClick={() => navigateFromHelp('/home/accounts')}
                className="wo-btn wo-btn-primary w-full text-sm gap-2"
              >
                Add your first account
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
