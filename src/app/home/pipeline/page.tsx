'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Opportunity {
  id: string;
  name: string;
  account?: string;
  owner?: string;
  stage: string;
  industry?: string;
  people?: number;
}

const COLUMNS = [
  { label: 'Discovery', keys: ['Discovery'] },
  { label: 'Qualified',  keys: ['Qualified'] },
  { label: 'Proposal',   keys: ['Proposal'] },
  { label: 'Negotiation', keys: ['Negotiation'] },
  { label: 'Won',        keys: ['Closed Won', 'Won'] },
];

/** Stage value to send to API for a column (first key in keys). */
function columnStage(col: (typeof COLUMNS)[0]): string {
  return col.keys[0];
}

const STAGE_COLORS: Record<string, string> = {
  Discovery:    '#3b82f6',
  Qualified:    '#8b5cf6',
  Proposal:     '#f59e0b',
  Negotiation:  '#10b981',
  'Closed Won': '#10b981',
  Won:          '#10b981',
  'Closed Lost': '#ef4444',
};

const BADGE_PALETTE = [
  '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981',
  '#ef4444', '#06b6d4', '#ec4899', '#84cc16',
  '#f97316', '#6366f1',
];

function accountColor(name?: string): string {
  if (!name) return BADGE_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return BADGE_PALETTE[Math.abs(hash) % BADGE_PALETTE.length];
}

function initials(name?: string): string {
  if (!name) return '??';
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

const DRAG_TYPE = 'application/x-vaniai-opportunity-id';

export default function PipelinePage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetCol, setDropTargetCol] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/opportunities')
      .then((r) => r.json())
      .then((d) => { setOpportunities(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const columns = COLUMNS.map((col) => ({
    ...col,
    items: opportunities.filter((o) => col.keys.includes(o.stage)),
  }));

  function handleDragStart(e: React.DragEvent, opp: Opportunity) {
    setDraggingId(opp.id);
    e.dataTransfer.setData(DRAG_TYPE, opp.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDropTargetCol(null);
  }

  function handleDragOver(e: React.DragEvent, colLabel: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetCol(colLabel);
  }

  function handleDragLeave() {
    setDropTargetCol(null);
  }

  function handleDrop(e: React.DragEvent, col: (typeof COLUMNS)[0]) {
    e.preventDefault();
    setDropTargetCol(null);
    const id = e.dataTransfer.getData(DRAG_TYPE);
    if (!id) return;
    const targetStage = columnStage(col);
    const opp = opportunities.find((o) => o.id === id);
    if (!opp || opp.stage === targetStage) return;

    setOpportunities((prev) =>
      prev.map((o) => (o.id === id ? { ...o, stage: targetStage } : o))
    );
    fetch('/api/opportunities', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, stage: targetStage }),
    }).catch(() => {
      setOpportunities((prev) =>
        prev.map((o) => (o.id === id ? { ...o, stage: opp.stage } : o))
      );
    });
  }

  return (
    <div className="p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--wo-text)' }}>Pipeline</h1>
        {loading && (
          <span className="text-xs" style={{ color: 'var(--wo-text-muted)' }}>Loading…</span>
        )}
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 h-[calc(100vh-180px)] overflow-x-auto pb-4">
        {columns.map((col) => (
          <div key={col.label} className="flex-shrink-0 w-72 flex flex-col">
            {/* Column header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--wo-text)' }}>
                {col.label}
              </h3>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ color: 'var(--wo-text-muted)', background: 'var(--wo-surface-2)' }}
              >
                {col.items.length}
              </span>
            </div>

            {/* Cards (drop zone) */}
            <div
              className="flex-1 flex flex-col gap-3 overflow-y-auto rounded-xl min-h-[120px] transition-colors"
              onDragOver={(e) => handleDragOver(e, col.label)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col)}
              style={{
                outline: dropTargetCol === col.label ? '2px dashed var(--wo-primary)' : undefined,
                outlineOffset: 2,
              }}
            >
              {col.items.map((opp) => (
                <div
                  key={opp.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, opp)}
                  onDragEnd={handleDragEnd}
                  className="wo-card p-4 cursor-grab active:cursor-grabbing transition-all hover:shadow-lg"
                  style={{
                    transition: 'box-shadow 0.2s, border-color 0.2s, opacity 0.2s',
                    opacity: draggingId === opp.id ? 0.6 : 1,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                      style={{ backgroundColor: accountColor(opp.account) }}
                    >
                      {initials(opp.account)}
                    </div>
                    <span
                      className="text-sm font-medium truncate"
                      style={{ color: 'var(--wo-text)' }}
                    >
                      {opp.account ?? 'Unknown'}
                    </span>
                  </div>

                  <p
                    className="text-xs line-clamp-2 mb-2"
                    style={{ color: 'var(--wo-text-muted)' }}
                  >
                    {opp.name}
                  </p>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: `${STAGE_COLORS[opp.stage] ?? '#3b82f6'}20`,
                        color: STAGE_COLORS[opp.stage] ?? '#3b82f6',
                      }}
                    >
                      {opp.stage}
                    </span>
                    {opp.industry && (
                      <span className="text-[10px]" style={{ color: 'var(--wo-text-muted)' }}>
                        {opp.industry}
                      </span>
                    )}
                    {opp.owner && (
                      <span className="text-[10px]" style={{ color: 'var(--wo-text-muted)' }}>
                        · {opp.owner}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {/* Empty state */}
              {col.items.length === 0 && !loading && (
                <div
                  className="text-center py-8 text-xs rounded-xl border-2 border-dashed"
                  style={{ color: 'var(--wo-text-muted)', borderColor: 'var(--wo-border)' }}
                >
                  No items
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Empty board prompt */}
      {!loading && opportunities.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <p className="text-sm" style={{ color: 'var(--wo-text-muted)' }}>
            No opportunities yet.
          </p>
          <Link
            href="/home/opportunities"
            className="wo-btn wo-btn-primary text-xs pointer-events-auto"
          >
            Create your first opportunity →
          </Link>
        </div>
      )}
    </div>
  );
}
