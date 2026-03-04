'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  User, Users, Building2, SlidersHorizontal, Bell, ChevronDown, CreditCard,
  BookOpen, Upload, Trash2, Search as SearchIcon, Loader2, Check, AlertCircle,
  Globe, Plus, X, Sparkles, Lock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ─── Constants ─────────────────────────────────────────────────────────────────
const GEOGRAPHY_OPTIONS = [
  'India', 'USA', 'UAE', 'Singapore', 'UK', 'Australia',
  'Canada', 'Germany', 'Southeast Asia', 'Europe', 'Middle East',
];
const INDUSTRY_OPTIONS = [
  'FMCG', 'Banking', 'Healthcare', 'Retail', 'Manufacturing',
  'Technology', 'E-commerce', 'Automotive', 'Telecom', 'Education',
  'Insurance', 'Pharma', 'Logistics', 'Media',
];
const PERSONA_OPTIONS = [
  'CIO', 'CTO', 'CEO', 'CMO', 'CDO', 'MD', 'CFO', 'CISO',
  'VP Technology', 'Head of IT', 'Head of Digital', 'Director of Operations',
  'DGM IT', 'DofDT', 'VP Engineering', 'Chief Digital Officer',
];
const SEGMENT_OPTIONS = [
  'SMB (1-100)', 'Mid-Market (101-1000)',
  'Enterprise (1001-10000)', 'Large Enterprise (10000+)',
];
const TRIGGER_CATEGORIES = [
  'CXO Hiring', 'Business Expansion', 'Tech Migration',
  'Challenges', 'Business Initiatives', 'Funding', 'Custom',
];

// ─── Types ─────────────────────────────────────────────────────────────────────
interface SalesTrigger {
  id: string;
  category: string;
  description: string;
  is_custom?: boolean;
}

interface OrgProfile {
  website_url?: string;        // kept for backward-compat (first URL)
  website_urls?: string[];     // multi-URL support
  industry?: string;
  description?: string;
  services?: string[];
  client_names?: string[];
  target_geography?: string[];
  target_industry?: string[];
  target_personas?: string[];
  target_segment?: string[];
  sales_triggers?: SalesTrigger[];
}

interface UserProfile {
  first_name: string;
  last_name: string;
  designation: string;
  timezone: string;
  phone_code: string;
  phone: string;
  email: string;
  website: string;
}

interface Member {
  user_id: string;
  name: string;
  email: string;
  role: string;
  joined: string;
}

const EMPTY_PROFILE: OrgProfile = {
  website_url: '',
  website_urls: [],
  industry: '',
  description: '',
  services: [],
  client_names: [],
  target_geography: [],
  target_industry: [],
  target_personas: [],
  target_segment: [],
  sales_triggers: [],
};

// ─── Settings Tabs ─────────────────────────────────────────────────────────────
const SETTINGS_TABS = [
  { id: 'account',      label: 'My Account',      icon: User },
  { id: 'user',         label: 'User',             icon: Users },
  { id: 'company',      label: 'Company Profile',  icon: Building2 },
  { id: 'monitoring',   label: 'Monitoring Rules', icon: SlidersHorizontal },
  { id: 'notification', label: 'Notification',     icon: Bell },
  { id: 'billing',      label: 'Billing',          icon: CreditCard },
  { id: 'knowledge',    label: 'Knowledge Base',   icon: BookOpen },
];

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('account');

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Settings Sidebar */}
      <div
        className="w-56 p-4 flex flex-col gap-1 flex-shrink-0"
        style={{ background: 'var(--wo-surface)', borderRight: '1px solid var(--wo-border)' }}
      >
        {SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all"
              style={active ? {
                background: 'rgba(0,217,255,0.1)',
                color: 'var(--wo-primary)',
                fontWeight: 600,
              } : { color: 'var(--wo-text-muted)' }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--wo-surface-2)'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
        {activeTab === 'account'      && <AccountSettings />}
        {activeTab === 'user'         && <UserSettings />}
        {activeTab === 'company'      && <CompanySettings />}
        {activeTab === 'monitoring'   && <MonitoringSettings />}
        {activeTab === 'notification' && <NotificationSettings />}
        {activeTab === 'billing'      && <BillingSettings />}
        {activeTab === 'knowledge'    && <KnowledgeBaseSettings />}
      </div>
    </div>
  );
}

// ─── Label helper ──────────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--wo-text)' }}>
      {children}
    </label>
  );
}

// ─── VaniToggle ────────────────────────────────────────────────────────────────
function VaniToggle({
  defaultOn = true,
  checked,
  onChange,
}: { defaultOn?: boolean; checked?: boolean; onChange?: (on: boolean) => void }) {
  const [internalOn, setInternalOn] = useState(defaultOn);
  const isControlled = typeof checked === 'boolean';
  const on = isControlled ? checked : internalOn;
  const setOn = (v: boolean) => {
    if (!isControlled) setInternalOn(v);
    onChange?.(v);
  };
  return (
    <button
      type="button"
      onClick={() => setOn(!on)}
      className="relative flex-shrink-0 rounded-full transition-all"
      style={{
        width: 40, height: 22,
        background: on ? 'var(--wo-primary)' : 'var(--wo-surface-2)',
        border: `1px solid ${on ? 'var(--wo-primary)' : 'var(--wo-border)'}`,
        boxShadow: on ? '0 0 8px var(--wo-cyan-glow)' : 'none',
      }}
      aria-checked={on} role="switch"
    >
      <span
        className="absolute top-[3px] w-[14px] h-[14px] rounded-full bg-white transition-all"
        style={{ left: on ? 'calc(100% - 17px)' : 3, boxShadow: on ? '0 0 4px rgba(0,0,0,0.2)' : 'none' }}
      />
    </button>
  );
}

function NotifRow({
  label,
  desc,
  checked,
  onChange,
}: { label: string; desc: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--wo-text)' }}>{label}</p>
        <p className="text-xs" style={{ color: 'var(--wo-text-muted)' }}>{desc}</p>
      </div>
      <VaniToggle checked={checked} onChange={onChange} />
    </div>
  );
}

