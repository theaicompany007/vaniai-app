'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, X, Pencil, ExternalLink, Trash2, Users, Building2 } from 'lucide-react';
import Link from 'next/link';
import DataTable from '@/components/DataTable';

interface Opportunity {
  id: string;
  name: string;
  account?: string;
  account_id?: string;
  owner?: string;
  stage: string;
  industry?: string;
  people?: number;
  source_url?: string;
  signal_id?: string;
  created_at: string;
}

interface Account {
  id: string;
  name: string;
  industry?: string;
}

const STAGE_TAG: Record<string, string> = {
  Discovery:     'wo-tag-blue',
  Qualified:     'wo-tag-purple',
  Proposal:      'wo-tag-orange',
  Negotiation:   'wo-tag-green',
  'Closed Won':  'wo-tag-green',
  'Closed Lost': 'wo-tag-red',
};

const STAGES = ['Discovery', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

const INDUSTRIES = [
  'FMCG', 'Banking', 'Healthcare', 'Retail', 'Manufacturing',
  'Technology', 'E-commerce', 'Automotive', 'Telecom', 'Education',
  'Insurance', 'Pharma', 'Logistics', 'Media',
  'Paints & Coatings',
];

const EMPTY_FORM = { name: '', account: '', account_id: '', owner: '', stage: 'Discovery', industry: '', people: '' };

function OpportunitiesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingOpp, setEditingOpp] = useState<Opportunity | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Opportunity | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filterStage, setFilterStage] = useState('');
  const [filterDate, setFilterDate] = useState('');

  function loadOpportunities() {
    setLoading(true);
    fetch('/api/opportunities')
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d) => { if (Array.isArray(d)) setOpportunities(d); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    loadOpportunities();
    fetch('/api/accounts')
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d) => { if (Array.isArray(d)) setAccounts(d); })
      .catch(() => {});
  }, []);

  // Prefill and open Add Opportunity modal when arriving from Playbook (?new=1&account=...&industry=...)
  useEffect(() => {
    const newParam = searchParams.get('new');
    const accountParam = searchParams.get('account');
    if (newParam !== '1' || !accountParam?.trim()) return;
    const industryParam = searchParams.get('industry')?.trim() ?? '';
    setEditingOpp(null);
    setForm({
      name:       accountParam.trim(),
      account:    accountParam.trim(),
      account_id: '',
      owner:     '',
      stage:     'Discovery',
      industry:   industryParam,
      people:    '',
    });
    setFormError('');
    setShowModal(true);
    router.replace('/home/opportunities', { scroll: false });
  }, [searchParams, router]);

  // After prefill from Playbook, resolve account_id once accounts are loaded so the dropdown shows the right selection
  useEffect(() => {
    if (!showModal || !form.account.trim() || form.account_id || accounts.length === 0) return;
    const matched = accounts.find(
      (a) => a.name.toLowerCase().includes(form.account.toLowerCase()) ||
             form.account.toLowerCase().includes(a.name.toLowerCase())
    );
    if (matched) {
      setForm((f) => ({ ...f, account_id: matched.id, industry: f.industry || (matched.industry ?? '') }));
    }
  }, [showModal, form.account, form.account_id, form.industry, accounts]);


  const now = new Date();
  const displayedOpportunities = opportunities.filter((o) => {
    const matchStage = !filterStage || o.stage === filterStage;
    const matchDate = !filterDate || (() => {
      const created = new Date(o.created_at);
      if (filterDate === '7d') return (now.getTime() - created.getTime()) <= 7 * 86400000;
      if (filterDate === '30d') return (now.getTime() - created.getTime()) <= 30 * 86400000;
      if (filterDate === '90d') return (now.getTime() - created.getTime()) <= 90 * 86400000;
      return true;
    })();
    return matchStage && matchDate;
  });

  function resolveAccount(name: string): Account | undefined {
    const lower = name.toLowerCase();
    return accounts.find(
      (a) => a.name.toLowerCase().includes(lower) || lower.includes(a.name.toLowerCase())
    );
  }

  function openAddModal() {
    setEditingOpp(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  }

  function openEditModal(opp: Opportunity) {
    setEditingOpp(opp);
    setForm({
      name:       opp.name ?? '',
      account:    opp.account ?? '',
      account_id: opp.account_id ?? '',
      owner:      opp.owner ?? '',
      stage:      opp.stage ?? 'Discovery',
      industry:   opp.industry ?? '',
      people:     opp.people != null ? String(opp.people) : '',
    });
    setFormError('');
    setShowModal(true);
  }

  // When account name changes in the form, auto-resolve account_id
  function handleAccountChange(name: string) {
    const matched = resolveAccount(name);
    setForm((f) => ({
      ...f,
      account:    name,
      account_id: matched?.id ?? '',
      industry:   matched?.industry ?? f.industry,
    }));
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('Opportunity name is required.'); return; }
    if (!form.account.trim()) { setFormError('Account name is required.'); return; }
    setSaving(true);
    setFormError('');
    try {
      const matched = resolveAccount(form.account);
      const payload = {
        name:       form.name.trim(),
        account:    form.account.trim(),
        account_id: (matched?.id ?? form.account_id) || null,
        owner:      form.owner.trim() || undefined,
        stage:      form.stage,
        industry:   form.industry || matched?.industry || undefined,
        people:     form.people ? parseInt(form.people, 10) : undefined,
      };

      const isEdit = !!editingOpp;
      const res = await fetch('/api/opportunities', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { id: editingOpp!.id, ...payload } : payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFormError((err as { error?: string }).error ?? 'Failed to save opportunity.');
      } else {
        setShowModal(false);
        loadOpportunities();
      }
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    await fetch(`/api/opportunities?id=${confirmDelete.id}`, { method: 'DELETE' }).catch(() => null);
    setOpportunities((prev) => prev.filter((o) => o.id !== confirmDelete.id));
    setConfirmDelete(null);
    setDeleting(false);
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (item: Opportunity) => (
        <span className="font-medium" style={{ color: 'var(--wo-text)' }}>{item.name}</span>
      ),
    },
    {
      key: 'account',
      label: 'Account',
      render: (item: Opportunity) =>
        item.account ? (
          <Link
            href="/home/accounts"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-80"
            style={{ color: 'var(--wo-primary)' }}
          >
            <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
            {item.account}
          </Link>
        ) : <span className="text-sm" style={{ color: 'var(--wo-text-muted)' }}>—</span>,
    },
    {
      key: 'people',
      label: 'Contacts',
      render: (item: Opportunity) =>
        item.people && item.people > 0 ? (
          <Link
            href="/home/contacts"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-80"
            style={{ color: 'var(--wo-primary)' }}
          >
            <Users className="w-3.5 h-3.5 flex-shrink-0" />
            {item.people}
          </Link>
        ) : (
          <span className="text-sm" style={{ color: 'var(--wo-text-muted)' }}>0</span>
        ),
    },
    { key: 'owner', label: 'Owner' },
    {
      key: 'stage',
      label: 'Stage',
      render: (item: Opportunity) => (
        <span className={`wo-tag ${STAGE_TAG[item.stage] || 'wo-tag-blue'}`}>{item.stage}</span>
      ),
    },
    { key: 'industry', label: 'Industry' },
    {
      key: 'signal_id',
      label: 'Signal',
      render: (item: Opportunity) =>
        item.signal_id ? (
          <Link
            href={`/home/signals?signal=${item.signal_id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-xs transition-opacity hover:opacity-80"
            style={{ color: 'var(--wo-primary)' }}
            title="View signal in Signals page"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View Signal
          </Link>
        ) : item.source_url ? (
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs transition-opacity hover:opacity-80"
            style={{ color: 'var(--wo-text-muted)' }}
            onClick={(e) => e.stopPropagation()}
            title={item.source_url}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Article
          </a>
        ) : null,
    },
    {
      key: 'actions',
      label: '',
      render: (item: Opportunity) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
            title="Edit opportunity"
            style={{ color: 'var(--wo-text-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--wo-surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--wo-text)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--wo-text-muted)'; }}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(item); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
            title="Delete opportunity"
            style={{ color: 'var(--wo-text-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--wo-text-muted)'; }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--wo-text)' }}>Opportunities</h1>
          <p className="text-sm" style={{ color: 'var(--wo-text-muted)' }}>
            {loading ? 'Loading...' : `${opportunities.length} opportunities found`}
          </p>
        </div>
        <button onClick={openAddModal} className="wo-btn wo-btn-primary text-xs gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Create New Opportunity
        </button>
      </div>

      {/* Filters: Stage and Date on separate lines, labels highlighted */}
      <div className="my-4 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold mr-2 min-w-[4rem]" style={{ color: 'var(--wo-primary)' }}>Stage :</span>
          {['', ...STAGES].map((s) => (
            <button key={s || 'all'} onClick={() => setFilterStage(s)}
              className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
              style={{
                background: filterStage === s ? 'rgba(0,217,255,0.15)' : 'rgba(255,255,255,0.04)',
                border: filterStage === s ? '1px solid rgba(0,217,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                color: filterStage === s ? 'var(--wo-primary)' : 'var(--wo-text-muted)',
              }}>
              {s || 'All'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold mr-2 min-w-[4rem]" style={{ color: 'var(--wo-primary)' }}>Date :</span>
          {([['', 'All time'], ['7d', 'Last 7d'], ['30d', 'Last 30d'], ['90d', 'Last 90d']] as [string, string][]).map(([val, label]) => (
            <button key={val || 'all'} onClick={() => setFilterDate(val)}
              className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
              style={{
                background: filterDate === val ? 'rgba(0,217,255,0.15)' : 'rgba(255,255,255,0.04)',
                border: filterDate === val ? '1px solid rgba(0,217,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                color: filterDate === val ? 'var(--wo-primary)' : 'var(--wo-text-muted)',
              }}>
              {label}
            </button>
          ))}
          {(filterStage || filterDate) && (
            <button className="px-2.5 py-1 rounded-full text-xs font-medium ml-1 flex items-center gap-1 transition-all"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}
              onClick={() => { setFilterStage(''); setFilterDate(''); }}>
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={displayedOpportunities}
        searchPlaceholder="Search opportunities"
        emptyMessage={loading ? 'Loading...' : 'No opportunities match your filters.'}
      />

      {/* ── Delete Confirmation ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDelete(null); }}>
          <div className="wo-card w-full max-w-sm p-6">
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--wo-text)' }}>Delete Opportunity?</h2>
            <p className="text-sm mb-5" style={{ color: 'var(--wo-text-muted)' }}>
              <span style={{ color: 'var(--wo-text)' }}>{confirmDelete.name}</span> will be permanently removed. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="wo-btn wo-btn-secondary flex-1 text-sm" disabled={deleting}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                className="wo-btn flex-1 text-sm"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="wo-card w-full max-w-md p-6 relative" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 wo-topnav-btn">
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--wo-text)' }}>
              {editingOpp ? 'Edit Opportunity' : 'Create New Opportunity'}
            </h2>

            <div className="flex flex-col gap-3">
              <div>
                <label className="wo-label">Opportunity Name *</label>
                <input className="wo-input" placeholder="e.g. Parle Agro — Project Vani Pilot"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>

              <div>
                <label className="wo-label">Account *</label>
                {accounts.length > 0 ? (
                  <select
                    className="wo-input"
                    value={form.account_id || ''}
                    onChange={(e) => {
                      const acc = accounts.find((a) => a.id === e.target.value);
                      setForm((f) => ({
                        ...f,
                        account:    acc?.name ?? '',
                        account_id: acc?.id ?? '',
                        industry:   acc?.industry ?? f.industry,
                      }));
                    }}
                  >
                    <option value="">Select account…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                ) : (
                  <input className="wo-input" placeholder="e.g. Parle Agro"
                    value={form.account} onChange={(e) => handleAccountChange(e.target.value)} />
                )}
              </div>

              <div>
                <label className="wo-label">Stage</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {STAGES.map((s) => (
                    <button key={s} type="button" onClick={() => setForm({ ...form, stage: s })}
                      className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                      style={{
                        background: form.stage === s ? 'rgba(0,217,255,0.15)' : 'rgba(255,255,255,0.04)',
                        border: form.stage === s ? '1px solid rgba(0,217,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                        color: form.stage === s ? 'var(--wo-primary)' : 'var(--wo-text-muted)',
                      }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="wo-label">Industry</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {INDUSTRIES.map((i) => (
                    <button key={i} type="button"
                      onClick={() => setForm({ ...form, industry: form.industry === i ? '' : i })}
                      className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                      style={{
                        background: form.industry === i ? 'rgba(0,217,255,0.15)' : 'rgba(255,255,255,0.04)',
                        border: form.industry === i ? '1px solid rgba(0,217,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                        color: form.industry === i ? 'var(--wo-primary)' : 'var(--wo-text-muted)',
                      }}>
                      {i}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] mt-1.5 mb-0.5" style={{ color: 'var(--wo-text-muted)' }}>Or enter custom:</p>
                <input
                  className="wo-input text-sm"
                  placeholder="e.g. Paints & Coats, Real Estate"
                  value={INDUSTRIES.includes(form.industry) ? '' : form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value.trim() })}
                />
              </div>

              <div>
                <label className="wo-label">Owner</label>
                <input className="wo-input" placeholder="e.g. Raaj"
                  value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
              </div>

              <div>
                <label className="wo-label">People (count)</label>
                <input className="wo-input" type="number" min={1} placeholder="e.g. 3"
                  value={form.people} onChange={(e) => setForm({ ...form, people: e.target.value })} />
              </div>

              {formError && <p className="text-xs" style={{ color: '#ef4444' }}>{formError}</p>}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowModal(false)} className="wo-btn wo-btn-secondary flex-1 text-sm" disabled={saving}>
                  Cancel
                </button>
                <button onClick={handleSave} className="wo-btn wo-btn-primary flex-1 text-sm" disabled={saving}>
                  {saving ? 'Saving...' : editingOpp ? 'Save Changes' : 'Create Opportunity'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OpportunitiesPageFallback() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="animate-pulse flex flex-col gap-4">
        <div className="h-8 rounded w-1/3" style={{ background: 'var(--wo-surface-2)' }} />
        <div className="h-64 rounded-2xl" style={{ background: 'var(--wo-surface-2)' }} />
      </div>
    </div>
  );
}

export default function OpportunitiesPage() {
  return (
    <Suspense fallback={<OpportunitiesPageFallback />}>
      <OpportunitiesPageContent />
    </Suspense>
  );
}
