'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';
import {
  Home,
  Flame,
  Network,
  ChevronRight,
  ChevronDown,
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
  {
    icon: Network,
    label: 'Pipeline',
    href: '/home/pipeline',
    children: [
      { icon: Building2, label: 'Accounts', href: '/home/accounts' },
      { icon: Users, label: 'Contacts', href: '/home/contacts' },
      { icon: Target, label: 'Opportunities', href: '/home/opportunities' },
    ],
  },
  { icon: FlaskConical,  label: 'Research',      href: '/research' },
  { icon: FileText,      label: 'Documents',     href: '/home/documents' },
  { icon: MessageCircle, label: 'Chat',          href: '/home/chat' },
  { icon: Map,           label: 'Playbook',      href: '/home/playbook' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

type NavItem = (typeof NAV_ITEMS)[number];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useTheme();

  const pipelineChildHrefs = ['/home/accounts', '/home/contacts', '/home/opportunities'];
  const isPipelineChildActive = pipelineChildHrefs.some((h) => pathname.startsWith(h));
  const [pipelineExpanded, setPipelineExpanded] = useState(isPipelineChildActive);

  useEffect(() => {
    if (isPipelineChildActive) setPipelineExpanded(true);
  }, [isPipelineChildActive]);

  const isActive = (href: string) =>
    href === '/home' ? pathname === '/home' : pathname.startsWith(href);

  // Cyan primary: dark = #00d9ff, light = var(--wo-primary) e.g. #0891b2
  const activeCyan = theme === 'dark' ? '#00d9ff' : 'var(--wo-primary)';
  const mutedColor = 'var(--wo-text-muted)';

  const renderNavButton = (item: NavItem & { href: string }, isChild = false) => {
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
          padding: collapsed ? 8 : isChild ? '6px 12px 6px 36px' : '8px 12px',
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
        {collapsed && <span className="wo-tooltip">{item.label}</span>}
      </button>
    );
  };

  return (
    <aside
      className="wo-sidebar flex flex-col h-full flex-shrink-0 z-40"
      style={{ width: collapsed ? 56 : 224 }}
    >
      {/* ── Nav Items (logo lives in header top-left; no logo box here) ── */}
      <nav className="flex-1 flex flex-col gap-0.5 px-2 py-3 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const hasChildren = 'children' in item && item.children;
          if (hasChildren && item.children) {
            const pipelineActive = isActive(item.href) || item.children.some((c) => isActive(c.href));
            const Icon = item.icon;

            // When collapsed: Pipeline icon toggles to show/hide Accounts, Contacts, Opportunities
            if (collapsed) {
              return (
                <div key={item.href} className="flex flex-col gap-0.5">
                  <button
                    onClick={() => setPipelineExpanded((e) => !e)}
                    className={`wo-sidebar-icon ${pipelineActive ? 'active' : ''}`}
                    style={{
                      justifyContent: 'center',
                      gap: 0,
                      padding: 8,
                      width: '100%',
                    }}
                  >
                    <Icon
                      className="flex-shrink-0"
                      style={{
                        width: 18,
                        height: 18,
                        color: pipelineActive ? activeCyan : mutedColor,
                        strokeWidth: pipelineActive ? 2.2 : 1.8,
                      }}
                    />
                    <span className="wo-tooltip">{item.label}</span>
                  </button>
                  {pipelineExpanded && item.children.map((child) => renderNavButton(child))}
                </div>
              );
            }

            // When expanded: show Pipeline with chevron and expandable tree
            return (
              <div key={item.href} className="flex flex-col gap-0.5">
                <div
                  className="flex items-center w-full min-w-0"
                  style={{ gap: 4 }}
                >
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPipelineExpanded((e2) => !e2); }}
                    className="p-0.5 rounded hover:bg-white/10 transition-colors flex-shrink-0"
                    style={{ color: pipelineActive ? activeCyan : mutedColor }}
                    aria-label={pipelineExpanded ? 'Collapse' : 'Expand'}
                  >
                    {pipelineExpanded ? (
                      <ChevronDown style={{ width: 14, height: 14 }} />
                    ) : (
                      <ChevronRight style={{ width: 14, height: 14 }} />
                    )}
                  </button>
                  <button
                    onClick={() => router.push(item.href)}
                    className={`wo-sidebar-icon flex-1 ${pipelineActive ? 'active' : ''}`}
                    style={{
                      justifyContent: 'flex-start',
                      gap: 10,
                      padding: '8px 12px 8px 0',
                      width: '100%',
                    }}
                  >
                    <Icon
                      className="flex-shrink-0"
                      style={{
                        width: 18,
                        height: 18,
                        color: pipelineActive ? activeCyan : mutedColor,
                        strokeWidth: pipelineActive ? 2.2 : 1.8,
                      }}
                    />
                    <span
                      className="text-sm whitespace-nowrap"
                      style={{
                        color: pipelineActive ? activeCyan : mutedColor,
                        fontWeight: pipelineActive ? 600 : 400,
                      }}
                    >
                      {item.label}
                    </span>
                  </button>
                </div>
                {pipelineExpanded && (
                  <div className="flex flex-col gap-0.5">
                    {item.children.map((child) => renderNavButton(child, true))}
                  </div>
                )}
              </div>
            );
          }
          return renderNavButton(item);
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