// ─── ChipSelector ──────────────────────────────────────────────────────────────
function ChipSelector({
  options, selected, onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (opt: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {options.map(opt => {
        const isSelected = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className="text-xs px-3 py-1.5 rounded-full transition-all font-medium flex items-center gap-1"
            style={isSelected ? {
              background: 'rgba(0,217,255,0.15)',
              color: 'var(--wo-primary)',
              border: '1px solid rgba(0,217,255,0.3)',
            } : {
              background: 'var(--wo-surface-2)',
              color: 'var(--wo-text-muted)',
              border: '1px solid var(--wo-border)',
            }}
          >
            {isSelected && <Check className="w-3 h-3" />}
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── EditableChips ─────────────────────────────────────────────────────────────
function EditableChips({
  chips, onChange, placeholder,
}: {
  chips: string[];
  onChange: (chips: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  function add() {
    const val = input.trim();
    if (val && !chips.includes(val)) {
      onChange([...chips, val]);
      setInput('');
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
        {chips.map(chip => (
          <span
            key={chip}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(0,217,255,0.1)', color: 'var(--wo-primary)', border: '1px solid rgba(0,217,255,0.2)' }}
          >
            {chip}
            <button
              type="button"
              onClick={() => onChange(chips.filter(c => c !== chip))}
              className="ml-0.5 hover:opacity-70 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {chips.length === 0 && (
          <span className="text-xs italic" style={{ color: 'var(--wo-text-muted)' }}>None added yet</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder ?? 'Type and press Enter or +'}
          className="wo-input flex-1 text-sm"
        />
        <button
          type="button"
          onClick={add}
          disabled={!input.trim()}
          className="wo-btn wo-btn-outline px-3 disabled:opacity-40"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── StatusMsg ─────────────────────────────────────────────────────────────────
function StatusMsg({ msg }: { msg: string }) {
  if (!msg) return null;
  const isError = msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('error');
  return (
    <div
      className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg"
      style={{ background: isError ? 'rgba(239,68,68,0.1)' : 'rgba(52,211,153,0.1)', color: isError ? '#ef4444' : '#34d399' }}
    >
      {isError ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <Check className="w-4 h-4 flex-shrink-0" />}
      {msg}
    </div>
  );
}

// ─── AccountSettings ───────────────────────────────────────────────────────────
function AccountSettings() {
  const [profile, setProfile] = useState<UserProfile>({
    first_name: '', last_name: '', designation: 'Consultant',
    timezone: 'Asia/Calcutta', phone_code: '+91', phone: '',
    email: '', website: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/settings/profile')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setProfile(prev => ({ ...prev, ...data }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      setMsg(res.ok ? 'Saved successfully!' : 'Failed to save. Please try again.');
    } catch {
      setMsg('Failed to save. Please try again.');
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 3500);
    }
  }

  function set(field: keyof UserProfile, value: string) {
    setProfile(prev => ({ ...prev, [field]: value }));
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--wo-primary)' }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-bold" style={{ color: 'var(--wo-text)' }}>My Account</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>First Name</Label>
          <input
            type="text" className="wo-input" placeholder="First name"
            value={profile.first_name}
            onChange={e => set('first_name', e.target.value)}
          />
        </div>
        <div>
          <Label>Last Name</Label>
          <input
            type="text" className="wo-input" placeholder="Last name"
            value={profile.last_name}
            onChange={e => set('last_name', e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label>Designation</Label>
        <input
          type="text" className="wo-input" placeholder="e.g. Consultant"
          value={profile.designation}
          onChange={e => set('designation', e.target.value)}
        />
      </div>

      <div>
        <Label>Timezone</Label>
        <div className="relative">
          <select
            className="wo-input appearance-none pr-10"
            value={profile.timezone}
            onChange={e => set('timezone', e.target.value)}
          >
            <option value="Asia/Calcutta">Asia/Calcutta (IST)</option>
            <option value="Asia/Dubai">Asia/Dubai (GST)</option>
            <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
            <option value="US/Eastern">US/Eastern (EST)</option>
            <option value="US/Pacific">US/Pacific (PST)</option>
            <option value="Europe/London">Europe/London (GMT)</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--wo-text-muted)' }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Phone</Label>
          <div className="flex gap-2">
            <div className="relative">
              <select
                className="wo-input w-20 appearance-none pr-6"
                value={profile.phone_code}
                onChange={e => set('phone_code', e.target.value)}
              >
                <option value="+91">+91</option>
                <option value="+1">+1</option>
                <option value="+44">+44</option>
                <option value="+971">+971</option>
                <option value="+65">+65</option>
              </select>
            </div>
            <input
              type="tel" className="wo-input flex-1" placeholder="Phone number"
              value={profile.phone}
              onChange={e => set('phone', e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label>Email</Label>
          <input
            type="email" className="wo-input" placeholder="you@example.com"
            value={profile.email}
            readOnly
            style={{ opacity: 0.7, cursor: 'default' }}
          />
        </div>
      </div>

      <div>
        <Label>Website</Label>
        <input
          type="url" className="wo-input" placeholder="https://..."
          value={profile.website}
          onChange={e => set('website', e.target.value)}
        />
      </div>

      <StatusMsg msg={msg} />

      <div className="pt-2">
        <button onClick={handleSave} disabled={saving} className="wo-btn wo-btn-primary gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Change password */}
      <ChangePasswordBlock />
    </div>
  );
}

// ─── Change password (My Account) ───────────────────────────────────────────────
function ChangePasswordBlock() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setMessage({ type: 'err', text: 'Password must be at least 8 characters' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'err', text: 'Passwords do not match' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setMessage({ type: 'err', text: error.message });
        setLoading(false);
        return;
      }
      setMessage({ type: 'ok', text: 'Password updated successfully.' });
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setMessage(null), 4000);
    } catch {
      setMessage({ type: 'err', text: 'Something went wrong. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wo-card p-5 flex flex-col gap-4 mt-8">
      <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--wo-text)' }}>
        <Lock className="w-4 h-4" style={{ color: 'var(--wo-text-muted)' }} />
        Change password
      </h3>
      <p className="text-sm" style={{ color: 'var(--wo-text-muted)' }}>
        Set a new password for your account. You will stay signed in.
      </p>
      <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
        <div>
          <Label>New password</Label>
          <input
            type="password"
            className="wo-input w-full mt-1"
            placeholder="At least 8 characters"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <div>
          <Label>Confirm new password</Label>
          <input
            type="password"
            className="wo-input w-full mt-1"
            placeholder="Repeat new password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        {message && (
          <p className="text-sm" style={{ color: message.type === 'ok' ? '#22c55e' : '#ef4444' }}>{message.text}</p>
        )}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={loading} className="wo-btn wo-btn-primary disabled:opacity-50">
            {loading ? 'Updating…' : 'Change password'}
          </button>
          <a href="/auth/forgot-password" className="text-xs" style={{ color: 'var(--wo-primary)' }}>Forgot password?</a>
        </div>
      </form>
    </div>
  );
}

// ─── CompanySettings ───────────────────────────────────────────────────────────
function CompanySettings() {
  const [tab, setTab] = useState<'about' | 'icp' | 'triggers'>('about');
  const [orgName, setOrgName] = useState('');
  const [profile, setProfile] = useState<OrgProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState('');

  // New custom trigger form state
  const [newTriggerCategory, setNewTriggerCategory] = useState('CXO Hiring');
  const [newTriggerDesc, setNewTriggerDesc] = useState('');

  // Multi-URL input state
  const [newUrlInput, setNewUrlInput] = useState('');

  // Custom persona (ICP tab)
  const [newPersonaInput, setNewPersonaInput] = useState('');
  // Custom industry (About Us) — multi-select stores comma-separated in profile.industry
  const [industryCustomInput, setIndustryCustomInput] = useState('');

  useEffect(() => {
    fetch('/api/settings/org')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setOrgName(data.name ?? '');
          const p = data.profile ?? {};
          // Migrate legacy website_url into website_urls array
          const urls: string[] = Array.isArray(p.website_urls) ? p.website_urls : [];
          if (p.website_url && !urls.includes(p.website_url)) urls.unshift(p.website_url);
          setProfile(prev => ({ ...EMPTY_PROFILE, ...p, website_urls: urls }));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function generateFromUrl() {
    const primaryUrl = (profile.website_urls ?? [])[0] ?? profile.website_url;
    if (!primaryUrl?.trim()) return;
    setGenerating(true);
    setMsg('');
    try {
      // Retry up to 3 times to handle transient auth/server hiccups
      let res: Response | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        res = await fetch('/api/settings/generate-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            website_url: primaryUrl,
            website_urls: profile.website_urls ?? [primaryUrl],
          }),
        });
        if (res.status !== 401 && res.status !== 500) break;
        if (attempt < 3) await new Promise(r => setTimeout(r, 800 * attempt));
      }
      if (!res!.ok) {
        let errMsg = 'Generation failed';
        try {
          const err = await res!.json();
          errMsg = err.error ?? errMsg;
        } catch { /* non-JSON response */ }
        // Give clearer guidance based on error type
        if (res!.status === 401) {
          throw new Error('Session expired — please refresh the page and try again.');
        }
        if (errMsg.toLowerCase().includes('api key') || errMsg.toLowerCase().includes('key configured')) {
          throw new Error(`${errMsg} (check ANTHROPIC_API_KEY / OPENAI_API_KEY in your .env)`);
        }
        throw new Error(errMsg);
      }
      const data = await res!.json();
      setProfile(prev => ({
        ...prev,
        industry: data.industry ?? prev.industry,
        description: data.description ?? prev.description,
        services: data.services?.length ? data.services : prev.services,
        target_personas: data.target_personas?.length ? data.target_personas : prev.target_personas,
        target_industry: data.target_industry?.length ? data.target_industry : prev.target_industry,
        sales_triggers: data.sales_triggers?.length
          ? data.sales_triggers.map((t: { category: string; description: string }, i: number) => ({
              id: `ai-${Date.now()}-${i}`,
              category: t.category,
              description: t.description,
              is_custom: false,
            }))
          : prev.sales_triggers,
      }));
      setMsg('Profile generated from your website! Review and click Save.');
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Unknown error';
      setMsg(`Failed to generate: ${errMsg}`);
    } finally {
      setGenerating(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    setMsg('');
    try {
      // Keep website_url in sync with first element of website_urls for backward-compat
      const urls = profile.website_urls ?? [];
      const profileToSave = { ...profile, website_url: urls[0] ?? '', website_urls: urls };
      const payload = JSON.stringify({ name: orgName, profile: profileToSave });

      // Retry up to 3 times to handle transient auth 401s
      let res: Response | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        res = await fetch('/api/settings/org', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        });
        if (res.status !== 401 && res.status !== 500) break;
        if (attempt < 3) await new Promise(r => setTimeout(r, 700 * attempt));
      }
      setMsg(res!.ok ? 'Saved successfully!' : 'Failed to save. Please try again.');
    } catch {
      setMsg('Failed to save. Please try again.');
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 3500);
    }
  }

  function toggleChip(field: keyof OrgProfile, value: string) {
    setProfile(prev => {
      const arr = (prev[field] as string[]) ?? [];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value],
      };
    });
  }

  function addCustomTrigger() {
    if (!newTriggerDesc.trim()) return;
    const trigger: SalesTrigger = {
      id: `custom-${Date.now()}`,
      category: newTriggerCategory,
      description: newTriggerDesc.trim(),
      is_custom: true,
    };
    setProfile(prev => ({
      ...prev,
      sales_triggers: [...(prev.sales_triggers ?? []), trigger],
    }));
    setNewTriggerDesc('');
  }

  function removeTrigger(id: string) {
    setProfile(prev => ({
      ...prev,
      sales_triggers: (prev.sales_triggers ?? []).filter(t => t.id !== id),
    }));
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--wo-primary)' }} />
      </div>
    );
  }

  const subTabs = [
    { id: 'about', label: 'About Us' },
    { id: 'icp', label: 'Target Company Profile' },
    { id: 'triggers', label: 'Sales Trigger' },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold" style={{ color: 'var(--wo-text)' }}>Company Profile</h2>
        <span className="text-sm font-medium" style={{ color: 'var(--wo-primary)' }}>{orgName}</span>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--wo-surface-2)' }}>
        {subTabs.map(st => (
          <button
            key={st.id}
            onClick={() => setTab(st.id as 'about' | 'icp' | 'triggers')}
            className="flex-1 py-2 text-sm font-medium rounded-lg transition-all"
            style={tab === st.id ? {
              background: 'var(--wo-surface)',
              color: 'var(--wo-text)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            } : { color: 'var(--wo-text-muted)' }}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: About Us ── */}
      {tab === 'about' && (() => {
        const industryList: string[] = profile.industry
          ? (typeof profile.industry === 'string' ? profile.industry.split(',').map(s => s.trim()).filter(Boolean) : [])
          : [];
        return (
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--wo-text-muted)' }}>
            Describe your company so AI can tailor research, signals, and monitoring.
          </p>
          <div>
            <Label>Company Website URLs</Label>
            {/* Existing URLs as removable pills */}
            {(profile.website_urls ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {(profile.website_urls ?? []).map((url, i) => (
                  <span
                    key={url}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                    style={{
                      background: i === 0 ? 'rgba(0,217,255,0.12)' : 'var(--wo-surface)',
                      border: `1px solid ${i === 0 ? 'rgba(0,217,255,0.35)' : 'var(--wo-border)'}`,
                      color: i === 0 ? 'var(--wo-primary)' : 'var(--wo-text)',
                    }}
                  >
                    <Globe className="w-3 h-3 flex-shrink-0" />
                    <span className="max-w-[240px] truncate">{url}</span>
                    {i === 0 && (
                      <span className="text-[10px] opacity-60 ml-0.5">(primary)</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setProfile(p => ({
                        ...p,
                        website_urls: (p.website_urls ?? []).filter((_, idx) => idx !== i),
                      }))}
                      className="ml-0.5 hover:opacity-70 transition-opacity"
                      title="Remove URL"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {/* Add new URL */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--wo-text-muted)' }} />
                <input
                  type="url"
                  placeholder="https://spark.theaicompany.co"
                  value={newUrlInput}
                  onChange={e => setNewUrlInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newUrlInput.trim()) {
                      e.preventDefault();
                      const val = newUrlInput.trim();
                      if (!(profile.website_urls ?? []).includes(val)) {
                        setProfile(p => ({ ...p, website_urls: [...(p.website_urls ?? []), val] }));
                      }
                      setNewUrlInput('');
                    }
                  }}
                  className="wo-input pl-10 w-full"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const val = newUrlInput.trim();
                  if (!val) return;
                  if (!(profile.website_urls ?? []).includes(val)) {
                    setProfile(p => ({ ...p, website_urls: [...(p.website_urls ?? []), val] }));
                  }
                  setNewUrlInput('');
                }}
                disabled={!newUrlInput.trim()}
                className="wo-btn wo-btn-outline gap-1.5 flex-shrink-0 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
              <button
                onClick={generateFromUrl}
                disabled={generating || (profile.website_urls ?? []).length === 0}
                className="wo-btn wo-btn-outline gap-2 flex-shrink-0 disabled:opacity-50"
                title="Generate company profile from primary URL using AI"
              >
                {generating
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Sparkles className="w-4 h-4" style={{ color: 'var(--wo-primary)' }} />
                }
                {generating ? 'Generating...' : 'Generate'}
              </button>
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'var(--wo-text-muted)' }}>
              Add all your product/service URLs. The first (primary) URL is used for AI profile generation. Press Enter or click Add.
            </p>
          </div>

          <div>
            <Label>Industries</Label>
            <p className="text-xs mb-2" style={{ color: 'var(--wo-text-muted)' }}>
              Industries your company operates in (select all that apply)
            </p>
            <div className="flex flex-wrap gap-2 mb-2">
              {INDUSTRY_OPTIONS.map(opt => {
                const isSelected = industryList.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      const next = isSelected ? industryList.filter(i => i !== opt) : [...industryList, opt];
                      setProfile(p => ({ ...p, industry: next.length ? next.join(', ') : undefined }));
                    }}
                    className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
                    style={isSelected ? {
                      background: 'rgba(0,217,255,0.15)', color: 'var(--wo-primary)', border: '1px solid rgba(0,217,255,0.3)',
                    } : { background: 'var(--wo-surface-2)', color: 'var(--wo-text-muted)', border: '1px solid var(--wo-border)' }}
                  >
                    {isSelected && <Check className="w-3 h-3 inline mr-1 align-middle" />}
                    {opt}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="Add custom (e.g. Paints and Coatings) — Enter or + to add"
                value={industryCustomInput}
                onChange={e => setIndustryCustomInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const v = industryCustomInput.trim();
                    if (!v) return;
                    if (!industryList.includes(v)) setProfile(p => ({ ...p, industry: [...industryList, v].join(', ') }));
                    setIndustryCustomInput('');
                  }
                }}
                className="wo-input flex-1 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  const v = industryCustomInput.trim();
                  if (!v) return;
                  if (!industryList.includes(v)) setProfile(p => ({ ...p, industry: [...industryList, v].join(', ') }));
                  setIndustryCustomInput('');
                }}
                disabled={!industryCustomInput.trim()}
                className="wo-btn wo-btn-outline px-3 disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {/* Show custom industries as removable chips when not in preset list */}
            {industryList.filter(i => !INDUSTRY_OPTIONS.includes(i)).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {industryList.filter(i => !INDUSTRY_OPTIONS.includes(i)).map(i => (
                  <span key={i} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(139,92,246,0.12)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}>
                    {i}
                    <button type="button" onClick={() => { const next = industryList.filter(x => x !== i); setProfile(p => ({ ...p, industry: next.length ? next.join(', ') : undefined })); }} className="ml-0.5 hover:opacity-70"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>About my company</Label>
            <textarea
              placeholder="AI-generated or manually written description of your company, core services, target market, and key differentiators..."
              value={profile.description ?? ''}
              onChange={e => setProfile(p => ({ ...p, description: e.target.value }))}
              rows={5}
              className="wo-input w-full resize-none"
            />
          </div>

          <div>
            <Label>Services</Label>
            <p className="text-xs mb-2" style={{ color: 'var(--wo-text-muted)' }}>
              Add the specific capabilities your company sells
            </p>
            <EditableChips
              chips={profile.services ?? []}
              onChange={chips => setProfile(p => ({ ...p, services: chips }))}
              placeholder="e.g. GenAI Platform Development"
            />
          </div>

          <div>
            <Label>Client Names</Label>
            <p className="text-xs mb-2" style={{ color: 'var(--wo-text-muted)' }}>
              Add notable clients to personalize signal analysis
            </p>
            <EditableChips
              chips={profile.client_names ?? []}
              onChange={chips => setProfile(p => ({ ...p, client_names: chips }))}
              placeholder="e.g. Godrej, Hindustan Unilever"
            />
          </div>
        </div>
        );
      })()}

      {/* ── Tab 2: Target Company Profile ── */}
      {tab === 'icp' && (
        <div className="flex flex-col gap-5">
          <p className="text-sm" style={{ color: 'var(--wo-text-muted)' }}>
            Define who your ideal customers are so research and signals can be tailored.
          </p>

          <div>
            <Label>Client Geography</Label>
            <p className="text-xs mb-1" style={{ color: 'var(--wo-text-muted)' }}>
              Geographies where your target clients are based
            </p>
            <ChipSelector
              options={GEOGRAPHY_OPTIONS}
              selected={profile.target_geography ?? []}
              onToggle={v => toggleChip('target_geography', v)}
            />
          </div>

          <div>
            <Label>Client Industry</Label>
            <p className="text-xs mb-1" style={{ color: 'var(--wo-text-muted)' }}>
              Industries you primarily sell into
            </p>
            <ChipSelector
              options={INDUSTRY_OPTIONS}
              selected={profile.target_industry ?? []}
              onToggle={v => toggleChip('target_industry', v)}
            />
          </div>

          <div>
            <Label>Target Personas</Label>
            <p className="text-xs mb-1" style={{ color: 'var(--wo-text-muted)' }}>
              Job titles you typically target as buyers (used in research and Monitoring Rules)
            </p>
            <ChipSelector
              options={PERSONA_OPTIONS}
              selected={profile.target_personas ?? []}
              onToggle={v => toggleChip('target_personas', v)}
            />
            {/* Custom personas not in the preset list */}
            {(profile.target_personas ?? []).filter(p => !PERSONA_OPTIONS.includes(p)).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(profile.target_personas ?? []).filter(p => !PERSONA_OPTIONS.includes(p)).map(p => (
                  <span
                    key={p}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(139,92,246,0.12)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}
                  >
                    {p}
                    <button type="button" onClick={() => setProfile(prev => ({ ...prev, target_personas: (prev.target_personas ?? []).filter(x => x !== p) }))} className="ml-0.5 hover:opacity-70">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                placeholder="Add another role (e.g. VP Sales)"
                value={newPersonaInput}
                onChange={e => setNewPersonaInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const v = newPersonaInput.trim(); if (v && !(profile.target_personas ?? []).includes(v)) setProfile(p => ({ ...p, target_personas: [...(p.target_personas ?? []), v] })); setNewPersonaInput(''); } }}
                className="wo-input flex-1 text-sm"
              />
              <button
                type="button"
                onClick={() => { const v = newPersonaInput.trim(); if (v && !(profile.target_personas ?? []).includes(v)) setProfile(p => ({ ...p, target_personas: [...(p.target_personas ?? []), v] })); setNewPersonaInput(''); }}
                disabled={!newPersonaInput.trim()}
                className="wo-btn wo-btn-outline gap-1 disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>

          <div>
            <Label>Client Segment</Label>
            <p className="text-xs mb-1" style={{ color: 'var(--wo-text-muted)' }}>
              Company sizes that fit your ideal customer profile
            </p>
            <ChipSelector
              options={SEGMENT_OPTIONS}
              selected={profile.target_segment ?? []}
              onToggle={v => toggleChip('target_segment', v)}
            />
          </div>
        </div>
      )}

      {/* ── Tab 3: Sales Trigger ── */}
      {tab === 'triggers' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm" style={{ color: 'var(--wo-text-muted)' }}>
                {(profile.sales_triggers ?? []).length} trigger{(profile.sales_triggers ?? []).length !== 1 ? 's' : ''} configured
              </p>
            </div>
            {(profile.website_urls ?? []).length > 0 && (
              <button
                onClick={generateFromUrl}
                disabled={generating}
                className="wo-btn wo-btn-outline text-xs gap-1.5"
              >
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Re-generate AI Triggers
              </button>
            )}
          </div>

          {/* Trigger list */}
          {(profile.sales_triggers ?? []).length === 0 ? (
            <div
              className="text-center py-8 rounded-xl border-2 border-dashed"
              style={{ borderColor: 'var(--wo-border)', color: 'var(--wo-text-muted)' }}
            >
              <Sparkles className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--wo-border)' }} />
              <p className="text-sm">No triggers yet.</p>
              <p className="text-xs mt-1">Add your company website in &ldquo;About Us&rdquo; and click &ldquo;Generate from URL&rdquo;.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(profile.sales_triggers ?? []).map(trigger => (
                <div
                  key={trigger.id}
                  className="wo-card p-3 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                        style={{
                          background: trigger.is_custom ? 'rgba(139,92,246,0.15)' : 'rgba(0,217,255,0.12)',
                          color: trigger.is_custom ? '#a78bfa' : 'var(--wo-primary)',
                        }}
                      >
                        {trigger.category}
                      </span>
                      {trigger.is_custom && (
                        <span className="text-xs" style={{ color: 'var(--wo-text-muted)' }}>Custom</span>
                      )}
                    </div>
                    <p className="text-sm" style={{ color: 'var(--wo-text)' }}>{trigger.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTrigger(trigger.id)}
                    className="flex-shrink-0 p-1 rounded transition-colors"
                    style={{ color: 'var(--wo-text-muted)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--wo-text-muted)'; }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add custom trigger */}
          <div className="wo-card p-4 flex flex-col gap-3">
            <p className="text-sm font-medium" style={{ color: 'var(--wo-text)' }}>Add Custom Trigger</p>
            <p className="text-xs" style={{ color: 'var(--wo-text-muted)' }}>Choose a category, then describe when this trigger applies.</p>
            <div className="flex flex-wrap gap-2">
              {TRIGGER_CATEGORIES.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewTriggerCategory(c)}
                  className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
                  style={newTriggerCategory === c ? {
                    background: 'rgba(0,217,255,0.15)', color: 'var(--wo-primary)', border: '1px solid rgba(0,217,255,0.3)',
                  } : { background: 'var(--wo-surface-2)', color: 'var(--wo-text-muted)', border: '1px solid var(--wo-border)' }}
                >
                  {newTriggerCategory === c ? <Check className="w-3 h-3 inline mr-1 align-middle" /> : null}
                  {c}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTriggerDesc}
                onChange={e => setNewTriggerDesc(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTrigger(); } }}
                placeholder="Describe when this trigger applies..."
                className="wo-input flex-1 text-sm"
              />
              <button
                type="button"
                onClick={addCustomTrigger}
                disabled={!newTriggerDesc.trim()}
                className="wo-btn wo-btn-primary px-4 gap-1.5 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save button + status */}
      <StatusMsg msg={msg} />
      <div className="pt-1">
        <button onClick={saveProfile} disabled={saving} className="wo-btn wo-btn-primary gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}

// ─── UserSettings ──────────────────────────────────────────────────────────────
function UserSettings() {
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>('member');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);
  const [confirmTransfer, setConfirmTransfer] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);

  function loadMembers() {
    return fetch('/api/settings/members')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && typeof data === 'object' && Array.isArray(data.members)) {
          setMembers(data.members);
          setCurrentUserRole(typeof data.current_user_role === 'string' ? data.current_user_role : 'member');
          setCurrentUserId(data.current_user_id ?? null);
        } else if (Array.isArray(data)) {
          setMembers(data);
        }
      });
  }

  useEffect(() => {
    loadMembers().then(() => setLoading(false)).catch(() => setLoading(false));
  }, []);

  const canInvite = currentUserRole === 'owner' || currentUserRole === 'admin';
  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin';
  const isOwner = currentUserRole === 'owner';

  async function handleSendInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setInviteSending(true);
    setInviteMsg(null);
    try {
      const res = await fetch('/api/settings/members/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: inviteRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setInviteMsg({ type: 'ok', text: 'Invite sent. They can sign in or sign up and open the link from the email.' });
        setInviteEmail('');
        setShowInviteModal(false);
        loadMembers();
      } else {
        setInviteMsg({ type: 'err', text: (data.error as string) ?? 'Failed to send invite' });
      }
    } catch {
      setInviteMsg({ type: 'err', text: 'Network error' });
    } finally {
      setInviteSending(false);
    }
  }

  async function handleChangeRole(m: Member, newRole: 'admin' | 'member') {
    if (!canManage || m.user_id === currentUserId || m.role === 'owner') return;
    if (currentUserRole === 'admin' && m.role === 'admin') return;
    setBusy(true);
    setActionMsg(null);
    try {
      const res = await fetch('/api/settings/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: m.user_id, role: newRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setActionMsg({ type: 'ok', text: `Role updated to ${newRole}.` });
        loadMembers();
      } else {
        setActionMsg({ type: 'err', text: (data.error as string) ?? 'Failed to update role' });
      }
    } catch {
      setActionMsg({ type: 'err', text: 'Network error' });
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(m: Member) {
    if (!canManage || m.user_id === currentUserId || m.role === 'owner') return;
    setConfirmRemove(null);
    setBusy(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/settings/members?user_id=${encodeURIComponent(m.user_id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setActionMsg({ type: 'ok', text: `${m.email || m.name} removed from team.` });
        loadMembers();
      } else {
        setActionMsg({ type: 'err', text: (data.error as string) ?? 'Failed to remove' });
      }
    } catch {
      setActionMsg({ type: 'err', text: 'Network error' });
    } finally {
      setBusy(false);
    }
  }

  async function handleTransfer(m: Member) {
    if (!isOwner || m.role === 'owner' || m.user_id === currentUserId) return;
    setConfirmTransfer(null);
    setBusy(true);
    setActionMsg(null);
    try {
      const res = await fetch('/api/settings/members/transfer-ownership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_owner_user_id: m.user_id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setActionMsg({ type: 'ok', text: 'Ownership transferred. You are now Admin.' });
        loadMembers();
      } else {
        setActionMsg({ type: 'err', text: (data.error as string) ?? 'Failed to transfer' });
      }
    } catch {
      setActionMsg({ type: 'err', text: 'Network error' });
    } finally {
      setBusy(false);
    }
  }

  async function handleSendPasswordReset(m: Member) {
    if (!canManage || !m.email) return;
    setBusy(true);
    setActionMsg(null);
    try {
      const res = await fetch('/api/settings/members/send-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: m.email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setActionMsg({ type: 'ok', text: `Password reset email sent to ${m.email}.` });
      } else {
        setActionMsg({ type: 'err', text: (data.error as string) ?? 'Failed to send' });
      }
    } catch {
      setActionMsg({ type: 'err', text: 'Network error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold" style={{ color: 'var(--wo-text)' }}>Team Members</h2>
        <div className="flex items-center gap-2">
          <span
            className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{ background: 'rgba(0,217,255,0.1)', color: 'var(--wo-primary)' }}
          >
            {members.length} member{members.length !== 1 ? 's' : ''}
          </span>
          {canInvite && (
            <button
              type="button"
              onClick={() => { setShowInviteModal(true); setInviteMsg(null); setInviteEmail(''); setInviteRole('member'); }}
              className="wo-btn wo-btn-primary text-xs gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Invite member
            </button>
          )}
        </div>
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="wo-card p-6 max-w-md w-full flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold" style={{ color: 'var(--wo-text)' }}>Invite team member</h3>
              <button type="button" onClick={() => setShowInviteModal(false)} className="p-1 rounded" style={{ color: 'var(--wo-text-muted)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <Label>Email</Label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="wo-input w-full mt-1"
              />
            </div>
            <div>
              <Label>Role</Label>
              <div className="flex gap-2 mt-2">
                {(['member', 'admin'] as const).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setInviteRole(r)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium capitalize"
                    style={inviteRole === r ? { background: 'rgba(0,217,255,0.15)', color: 'var(--wo-primary)', border: '1px solid rgba(0,217,255,0.3)' } : { background: 'var(--wo-surface-2)', color: 'var(--wo-text-muted)', border: '1px solid var(--wo-border)' }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            {inviteMsg && (
              <p className="text-sm" style={{ color: inviteMsg.type === 'ok' ? '#22c55e' : '#ef4444' }}>{inviteMsg.text}</p>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setShowInviteModal(false)} className="wo-btn wo-btn-outline">Cancel</button>
              <button type="button" onClick={handleSendInvite} disabled={inviteSending || !inviteEmail.trim()} className="wo-btn wo-btn-primary disabled:opacity-50">
                {inviteSending ? 'Sending…' : 'Send invite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--wo-primary)' }} />
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-10" style={{ color: 'var(--wo-text-muted)' }}>
          <Users className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--wo-border)' }} />
          <p className="text-sm">No members found.</p>
        </div>
      ) : (
        <div className="wo-card overflow-hidden">
          <table className="wo-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                {canManage && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map(m => {
                const isSelf = m.user_id === currentUserId;
                const canChangeRole = canManage && !isSelf && m.role !== 'owner' && (currentUserRole === 'owner' || (currentUserRole === 'admin' && m.role !== 'admin'));
                const canRemove = canManage && !isSelf && m.role !== 'owner' && (currentUserRole === 'owner' || (currentUserRole === 'admin' && m.role !== 'admin'));
                const canTransfer = isOwner && !isSelf && m.role !== 'owner';
                return (
                  <tr key={m.user_id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: 'rgba(0,217,255,0.12)', color: 'var(--wo-primary)' }}
                        >
                          {m.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-sm" style={{ color: 'var(--wo-text)' }}>{m.name}</span>
                      </div>
                    </td>
                    <td className="text-sm" style={{ color: 'var(--wo-text-muted)' }}>{m.email}</td>
                    <td>
                      {canChangeRole ? (
                        <select
                          value={m.role}
                          onChange={e => handleChangeRole(m, e.target.value as 'admin' | 'member')}
                          disabled={busy}
                          className="text-xs px-2 py-1 rounded border bg-transparent"
                          style={{ borderColor: 'var(--wo-border)', color: 'var(--wo-text)' }}
                        >
                          <option value="member">member</option>
                          <option value="admin">admin</option>
                        </select>
                      ) : (
                        <span
                          className={`wo-tag ${
                            m.role === 'owner' ? 'wo-tag-orange' : m.role === 'admin' ? 'wo-tag-purple' : 'wo-tag-blue'
                          }`}
                        >
                          {m.role === 'owner' ? 'Owner' : m.role}
                        </span>
                      )}
                    </td>
                    <td className="text-sm" style={{ color: 'var(--wo-text-muted)' }}>
                      {new Date(m.joined).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    {canManage && (
                      <td>
                        <div className="flex flex-wrap items-center gap-2">
                          {canTransfer && (
                            <button
                              type="button"
                              onClick={() => setConfirmTransfer(m)}
                              disabled={busy}
                              className="text-xs px-2 py-1 rounded border border-amber-500/50 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                            >
                              Transfer owner
                            </button>
                          )}
                          {canRemove && (
                            <button
                              type="button"
                              onClick={() => setConfirmRemove(m)}
                              disabled={busy}
                              className="text-xs px-2 py-1 rounded border border-red-500/50 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                            >
                              Remove
                            </button>
                          )}
                          {canManage && m.email && (isSelf ? (
                            <a href="/settings" className="text-xs hover:underline" style={{ color: 'var(--wo-primary)' }}>Change password → My Account</a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSendPasswordReset(m)}
                              disabled={busy}
                              className="text-xs px-2 py-1 rounded border border-transparent hover:underline"
                              style={{ color: 'var(--wo-primary)' }}
                            >
                              Send password reset
                            </button>
                          ))}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {actionMsg && (
        <p className="text-sm" style={{ color: actionMsg.type === 'ok' ? '#22c55e' : '#ef4444' }}>{actionMsg.text}</p>
      )}

      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="wo-card p-6 max-w-md w-full flex flex-col gap-4">
            <h3 className="text-base font-semibold" style={{ color: 'var(--wo-text)' }}>Remove member</h3>
            <p className="text-sm" style={{ color: 'var(--wo-text-muted)' }}>
              Remove <strong>{confirmRemove.name}</strong> ({confirmRemove.email}) from the team? They will lose access to this organization.
            </p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setConfirmRemove(null)} className="wo-btn wo-btn-outline">Cancel</button>
              <button type="button" onClick={() => handleRemove(confirmRemove)} disabled={busy} className="wo-btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">Remove</button>
            </div>
          </div>
        </div>
      )}

      {confirmTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="wo-card p-6 max-w-md w-full flex flex-col gap-4">
            <h3 className="text-base font-semibold" style={{ color: 'var(--wo-text)' }}>Transfer ownership</h3>
            <p className="text-sm" style={{ color: 'var(--wo-text-muted)' }}>
              Make <strong>{confirmTransfer.name}</strong> ({confirmTransfer.email}) the organization owner? You will become an Admin. This cannot be undone from here.
            </p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setConfirmTransfer(null)} className="wo-btn wo-btn-outline">Cancel</button>
              <button type="button" onClick={() => handleTransfer(confirmTransfer)} disabled={busy} className="wo-btn wo-btn-primary disabled:opacity-50">Transfer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MonitoringSettings ────────────────────────────────────────────────────────
const ALL_SIGNAL_TYPES = [
  'Funding', 'Expansion', 'Leadership', 'Tech Adoption',
  'M&A', 'Regulatory', 'Challenges', 'Business Initiatives',
];
const ALL_INDUSTRIES = [
  'FMCG', 'Banking', 'Healthcare', 'Retail', 'Manufacturing',
  'Technology', 'E-commerce', 'Automotive', 'Telecom', 'Education',
  'Insurance', 'Pharma', 'Logistics', 'Media', 'Financial Services',
  'Real Estate', 'Energy', 'Government',
];
const ALL_PERSONAS = [
  'CIO', 'CTO', 'CEO', 'CMO', 'CDO', 'MD', 'CFO', 'CISO',
  'VP Technology', 'Head of IT', 'Head of Digital', 'Director of Operations',
  'DGM IT', 'DofDT', 'VP Engineering', 'Chief Digital Officer',
];

/** Editable chip list: existing chips + free-text add input. */
function ChipList({
  label, hint, chips, onAdd, onRemove, suggestions = [],
}: {
  label: string;
  hint?: string;
  chips: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  suggestions?: string[];
}) {
  const [input, setInput] = useState('');

  function commit(val: string) {
    const v = val.trim();
    if (!v || chips.includes(v)) return;
    onAdd(v);
    setInput('');
  }

  return (
    <div>
      <Label>{label}</Label>
      {hint && <p className="text-xs mb-2" style={{ color: 'var(--wo-text-muted)' }}>{hint}</p>}

      {/* Existing chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {chips.map(chip => (
            <span
              key={chip}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: 'rgba(0,217,255,0.10)', border: '1px solid rgba(0,217,255,0.30)', color: 'var(--wo-primary)' }}
            >
              {chip}
              <button type="button" onClick={() => onRemove(chip)} className="hover:opacity-70 ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Suggestion pills (not yet added) */}
      {suggestions.filter(s => !chips.includes(s)).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {suggestions.filter(s => !chips.includes(s)).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => onAdd(s)}
              className="px-2.5 py-1 rounded-full text-xs transition-all hover:opacity-80"
              style={{ background: 'var(--wo-surface)', border: '1px solid var(--wo-border)', color: 'var(--wo-text-muted)' }}
            >
              + {s}
            </button>
          ))}
        </div>
      )}

      {/* Free-text add */}
      <div className="flex gap-2">
        <input
          type="text"
          className="wo-input text-sm py-1.5"
          placeholder={`Add ${label.toLowerCase()}…`}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(input); } }}
        />
        <button
          type="button"
          onClick={() => commit(input)}
          disabled={!input.trim()}
          className="wo-btn wo-btn-outline text-xs gap-1 disabled:opacity-40 flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
    </div>
  );
}

function MonitoringSettings() {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [personas, setPersonas] = useState<string[]>([]);
  const [signalTypes, setSignalTypes] = useState<string[]>([...ALL_SIGNAL_TYPES]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/settings/org')
      .then(r => r.json())
      .then(data => {
        const m = (data.org_settings as Record<string, unknown>)?.monitoring as Record<string, unknown> | undefined;
        if (m) {
          // Support both old string format and new array format
          const kw = m.keywords;
          setKeywords(Array.isArray(kw) ? kw as string[] : typeof kw === 'string' && kw ? kw.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
          const ind = m.industries;
          setIndustries(Array.isArray(ind) ? ind as string[] : typeof ind === 'string' && ind ? ind.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
          const per = m.personas;
          setPersonas(Array.isArray(per) ? per as string[] : []);
          setSignalTypes((m.signal_types as string[]) ?? ALL_SIGNAL_TYPES);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setMsg(null);
    try {
      let res: Response | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        res = await fetch('/api/settings/generate-monitoring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ existing_keywords: keywords, existing_industries: industries, existing_personas: personas }),
        });
        if (res.status !== 401 && res.status !== 500) break;
        if (attempt < 3) await new Promise(r => setTimeout(r, 800 * attempt));
      }
      if (!res!.ok) {
        const err = await res!.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'Generation failed');
      }
      const data = await res!.json() as { keywords: string[]; industries: string[]; personas: string[]; signal_types: string[] };
      // Merge: add new suggestions without removing what user already has
      setKeywords(prev => [...new Set([...prev, ...data.keywords])]);
      setIndustries(prev => [...new Set([...prev, ...data.industries])]);
      setPersonas(prev => [...new Set([...prev, ...(data.personas ?? [])])]);
      setSignalTypes(data.signal_types?.length ? data.signal_types : ALL_SIGNAL_TYPES);
      setMsg({ type: 'ok', text: 'AI suggestions added! Review and remove any that don\'t apply, then Save.' });
      setTimeout(() => setMsg(null), 5000);
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Generation failed' });
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      const getRes = await fetch('/api/settings/org');
      const existing = await getRes.json();
      const currentSettings = (existing.org_settings as Record<string, unknown>) ?? {};
      const payload = JSON.stringify({
        org_settings: {
          ...currentSettings,
            monitoring: { keywords, industries, personas, signal_types: signalTypes },
        },
      });
      let res: Response | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        res = await fetch('/api/settings/org', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        });
        if (res.status !== 401 && res.status !== 500) break;
        if (attempt < 3) await new Promise(r => setTimeout(r, 700 * attempt));
      }
      if (!res!.ok) {
        const err = await res!.json().catch(() => ({}));
        setMsg({ type: 'err', text: (err as { error?: string }).error ?? 'Failed to save' });
      } else {
        setMsg({ type: 'ok', text: 'Monitoring rules saved!' });
        setTimeout(() => setMsg(null), 3000);
      }
    } catch {
      setMsg({ type: 'err', text: 'Network error — please try again' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm py-8 text-center" style={{ color: 'var(--wo-text-muted)' }}>Loading…</div>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--wo-text)' }}>Monitoring Rules</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--wo-text-muted)' }}>
            Tell Vigil what to watch for when scanning for buying signals.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="wo-btn wo-btn-outline gap-2 flex-shrink-0 disabled:opacity-50"
          title="Generate monitoring rules from your company profile"
        >
          {generating
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Sparkles className="w-4 h-4" style={{ color: 'var(--wo-primary)' }} />}
          {generating ? 'Generating…' : 'Generate with AI'}
        </button>
      </div>

      <div className="wo-card p-5 flex flex-col gap-6">
        {/* Keywords */}
        <ChipList
          label="Keywords"
          hint="Terms Vigil will look for in news articles — company names, technologies, business events."
          chips={keywords}
          onAdd={v => setKeywords(prev => [...new Set([...prev, v])])}
          onRemove={v => setKeywords(prev => prev.filter(k => k !== v))}
        />

        {/* Industries */}
        <ChipList
          label="Industries"
          hint="Industries to focus on when searching for signals."
          chips={industries}
          onAdd={v => setIndustries(prev => [...new Set([...prev, v])])}
          onRemove={v => setIndustries(prev => prev.filter(i => i !== v))}
          suggestions={ALL_INDUSTRIES}
        />

        {/* Personas */}
        <ChipList
          label="Target Personas"
          hint="Job titles Vigil should watch for in leadership change signals — new appointments of these roles are high-value triggers."
          chips={personas}
          onAdd={v => setPersonas(prev => [...new Set([...prev, v])])}
          onRemove={v => setPersonas(prev => prev.filter(p => p !== v))}
          suggestions={ALL_PERSONAS}
        />

        {/* Signal Types */}
        <div>
          <Label>Signal Types</Label>
          <p className="text-xs mb-2" style={{ color: 'var(--wo-text-muted)' }}>
            Types of buying signals Vigil should capture and save.
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_SIGNAL_TYPES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setSignalTypes(prev =>
                  prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
                )}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{
                  background: signalTypes.includes(t) ? 'rgba(0,217,255,0.12)' : 'var(--wo-surface)',
                  border: `1px solid ${signalTypes.includes(t) ? 'rgba(0,217,255,0.35)' : 'var(--wo-border)'}`,
                  color: signalTypes.includes(t) ? 'var(--wo-primary)' : 'var(--wo-text-muted)',
                }}
              >
                {signalTypes.includes(t) ? '✓ ' : ''}{t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {msg && (
        <p
          className="text-sm rounded-lg px-3 py-2"
          style={{
            background: msg.type === 'ok' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            color: msg.type === 'ok' ? '#22c55e' : '#ef4444',
            border: `1px solid ${msg.type === 'ok' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}
        >
          {msg.text}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button onClick={handleSave} disabled={saving} className="wo-btn wo-btn-primary gap-2">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save Rules'}
        </button>
        <span className="text-xs" style={{ color: 'var(--wo-text-muted)' }}>
          {keywords.length} keywords · {industries.length} industries · {personas.length} personas · {signalTypes.length} signal types
        </span>
      </div>
    </div>
  );
}

// ─── NotificationSettings ──────────────────────────────────────────────────────
const NOTIFICATION_KEYS = [
  { key: 'newSignals' as const, label: 'New signals detected', desc: 'Get notified when new signals match your triggers' },
  { key: 'signalScores' as const, label: 'Signal score updates', desc: 'Notifications when signal scores change significantly' },
  { key: 'opportunityStages' as const, label: 'Opportunity stage changes', desc: 'Track when opportunities move between pipeline stages' },
  { key: 'weeklyDigest' as const, label: 'Weekly digest', desc: 'Receive a weekly summary of all activity' },
];

function NotificationSettings() {
  const [prefs, setPrefs] = useState({
    newSignals: true,
    signalScores: true,
    opportunityStages: true,
    weeklyDigest: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/settings/org')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const os = (data?.org_settings as Record<string, unknown>) ?? {};
        const n = os.notification as Record<string, boolean> | undefined;
        if (n && typeof n === 'object') {
          setPrefs({
            newSignals: n.newSignals !== false,
            signalScores: n.signalScores !== false,
            opportunityStages: n.opportunityStages !== false,
            weeklyDigest: n.weeklyDigest !== false,
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      const getRes = await fetch('/api/settings/org');
      const existing = await getRes.json();
      const currentSettings = (existing.org_settings as Record<string, unknown>) ?? {};
      const payload = JSON.stringify({
        org_settings: {
          ...currentSettings,
          notification: prefs,
        },
      });
      let res: Response | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        res = await fetch('/api/settings/org', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        });
        if (res.status !== 401 && res.status !== 500) break;
        if (attempt < 3) await new Promise((r) => setTimeout(r, 700 * attempt));
      }
      if (!res?.ok) {
        const err = await res?.json().catch(() => ({}));
        setMsg({ type: 'err', text: (err as { error?: string }).error ?? 'Failed to save' });
      } else {
        setMsg({ type: 'ok', text: 'Preferences saved!' });
        setTimeout(() => setMsg(null), 3000);
      }
    } catch {
      setMsg({ type: 'err', text: 'Network error — please try again' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--wo-primary)' }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-bold" style={{ color: 'var(--wo-text)' }}>Notification Preferences</h2>

      <div className="wo-card p-5 flex flex-col gap-4">
        {NOTIFICATION_KEYS.map(({ key, label, desc }) => (
          <NotifRow
            key={key}
            label={label}
            desc={desc}
            checked={prefs[key]}
            onChange={(on) => setPrefs((p) => ({ ...p, [key]: on }))}
          />
        ))}
      </div>

      {msg && (
        <p className="text-sm" style={{ color: msg.type === 'ok' ? '#22c55e' : '#ef4444' }}>{msg.text}</p>
      )}
      <div className="pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="wo-btn wo-btn-primary disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
}

// ─── BillingSettings ───────────────────────────────────────────────────────────
function BillingSettings() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [promoMsg, setPromoMsg] = useState('');

  interface Plan {
    id: string;
    name: string;
    formatted_amount: string;
    description: string;
    highlights: string[];
    features: { signals: number; agent_runs: number; documents: number; seats: number };
  }

  interface OrgInfo {
    subscription_tier: string;
    subscription_status: string;
    trial_ends_at?: string;
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/billing/plans').then((r) => r.json()),
    ]).then(([plansData]) => {
      setPlans(plansData);
      setLoading(false);
    });
  }, []);

  async function subscribe(planId: string) {
    setSubscribing(planId);
    setPromoMsg('');
    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, promo_code: promoCode || undefined }),
      });
      const data = await res.json();

      if (data.dummy || data.success) {
        setPromoMsg('Subscription activated! (Demo mode)');
        return;
      }

      if (data.subscription_id && data.key && typeof window !== 'undefined') {
        const rzp = new (window as typeof window & { Razorpay: new (options: object) => { open(): void } }).Razorpay({
          key: data.key,
          subscription_id: data.subscription_id,
          name: 'Vani',
          description: `${planId} plan subscription`,
          handler: () => setPromoMsg('Payment successful! Your plan will activate shortly.'),
        });
        rzp.open();
      }
    } catch {
      setPromoMsg('Subscription failed. Please try again.');
    } finally {
      setSubscribing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--wo-primary)' }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-bold" style={{ color: 'var(--wo-text)' }}>Billing & Plans</h2>

      {/* Current Plan Banner */}
      <div className="wo-card p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--wo-text)' }}>
            Current Plan:{' '}
            <span style={{ color: 'var(--wo-primary)' }} className="capitalize">
              {org?.subscription_tier ?? 'Starter Trial'}
            </span>
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--wo-text-muted)' }}>
            Status: {org?.subscription_status ?? 'Trial'}
            {org?.trial_ends_at && ` · Trial ends ${new Date(org.trial_ends_at).toLocaleDateString()}`}
          </p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: 'rgba(0,217,255,0.1)', color: 'var(--wo-primary)' }}>
          Active
        </span>
      </div>

      {/* Promo Code */}
      <div>
        <Label>Promo Code</Label>
        <div className="flex gap-2">
          <input
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            placeholder="BETA50, LAUNCH100, EARLYBIRD"
            className="wo-input flex-1"
          />
          <button
            onClick={() => setPromoMsg('Code will be applied on subscription')}
            className="wo-btn wo-btn-outline"
          >
            Apply
          </button>
        </div>
        {promoMsg && (
          <p className="text-xs mt-1.5" style={{ color: promoMsg.includes('fail') ? '#f87171' : '#34d399' }}>
            {promoMsg}
          </p>
        )}
        <p className="text-xs mt-1" style={{ color: 'var(--wo-text-muted)' }}>
          Try: BETA50 (50% off), LAUNCH100 (100% off), EARLYBIRD (₹500 off)
        </p>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 gap-4">
        {plans.map((plan) => (
          <div key={plan.id} className="wo-card p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold" style={{ color: 'var(--wo-text)' }}>{plan.name}</h3>
                <p className="text-xs" style={{ color: 'var(--wo-text-muted)' }}>{plan.description}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold" style={{ color: 'var(--wo-primary)' }}>{plan.formatted_amount}</p>
                <p className="text-xs" style={{ color: 'var(--wo-text-muted)' }}>/month</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 mb-4">
              {plan.highlights.slice(0, 4).map((h) => (
                <div key={h} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--wo-text-muted)' }}>
                  <Check className="w-3 h-3 flex-shrink-0" style={{ color: '#34d399' }} />
                  {h}
                </div>
              ))}
            </div>

            <button
              onClick={() => subscribe(plan.id)}
              disabled={subscribing === plan.id}
              className="wo-btn wo-btn-primary w-full gap-1.5 disabled:opacity-60"
            >
              {subscribing === plan.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              {subscribing === plan.id ? 'Processing...' : `Subscribe to ${plan.name}`}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── KnowledgeBaseSettings ─────────────────────────────────────────────────────
function KnowledgeBaseSettings() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [uploadText, setUploadText] = useState('');
  const [collectionName, setCollectionName] = useState('General');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');

  interface Collection {
    id: string;
    name: string;
    chunk_count: number;
    source_files: string[];
    created_at: string;
  }

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/kb/collections');
      if (res.ok) setCollections(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCollections(); }, [fetchCollections]);

  async function uploadFile(file: File) {
    setUploading(true);
    setMsg('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('collection', collectionName);
    try {
      const res = await fetch('/api/kb/add', { method: 'POST', body: fd });
      const data = await res.json();
      setMsg(`Added ${data.chunks_added} chunks from "${file.name}"`);
      await fetchCollections();
    } catch {
      setMsg('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function addText() {
    if (!uploadText.trim()) return;
    setUploading(true);
    setMsg('');
    try {
      const res = await fetch('/api/kb/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: uploadText, collection: collectionName }),
      });
      const data = await res.json();
      setMsg(`Added ${data.chunks_added} chunks from text`);
      setUploadText('');
      await fetchCollections();
    } catch {
      setMsg('Failed to add text.');
    } finally {
      setUploading(false);
    }
  }

  async function deleteCollection(id: string) {
    const res = await fetch(`/api/kb/collections?id=${id}`, { method: 'DELETE' });
    if (res.ok) await fetchCollections();
  }

  async function testSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch('/api/kb/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, top_k: 3 }),
      });
      const data = await res.json();
      setSearchResults(data.results ?? []);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-bold" style={{ color: 'var(--wo-text)' }}>Knowledge Base</h2>

      {/* Upload Section */}
      <div className="wo-card p-5 space-y-4">
        <h3 className="font-semibold text-sm" style={{ color: 'var(--wo-text)' }}>Add Knowledge</h3>

        <div>
          <Label>Collection Name</Label>
          <input
            value={collectionName}
            onChange={(e) => setCollectionName(e.target.value)}
            placeholder="General, Products, Case Studies..."
            className="wo-input"
          />
        </div>

        {/* File Upload */}
        <div>
          <Label>Upload File</Label>
          <div
            className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors"
            style={{ borderColor: 'var(--wo-border)' }}
            onClick={() => fileInputRef.current?.click()}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--wo-primary)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--wo-border)')}
          >
            <Upload className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--wo-text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--wo-text-muted)' }}>
              {uploading ? 'Uploading...' : 'Click to upload PDF, DOCX, or TXT'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--wo-text-muted)' }}>Max 10MB</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFile(file);
            }}
          />
        </div>

        {/* Or paste text */}
        <div>
          <Label>Or Paste Text</Label>
          <textarea
            value={uploadText}
            onChange={(e) => setUploadText(e.target.value)}
            placeholder="Paste company info, product details, case study content..."
            rows={4}
            className="wo-input w-full resize-none"
          />
          <button
            onClick={addText}
            disabled={!uploadText.trim() || uploading}
            className="wo-btn wo-btn-primary mt-2 gap-1.5 disabled:opacity-60"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Add Text to KB
          </button>
        </div>

        {msg && (
          <div className="flex items-center gap-2 text-sm" style={{ color: msg.includes('fail') ? '#f87171' : '#34d399' }}>
            {msg.includes('fail') ? <AlertCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
            {msg}
          </div>
        )}
      </div>

      {/* Collections */}
      <div>
        <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--wo-text)' }}>
          Collections ({collections.length})
        </h3>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--wo-primary)' }} />
          </div>
        ) : collections.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: 'var(--wo-text-muted)' }}>
            No collections yet. Upload files to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {collections.map((col) => (
              <div key={col.id} className="wo-card p-4 flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--wo-primary)' }} />
                    <span className="font-medium text-sm" style={{ color: 'var(--wo-text)' }}>{col.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(0,217,255,0.1)', color: 'var(--wo-primary)' }}>
                      {col.chunk_count} chunks
                    </span>
                  </div>
                  {col.source_files.length > 0 && (
                    <p className="text-xs mt-1 truncate" style={{ color: 'var(--wo-text-muted)' }}>
                      {col.source_files.join(', ')}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => deleteCollection(col.id)}
                  className="p-1.5 rounded-lg ml-2 flex-shrink-0"
                  style={{ color: 'var(--wo-text-muted)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.1)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--wo-text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  title="Delete collection"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search Tester */}
      <div className="wo-card p-5 space-y-3">
        <h3 className="font-semibold text-sm" style={{ color: 'var(--wo-text)' }}>Test Search</h3>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--wo-text-muted)' }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') testSearch(); }}
              placeholder="Search your knowledge base..."
              className="wo-input pl-10 w-full"
            />
          </div>
          <button
            onClick={testSearch}
            disabled={searching || !searchQuery.trim()}
            className="wo-btn wo-btn-primary gap-1.5 disabled:opacity-60"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <SearchIcon className="w-4 h-4" />}
            Search
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="space-y-2 mt-2">
            {searchResults.map((r, i) => (
              <div key={i} className="p-3 rounded-lg text-xs leading-relaxed" style={{ background: 'var(--wo-surface-2)', color: 'var(--wo-text-muted)' }}>
                {r.slice(0, 300)}{r.length > 300 ? '...' : ''}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
