'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, Plus, X, Pencil, ExternalLink, Trash2 } from 'lucide-react';
import DataTable from '@/components/DataTable';

interface Contact {
  id: string;
  name: string;
  avatar?: string;
  job_title?: string;
  company?: string;
  industry?: string;
  location?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  source?: string;
}

const INDUSTRIES = [
  'FMCG', 'Banking', 'Healthcare', 'Retail', 'Manufacturing',
  'Technology', 'E-commerce', 'Automotive', 'Telecom', 'Education',
  'Insurance', 'Pharma', 'Logistics', 'Media',
];

const SOURCE_COLORS: Record<string, { bg: string; color: string }> = {
  'Vani Signals':  { bg: 'rgba(0,217,255,0.10)',  color: 'var(--wo-primary)' },
  'Vani Research': { bg: 'rgba(139,92,246,0.12)', color: '#a78bfa' },
  'CSV Import':    { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8' },
};

const EMPTY_FORM = { name: '', email: '', job_title: '', company: '', industry: '', location: '', phone: '', linkedin_url: '' };

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filterIndustry, setFilterIndustry] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  function loadContacts() {
    setLoading(true);
    fetch('/api/contacts')
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d) => { if (Array.isArray(d)) setContacts(d); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { loadContacts(); }, []);


  const displayedContacts = filterIndustry
    ? contacts.filter((c) => c.industry === filterIndustry)
    : contacts;

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
      const name = row['name'] || row['full name'] || row['contact name'];
      if (!name) continue;  // only name required
      await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email:        row['email'] || row['email address'] || '',
          job_title:    row['job title'] || row['title'] || row['role'] || '',
          company:      row['company'] || row['organization'] || '',
          industry:     row['industry'] || '',
          location:     row['location'] || row['city'] || '',
          phone:        row['phone'] || row['mobile'] || row['phone number'] || '',
          linkedin_url: row['linkedin'] || row['linkedin url'] || row['linkedin_url'] || '',
          source:       'CSV Import',
        }),
      }).catch(() => null);
      imported++;
    }
    if (imported > 0) loadContacts();
    e.target.value = '';
  }

  function openAddModal() {
    setEditingContact(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  }

  function openEditModal(contact: Contact) {
    setEditingContact(contact);
    setForm({
      name:         contact.name ?? '',
      email:        contact.email ?? '',
      job_title:    contact.job_title ?? '',
      company:      contact.company ?? '',
      industry:     contact.industry ?? '',
      location:     contact.location ?? '',
      phone:        contact.phone ?? '',
      linkedin_url: contact.linkedin_url ?? '',
    });
    setFormError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('Contact name is required.'); return; }
    setSaving(true);
    setFormError('');
    try {
      const isEdit = !!editingContact;
      const res = await fetch('/api/contacts', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { id: editingContact!.id, ...form } : form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFormError((err as { error?: string }).error ?? 'Failed to save contact.');
      } else {
        setShowModal(false);
        loadContacts();
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
    await fetch(`/api/contacts?id=${confirmDelete.id}`, { method: 'DELETE' }).catch(() => null);
    setContacts((prev) => prev.filter((c) => c.id !== confirmDelete.id));
    setConfirmDelete(null);
    setDeleting(false);
  }

  const columns = [
    {
      key: 'name',
      label: 'Contact',
      render: (item: Contact) => (
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'rgba(0,217,255,0.12)', color: 'var(--wo-primary)' }}
          >
            {item.avatar ?? item.name.slice(0, 2).toUpperCase()}
          </div>
          <span className="font-medium" style={{ color: 'var(--wo-text)' }}>{item.name}</span>
        </div>
      ),
    },
    { key: 'job_title', label: 'Job Title' },
    { key: 'company', label: 'Company' },
    { key: 'email', label: 'Email' },
    {
      key: 'phone',
      label: 'Phone',
      render: (item: Contact) => (
        <span className="text-sm" style={{ color: 'var(--wo-text-muted)' }}>{item.phone ?? ''}</span>
      ),
    },
    {
      key: 'linkedin_url',
      label: 'LinkedIn',
      render: (item: Contact) =>
        item.linkedin_url ? (
          <a
            href={item.linkedin_url.startsWith('http') ? item.linkedin_url : `https://${item.linkedin_url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs transition-opacity hover:opacity-80"
            style={{ color: 'var(--wo-primary)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Profile
          </a>
        ) : null,
    },
    { key: 'industry', label: 'Industry' },
    { key: 'location', label: 'Location' },
    {
      key: 'source',
      label: 'Source',
      render: (item: Contact) => {
        if (!item.source) return null;
        const style = SOURCE_COLORS[item.source] ?? { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8' };
        return (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
            style={{ background: style.bg, color: style.color }}
          >
            {item.source}
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: '',
      render: (item: Contact) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
            title="Edit contact"
            style={{ color: 'var(--wo-text-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--wo-surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--wo-text)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--wo-text-muted)'; }}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(item); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
            title="Delete contact"
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
          <h1 className="text-xl font-bold" style={{ color: 'var(--wo-text)' }}>Contacts</h1>
          <p className="text-sm" style={{ color: 'var(--wo-text-muted)' }}>
            {loading ? 'Loading...' : `${contacts.length} contacts found`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
          <button onClick={() => importRef.current?.click()} className="wo-btn wo-btn-outline text-xs gap-1.5">
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </button>
          <button onClick={openAddModal} className="wo-btn wo-btn-primary text-xs gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Add Contact
          </button>
        </div>
      </div>

      {/* Filters: Industry highlighted (same as Accounts) */}
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
          {filterIndustry && (
            <button
              className="px-2.5 py-1 rounded-full text-xs font-medium ml-1 flex items-center gap-1 transition-all"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}
              onClick={() => setFilterIndustry('')}
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={displayedContacts}
        searchPlaceholder="Search name, company, email…"
        emptyMessage={loading ? 'Loading contacts...' : filterIndustry ? `No contacts in ${filterIndustry}.` : 'No contacts yet. Import a CSV or add your first contact.'}
      />

      {/* ── Delete Confirmation ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDelete(null); }}>
          <div className="wo-card w-full max-w-sm p-6">
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--wo-text)' }}>Delete Contact?</h2>
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

      {/* ── Add / Edit Contact Modal ── */}
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
              {editingContact ? 'Edit Contact' : 'Add New Contact'}
            </h2>

            <div className="flex flex-col gap-3">
              <div>
                <label className="wo-label">Full Name *</label>
                <input className="wo-input" placeholder="e.g. Raj Sharma"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="wo-label">Job Title / Role</label>
                <input className="wo-input" placeholder="e.g. Chief Technology Officer"
                  value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
              </div>
              <div>
                <label className="wo-label">Company</label>
                <input className="wo-input" placeholder="e.g. Parle Agro"
                  value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="wo-label">Email</label>
                  <input className="wo-input" type="email" placeholder="raj@company.com"
                    value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className="wo-label">Phone</label>
                  <input className="wo-input" type="tel" placeholder="+91 98765 43210"
                    value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="wo-label">LinkedIn URL</label>
                <input className="wo-input" placeholder="https://linkedin.com/in/rajsharma"
                  value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} />
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
              </div>
              <div>
                <label className="wo-label">Location</label>
                <input className="wo-input" placeholder="e.g. Mumbai, India"
                  value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>

              {formError && <p className="text-xs" style={{ color: '#ef4444' }}>{formError}</p>}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowModal(false)} className="wo-btn wo-btn-secondary flex-1 text-sm" disabled={saving}>
                  Cancel
                </button>
                <button onClick={handleSave} className="wo-btn wo-btn-primary flex-1 text-sm" disabled={saving}>
                  {saving ? 'Saving...' : editingContact ? 'Save Changes' : 'Add Contact'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
