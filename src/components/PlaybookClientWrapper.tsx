'use client';

import { usePlaybook, STEP_ORDER } from '@/context/PlaybookContext';
import { useRouter } from 'next/navigation';
import { Map } from 'lucide-react';

/**
 * Mounts the floating resume pill at bottom-right.
 * Rendered inside both home and research layouts (after PlaybookProvider).
 */
export default function PlaybookClientWrapper({ children }: { children: React.ReactNode }) {
  const { playbook, completedCount } = usePlaybook();
  const router = useRouter();

  const total = STEP_ORDER.length;

  return (
    <>
      {children}

      {/* ── Floating Resume Pill ── */}
      {playbook && (
        <button
          onClick={() => router.push('/home/playbook')}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(0,217,255,0.15), rgba(139,92,246,0.12))',
            border: '1px solid rgba(0,217,255,0.35)',
            color: 'var(--wo-primary)',
            boxShadow: '0 4px 20px rgba(0,217,255,0.2)',
            backdropFilter: 'blur(8px)',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(0,217,255,0.35)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,217,255,0.2)'; }}
        >
          <Map className="w-4 h-4" />
          <span>{playbook.company} Playbook</span>
          <span
            className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
            style={{ background: 'rgba(0,217,255,0.2)', color: 'var(--wo-primary)' }}
          >
            {completedCount}/{total}
          </span>
        </button>
      )}
    </>
  );
}
