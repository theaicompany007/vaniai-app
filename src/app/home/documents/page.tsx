'use client';

import { useState, useEffect } from 'react';
import { FileText, Plus, Search, Clock, Loader2, X, Download, AlertCircle, CheckCircle } from 'lucide-react';

interface Document {
  id: string;
  title: string;
  type: string;
  status: string;
  content?: string | null;
  generated_by?: string | null;
  created_at: string;
}

interface CreateModalProps {
  onClose: () => void;
  onCreated: (downloadUrl?: string | null) => void;
}

function CreateModal({ onClose, onCreated }: CreateModalProps) {
  const [account, setAccount] = useState('');
  const [docType, setDocType] = useState('Pitch');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!account.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/agents/varta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: account.trim(), document_type: docType, instructions: instructions.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onCreated(data.download_url ?? null);
        onClose();
      } else {
        setError(data.error ?? `Request failed (${res.status})`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
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
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
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

function ViewModal({ doc, onClose, onDownload }: { doc: Document; onClose: () => void; onDownload: () => void }) {
  const sections = (doc.content ?? '').split(/^## /m).filter(Boolean);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="wo-card w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--wo-border)' }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--wo-text)' }}>{doc.title}</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--wo-text-muted)' }}>{doc.type} · {doc.status}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onDownload} className="wo-btn wo-btn-primary text-xs gap-1.5">
              <Download className="w-3.5 h-3.5" />
              Download PPTX
            </button>
            <button onClick={onClose} className="wo-topnav-btn"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ color: 'var(--wo-text)' }}>
          {sections.length > 0 ? sections.map((block, i) => {
            const lines = block.split('\n').filter(Boolean);
            const heading = lines[0] ?? '';
            const body = lines.slice(1).join('\n').trim();
            return (
              <div key={i}>
                <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--wo-primary)' }}>{heading}</h3>
                <div className="text-sm whitespace-pre-wrap" style={{ color: 'var(--wo-text-muted)' }}>{body}</div>
              </div>
            );
          }) : (
            <p className="text-sm" style={{ color: 'var(--wo-text-muted)' }}>No content yet.</p>
          )}
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
  const [viewDoc, setViewDoc] = useState<Document | null>(null);
  const [successMessage, setSuccessMessage] = useState<{ title: string; downloadUrl?: string | null } | null>(null);

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

  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 6000);
    return () => clearTimeout(t);
  }, [successMessage]);

  const handleCreated = (downloadUrl?: string | null) => {
    fetchDocs();
    setSuccessMessage({ title: 'Document created successfully.', downloadUrl });
  };

  const handleDownload = async () => {
    if (!viewDoc) return;
    try {
      const res = await fetch(`/api/documents/${viewDoc.id}/download`);
      const data = await res.json();
      if (res.ok && data.url) window.open(data.url, '_blank');
    } catch {}
  };

  const filtered = docs.filter(
    (d) =>
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.type ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
      {viewDoc && (
        <ViewModal doc={viewDoc} onClose={() => setViewDoc(null)} onDownload={handleDownload} />
      )}

      {successMessage && (
        <div
          className="mb-6 flex items-center justify-between gap-4 p-4 rounded-xl"
          style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}
        >
          <div className="flex items-center gap-2" style={{ color: '#22c55e' }}>
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{successMessage.title}</span>
          </div>
          {successMessage.downloadUrl && (
            <a
              href={successMessage.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="wo-btn wo-btn-primary text-xs gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Download PPTX
            </a>
          )}
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--wo-text)' }}>AI Documents</h1>
        <p className="text-sm" style={{ color: 'var(--wo-text-muted)' }}>
          Generate pitch decks, proposals, and briefs with Varta — powered by your knowledge base and account signals.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="relative w-full sm:w-80">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--wo-text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="wo-input pl-10 w-full"
          />
        </div>
        <button onClick={() => setShowCreate(true)} className="wo-btn wo-btn-primary text-sm gap-2 flex-shrink-0">
          <Plus className="w-4 h-4" />
          Create New Document
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          className="wo-card border-2 border-dashed p-8 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all min-h-[200px]"
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
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(0,217,255,0.12)' }}>
            <Plus className="w-7 h-7" style={{ color: 'var(--wo-primary)' }} />
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--wo-text)' }}>Create with Varta AI</span>
          <span className="text-xs text-center max-w-[200px]" style={{ color: 'var(--wo-text-muted)' }}>
            Pitch, proposal, brief, or case study — tailored to your account
          </span>
        </div>

        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="wo-card p-5 animate-pulse">
                <div className="h-10 w-10 rounded-xl mb-3" style={{ background: 'var(--wo-border)' }} />
                <div className="h-4 w-32 mb-2 rounded" style={{ background: 'var(--wo-border)' }} />
                <div className="h-3 w-20 mb-2 rounded" style={{ background: 'var(--wo-border)' }} />
                <div className="h-3 w-16 rounded" style={{ background: 'var(--wo-border)' }} />
              </div>
            ))}
          </>
        ) : filtered.length === 0 ? (
          <div className="col-span-full wo-card p-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-40" style={{ color: 'var(--wo-text-muted)' }} />
            <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--wo-text)' }}>No documents yet</h3>
            <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: 'var(--wo-text-muted)' }}>
              Create your first AI-generated document. Varta will use your knowledge base and account signals to build a tailored pitch, proposal, or brief.
            </p>
            <button onClick={() => setShowCreate(true)} className="wo-btn wo-btn-primary gap-2">
              <Plus className="w-4 h-4" />
              Create Document
            </button>
          </div>
        ) : (
          filtered.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => setViewDoc(doc)}
              className="wo-card p-5 text-left transition-all hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-xl focus:ring-[var(--wo-primary)] focus:ring-offset-[var(--wo-bg)]"
            >
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
              <h3 className="font-semibold text-sm mb-1 truncate" style={{ color: 'var(--wo-text)' }}>{doc.title}</h3>
              <p className="text-xs mb-2" style={{ color: 'var(--wo-text-muted)' }}>{doc.type}</p>
              <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--wo-text-muted)' }}>
                <Clock className="w-3 h-3" />
                {timeAgo(doc.created_at)}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
