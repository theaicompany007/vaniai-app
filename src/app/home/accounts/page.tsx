'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Upload, Star, Plus, X, Pencil, Trash2 } from 'lucide-react';
import DataTable from '@/components/DataTable';

interface Account {
  id: string;
  name: string;
  industry?: string;
  location?: string;
  website?: string;
  description?: string;
  contacts_count?: number;
  opp_count?: number;
  is_watchlisted?: boolean;
  created_at: string;
}

const INDUSTRIES = [
  'FMCG', 'Banking', 'Healthcare', 'Retail', 'Manufacturing',
  'Technology', 'E-commerce', 'Automotive', 'Telecom', 'Education',
  'Insurance', 'Pharma', 'Logistics', 'Media',
];

const COMPANY_SIZES = [
  { label: 'Startup (1–50)', value: 'startup' },
  { label: 'SMB (51–500)', value: 'smb' },
  { label: 'Mid-market (501–5k)', value: 'midmarket' },
  { label: 'Enterprise (5k+)', value: 'enterprise' },
];

const EMPTY_FORM = { name: '', industry: '', location: '', website: '', description: '' };

function AccountsPageInner() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Auto-open "Add Account" modal pre-filled from playbook ?name= + ?industry= params
  useEffect(() => {
    const nameParam = searchParams.get('name');
    const industryParam = searchParams.get('industry');
    if (nameParam) {
      setForm(prev => ({ ...prev, name: nameParam, industry: industryParam ?? prev.industry }));
      setEditingAccount(null);
      setShowModal(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [filterIndustry, setFilterIndustry] = useState('');
  const [filterSize, setFilterSize] = useState('');
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  function loadAccounts() {
    setLoading(true);
    fetch('/api/accounts')
      .then((r) => r.json())
      .then((d) => { setAccounts(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { loadAccounts(); }, []);


  async function toggleWatchlist(account: Account) {
    const next = !account.is_watchlisted;
    // Optimistic update
    setAccounts((prev) => prev.map((a) => a.id === account.id ? { ...a, is_watchlisted: next } : a));
    try {
      const res = await fetch('/api/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: account.id, is_watchlisted: next }),
      });
      if (!res.ok) {
        console.error('[toggleWatchlist] PATCH failed:', res.status, await res.text().catch(() => ''));
        // Revert on API error
        setAccounts((prev) => prev.map((a) => a.id === account.id ? { ...a, is_watchlisted: !next } : a));
      }
    } catch (err) {
      console.error('[toggleWatchlist] Network error:', err);
      setAccounts((prev) => prev.map((a) => a.id === account.id ? { ...a, is_watchlisted: !next } : a));
    }
  }

  async function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });
      if (!row['name'] && !row['company name'] && !row['account name']) continue;
      await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: row['name'] || row['company name'] || row['account name'],
          industry: row['industry'] || '',
          location: row['location'] || '',
          website: row['website'] || '',
          description: row['description'] || '',
        }),
      }).catch(() => null);
      imported++;
    }
    if (imported > 0) loadAccounts();
    e.target.value = '';
  }

  const watchlistCount = accounts.filter((a) => a.is_watchlisted).length;

  const columns = [
    {
      key: 'is_watchlisted',
      label: '',
      render: (item: Account) => (
        <button
          onClick={(e) => { e.stopPropagation(); toggleWatchlist(item); }}
          title={item.is_watchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
          style={{ color: item.is_watchlisted ? '#f59e0b' : 'var(--wo-text-muted)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.1)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <Star
            className="w-4 h-4"
            fill={item.is_watchlisted ? '#f59e0b' : 'none'}
          />
        </button>
      ),
    },
    {
      key: 'name',
      label: 'Account Name',
      render: (item: Account) => (
        <span className="font-medium" style={{ color: 'var(--wo-text)' }}>{item.name}</span>
      ),
    },
    { key: 'industry', label: 'Industry' },
    {
      key: 'contacts_count',
      label: 'Contacts',
      render: (item: Account) => (
        <span className="text-sm font-medium" style={{ color: 'var(--wo-text)' }}>
          {item.contacts_count ?? 0}
        </span>
      ),
    },
    {
      key: 'opp_count',
      label: 'Opportunities',
      render: (item: Account) => (
        <span className="text-sm font-medium" style={{ color: 'var(--wo-text)' }}>
          {item.opp_count ?? 0}
        </span>
      ),
    },
    { key: 'location', label: 'Location' },
    {
      key: 'actions',
      label: '',
      render: (item: Account) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
            title="Edit account"
            style={{ color: 'var(--wo-text-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--wo-surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--wo-text)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--wo-text-muted)'; }}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(item); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
            title="Delete account"
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

  const displayedAccounts = accounts.filter((a) => {
    const matchIndustry = !filterIndustry || a.industry === filterIndustry;
    const matchSize = !filterSize || true;
    const matchWatchlist = !watchlistOnly || !!a.is_watchlisted;
    return matchIndustry && matchSize && matchWatchlist;
  });

  function openModal() {
    setEditingAccount(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  }

  function openEditModal(account: Account) {
    setEditingAccount(account);
    setForm({
      name:        account.name ?? '',
      industry:    account.industry ?? '',
      location:    account.location ?? '',
      website:     account.website ?? '',
      description: account.description ?? '',
    });
    setFormError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('Account name is required.'); return; }
    setSaving(true);
    setFormError('');
    try {
      const isEdit = !!editingAccount;
      const res = await fetch('/api/accounts', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { id: editingAccount!.id, ...form } : form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFormError((err as { error?: string }).error ?? 'Failed to save account.');
      } else {
        setShowModal(false);
        loadAccounts();
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
    await fetch(`/api/accounts?id=${confirmDelete.id}`, { method: 'DELETE' }).catch(() => null);
    setAccounts((prev) => prev.filter((a) => a.id !== confirmDelete.id));
    setConfirmDelete(null);
    setDeleting(false);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--wo-text)' }}>Accounts</h1>
          <p className="text-sm" style={{ color: 'var(--wo-text-muted)' }}>
            {loading ? 'Loading...' : `${accounts.length} accounts found`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Hidden CSV file input */}
          <input
            ref={importRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleImportCSV}
          />
          <button
            onClick={() => importRef.current?.click()}
            className="wo-btn wo-btn-outline text-xs gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            Import Account
          </button>
          <button
            onClick={() => setWatchlistOnly((v) => !v)}
            className="wo-btn wo-btn-outline text-xs gap-1.5"
            style={{
              color: watchlistOnly ? '#f59e0b' : undefined,
              borderColor: watchlistOnly ? 'rgba(245,158,11,0.4)' : undefined,
            }}
            title="Show watchlisted accounts only"
          >
            <Star
              className="w-3.5 h-3.5"
              fill={watchlistOnly ? '#f59e0b' : 'none'}
              style={{ color: watchlistOnly ? '#f59e0b' : undefined }}
            />
            Watchlist{watchlistCount > 0 ? ` (${watchlistCount})` : ''}
          </button>
          <button onClick={openModal} className="wo-btn wo-btn-primary text-xs gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Add New Account
          </button>
        </div>
      </div>

      {/* Filters: Industry and Size on separate lines, labels highlighted */}
      <div className="my-4 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold mr-2 min-w-[4.5rem]" style={{ color: 'var(--wo-primary)' }}>Industry :</span>
          {['', ...INDUSTRIES].map((ind) => (
            <button key={ind || 'all'} onClick={() => setFilterIndustry(ind)}
              className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
              style={{
                background: filterIndustry === ind ? 'rgba(0,217,255,0.15)' : 'rgba(255,255,255,0.04)',
                border: filterIndustry === ind ? '1px solid rgba(0,217,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                color: filterIndustry === ind ? 'var(--wo-primary)' : 'var(--wo-text-muted)',
              }}>
              {ind || 'All'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold mr-2 min-w-[4.5rem]" style={{ color: 'var(--wo-primary)' }}>Size :</span>
          {[{ label: 'All', value: '' }, ...COMPANY_SIZES].map((sz) => (
            <button key={sz.value || 'all'} onClick={() => setFilterSize(sz.value)}
              className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
              style={{
                background: filterSize === sz.value ? 'rgba(0,217,255,0.15)' : 'rgba(255,255,255,0.04)',
                border: filterSize === sz.value ? '1px solid rgba(0,217,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                color: filterSize === sz.value ? 'var(--wo-primary)' : 'var(--wo-text-muted)',
              }}>
              {sz.label}
            </button>
          ))}
          {(filterIndustry || filterSize) && (
            <button className="px-2.5 py-1 rounded-full text-xs font-medium ml-1 flex items-center gap-1 transition-all"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}
              onClick={() => { setFilterIndustry(''); setFilterSize(''); }}>
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={displayedAccounts}
        searchPlaceholder="Search Name, company and more"
        emptyMessage={
          loading
            ? 'Loading accounts...'
            : watchlistOnly
            ? 'No watchlisted accounts yet. Click the ★ star on any account to add it.'
            : filterIndustry
            ? `No ${filterIndustry} accounts found.`
            : 'No accounts yet. Add your first account.'
        }
      />

      {/* ── Delete Confirmation ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDelete(null); }}>
          <div className="wo-card w-full max-w-sm p-6">
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--wo-text)' }}>Delete Account?</h2>
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

      {/* ── Add / Edit Account Modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div
            className="wo-card w-full max-w-md p-6 relative"
            style={{ maxHeight: '90vh', overflowY: 'auto' }}
          >
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 wo-topnav-btn">
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--wo-text)' }}>
              {editingAccount ? 'Edit Account' : 'Add New Account'}
            </h2>

            <div className="flex flex-col gap-3">
              <div>
                <label className="wo-label">Company Name *</label>
                <input
                  className="wo-input"
                  placeholder="e.g. Asian Paints"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
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
                {/* Free-text for custom industry not in the list */}
                {form.industry && !INDUSTRIES.includes(form.industry) ? (
                  <input
                    className="wo-input mt-2 text-xs"
                    value={form.industry}
                    onChange={(e) => setForm({ ...form, industry: e.target.value })}
                    placeholder="Custom industry…"
                  />
                ) : (
                  <input
                    className="wo-input mt-2 text-xs"
                    value={INDUSTRIES.includes(form.industry) ? '' : form.industry}
                    onChange={(e) => setForm({ ...form, industry: e.target.value || (INDUSTRIES.includes(form.industry) ? form.industry : '') })}
                    placeholder="Or type a custom industry (e.g. Paints and Coatings)…"
                  />
                )}
              </div>

              <div>
                <label className="wo-label">Location</label>
                <input
                  className="wo-input"
                  placeholder="e.g. Mumbai, India"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>

              <div>
                <label className="wo-label">Website</label>
                <input
                  className="wo-input"
                  placeholder="https://example.com"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                />
              </div>

              <div>
                <label className="wo-label">Description</label>
                <textarea
                  className="wo-input resize-none"
                  rows={3}
                  placeholder="Brief description of the company..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              {formError && (
                <p className="text-xs" style={{ color: '#ef4444' }}>{formError}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowModal(false)} className="wo-btn wo-btn-secondary flex-1 text-sm" disabled={saving}>
                  Cancel
                </button>
                <button onClick={handleSave} className="wo-btn wo-btn-primary flex-1 text-sm" disabled={saving}>
                  {saving ? 'Saving...' : editingAccount ? 'Save Changes' : 'Add Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AccountsPage() {
  return (
    <Suspense>
      <AccountsPageInner />
    </Suspense>
  );
}
