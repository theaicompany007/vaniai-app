'use client';

import { useState, useEffect } from 'react';
import { FileText, Plus, Search, Clock, Loader2 } from 'lucide-react';

interface Document {
  id: string;
  title: string;
  type: string;
  status: string;
  content?: string;
  generated_by?: string;
  created_at: string;
}

interface CreateModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateModal({ onClose, onCreated }: CreateModalProps) {
  const [account, setAccount] = useState('');
  const [docType, setDocType] = useState('Pitch');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!account.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/agents/varta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, document_type: docType, instructions }),
      });
      if (res.ok) {
        onCreated();
        onClose();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="wo-card p-6 w-full max-w-md mx-4 space-y-4">
        <h2 className="text-lg font-bold" style={{ color: 'var(--wo-text)' }}>
          Create AI Document
        </h2>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--wo-text-muted)' }}>
            Target Account / Company
          </label>
          <input
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder="e.g. Tata Consultancy Services"
            className="wo-input w-full"
          />
        </div>
        <div>
          <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--wo-text-muted)' }}>
            Document Type
          </label>
          <div className="flex flex-wrap gap-2">
            {['Pitch', 'Proposal', 'Brief', 'Case Study'].map((t) => (
              <button key={t} type="button" onClick={() => setDocType(t)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{
                  background: docType === t ? 'rgba(0,217,255,0.15)' : 'rgba(255,255,255,0.04)',
                  border: docType === t ? '1px solid rgba(0,217,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  color: docType === t ? 'var(--wo-primary)' : 'var(--wo-text-muted)',
                }}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--wo-text-muted)' }}>
            Additional Instructions (optional)
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Any specific focus areas or requirements..."
            rows={3}
            className="wo-input w-full resize-none"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="wo-btn wo-btn-ghost">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={!account.trim() || loading}
            className="wo-btn wo-btn-primary gap-1.5 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {loading ? 'Generating...' : 'Generate with Varta'}
          </button>
        </div>
      </div>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/documents');
      if (res.ok) setDocs(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDocs(); }, []);

  const filtered = docs.filter(
    (d) =>
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreated={fetchDocs} />
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--wo-text)' }}>AI Documents</h1>
        <button onClick={() => setShowCreate(true)} className="wo-btn wo-btn-primary text-xs gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Create New Document
        </button>
      </div>

      <div className="relative w-80 mb-6">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: 'var(--wo-text-muted)' }}
        />
        <input
          type="text"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="wo-input pl-10"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Create New Card */}
        <div
          className="wo-card border-2 border-dashed p-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all min-h-[160px]"
          style={{ borderColor: 'var(--wo-border)' }}
          onClick={() => setShowCreate(true)}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--wo-primary)';
            (e.currentTarget as HTMLElement).style.background = 'rgba(0,217,255,0.04)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--wo-border)';
            (e.currentTarget as HTMLElement).style.background = 'var(--wo-surface)';
          }}
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(0,217,255,0.1)' }}>
            <Plus className="w-6 h-6" style={{ color: 'var(--wo-primary)' }} />
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--wo-text-muted)' }}>
            Create with Varta AI
          </span>
        </div>

        {loading ? (
          <div className="col-span-2 text-center py-8" style={{ color: 'var(--wo-text-muted)' }}>
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            Loading documents...
          </div>
        ) : (
          filtered.map((doc) => (
            <div key={doc.id} className="wo-card p-5 cursor-pointer transition-all hover:shadow-lg">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.12)' }}>
                  <FileText className="w-5 h-5" style={{ color: '#a78bfa' }} />
                </div>
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={doc.status === 'Complete' ? {
                    background: 'rgba(52,211,153,0.1)', color: '#34d399',
                  } : {
                    background: 'rgba(251,146,60,0.1)', color: '#fb923c',
                  }}
                >
                  {doc.status}
                </span>
              </div>
              <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--wo-text)' }}>{doc.title}</h3>
              <p className="text-xs mb-2" style={{ color: 'var(--wo-text-muted)' }}>{doc.type}</p>
              <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--wo-text-muted)' }}>
                <Clock className="w-3 h-3" />
                {timeAgo(doc.created_at)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
