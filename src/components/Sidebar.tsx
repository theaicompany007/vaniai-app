'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';
import {
  Home,
  Flame,
  LayoutGrid,
  Building2,
  Users,
  Target,
  FlaskConical,
  FileText,
  MessageCircle,
  Map,
  PanelLeftOpen,
  PanelLeftClose,
} from 'lucide-react';

const NAV_ITEMS = [
  { icon: Home,          label: 'Home',          href: '/home' },
  { icon: Flame,         label: 'Lead Signals',  href: '/home/signals' },
  { icon: LayoutGrid,    label: 'Pipeline',      href: '/home/pipeline' },
  { icon: Building2,     label: 'Accounts',      href: '/home/accounts' },
  { icon: Users,         label: 'Contacts',      href: '/home/contacts' },
  { icon: Target,        label: 'Opportunities', href: '/home/opportunities' },
  { icon: FlaskConical,  label: 'Research',      href: '/research' },
  { icon: FileText,      label: 'Documents',     href: '/home/documents' },
  { icon: MessageCircle, label: 'Chat',          href: '/home/chat' },
  { icon: Map,           label: 'Playbook',      href: '/home/playbook' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useTheme();

  const isActive = (href: string) =>
    href === '/home' ? pathname === '/home' : pathname.startsWith(href);

  // Cyan primary: dark = #00d9ff, light = var(--wo-primary) e.g. #0891b2
  const activeCyan = theme === 'dark' ? '#00d9ff' : 'var(--wo-primary)';
  const mutedColor = 'var(--wo-text-muted)';

  return (
    <aside
      className="wo-sidebar flex flex-col h-full flex-shrink-0 z-40"
      style={{ width: collapsed ? 56 : 224 }}
    >
      {/* ── Nav Items (logo lives in header top-left; no logo box here) ── */}
      <nav className="flex-1 flex flex-col gap-0.5 px-2 py-3 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`wo-sidebar-icon ${active ? 'active' : ''}`}
              style={{
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: collapsed ? 0 : 10,
                padding: collapsed ? 8 : '8px 12px',
                width: '100%',
              }}
            >
              <Icon
                className="flex-shrink-0"
                style={{
                  width: 18,
                  height: 18,
                  color: active ? activeCyan : mutedColor,
                  strokeWidth: active ? 2.2 : 1.8,
                }}
              />
              {!collapsed && (
                <span
                  className="text-sm whitespace-nowrap"
                  style={{
                    color: active ? activeCyan : mutedColor,
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {item.label}
                </span>
              )}
              {collapsed && (
                <span className="wo-tooltip">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: 'var(--wo-border)', flexShrink: 0 }} />

      {/* ── Collapse Toggle ── */}
      <div className="px-2 py-3 flex-shrink-0">
        <button
          onClick={onToggle}
          className="wo-sidebar-icon w-full"
          style={{
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: collapsed ? 0 : 10,
            padding: collapsed ? 8 : '8px 12px',
          }}
        >
          {collapsed
            ? <PanelLeftOpen  style={{ width: 18, height: 18, color: mutedColor }} />
            : <PanelLeftClose style={{ width: 18, height: 18, color: mutedColor }} />
          }
          {!collapsed && (
            <span className="text-sm" style={{ color: mutedColor }}>Collapse</span>
          )}
          {collapsed && <span className="wo-tooltip">Expand</span>}
        </button>
      </div>
    </aside>
  );
}
