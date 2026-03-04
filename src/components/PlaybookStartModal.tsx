'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePlaybook } from '@/context/PlaybookContext';
import { Map, X } from 'lucide-react';

const INDUSTRIES = [
  'FMCG', 'Banking', 'Healthcare', 'Retail', 'Manufacturing',
  'Technology', 'E-commerce', 'Automotive', 'Telecom', 'Education',
  'Insurance', 'Pharma', 'Logistics', 'Media',
];

interface Props {
  onClose: () => void;
}

export default function PlaybookStartModal({ onClose }: Props) {
  const router = useRouter();
  const { startPlaybook } = usePlaybook();
  const [company, setCompany] = useState('');
  const [industry, setIndustry] = useState('');
  const [customIndustry, setCustomIndustry] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const effectiveIndustry = showCustom ? customIndustry.trim() : industry;

  function selectIndustry(ind: string) {
    setIndustry(ind);
    setShowCustom(false);
    setCustomIndustry('');
  }

  function handleStart() {
    if (!company.trim()) return;
    startPlaybook(company.trim(), effectiveIndustry);
    onClose();
    router.push('/home/playbook');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.65)' }}>
      <div
        className="wo-card w-full max-w-lg mx-4 p-6"
        style={{ border: '1px solid rgba(0,217,255,0.2)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(0,217,255,0.1)', border: '1px solid rgba(0,217,255,0.2)' }}>
              <Map className="w-5 h-5" style={{ color: 'var(--wo-primary)' }} />
            </div>
            <div>
              <h2 className="font-bold text-base" style={{ color: 'var(--wo-text)' }}>Start a Company Playbook</h2>
              <p className="text-xs" style={{ color: 'var(--wo-text-muted)' }}>7-step guided sales play</p>
            </div>
          </div>
          <button onClick={onClose} className="wo-topnav-btn"><X className="w-4 h-4" /></button>
        </div>

        {/* Company */}
        <div className="mb-4">
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--wo-text-muted)' }}>
            Target Company *
          </label>
          <input
            autoFocus
            className="wo-input w-full"
            placeholder="e.g. Asian Paints, Reliance Retail…"
            value={company}
            onChange={e => setCompany(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleStart(); }}
          />
        </div>

        {/* Industry — chip buttons */}
        <div className="mb-4">
          <label className="block text-xs font-medium mb-2" style={{ color: 'var(--wo-text-muted)' }}>
            Industry <span style={{ color: 'var(--wo-text-muted)', fontWeight: 400 }}>(optional)</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {INDUSTRIES.map(ind => {
              const active = !showCustom && industry === ind;
              return (
                <button
                  key={ind}
                  onClick={() => selectIndustry(ind)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                  style={{
                    background: active ? 'rgba(0,217,255,0.18)' : 'rgba(255,255,255,0.05)',
                    border: active ? '1px solid rgba(0,217,255,0.5)' : '1px solid rgba(255,255,255,0.1)',
                    color: active ? 'var(--wo-primary)' : 'var(--wo-text-muted)',
                  }}
                >
                  {ind}
                </button>
              );
            })}
            {/* Other chip */}
            <button
              onClick={() => { setShowCustom(true); setIndustry(''); }}
              className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
              style={{
                background: showCustom ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.05)',
                border: showCustom ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.1)',
                color: showCustom ? '#a78bfa' : 'var(--wo-text-muted)',
              }}
            >
              + Other
            </button>
          </div>

          {/* Free-text for custom industry */}
          {showCustom && (
            <input
              autoFocus
              className="wo-input w-full mt-2"
              placeholder="Type your industry…"
              value={customIndustry}
              onChange={e => setCustomIndustry(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleStart(); }}
            />
          )}
        </div>

        {/* Preview */}
        {company.trim() && (
          <div className="p-3 rounded-xl text-xs mb-4" style={{ background: 'rgba(0,217,255,0.06)', border: '1px solid rgba(0,217,255,0.15)' }}>
            <p style={{ color: 'var(--wo-text-muted)' }}>Your 7-step playbook will guide you through:</p>
            <p className="mt-1 font-medium" style={{ color: 'var(--wo-primary)' }}>
              Research → Signals → Opportunity → Outreach → Pipeline
            </p>
            <p className="mt-0.5" style={{ color: 'var(--wo-text-muted)' }}>
              for <strong style={{ color: 'var(--wo-text)' }}>{company.trim()}</strong>
              {effectiveIndustry && <> · <span style={{ color: 'var(--wo-text)' }}>{effectiveIndustry}</span></>}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 wo-btn wo-btn-ghost">Cancel</button>
          <button
            onClick={handleStart}
            disabled={!company.trim()}
            className="flex-1 wo-btn wo-btn-primary disabled:opacity-40"
          >
            Start Playbook →
          </button>
        </div>
      </div>
    </div>
  );
}
