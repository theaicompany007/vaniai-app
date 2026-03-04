'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import TopNav from './TopNav';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/session', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.userId && data.orgId == null) {
          router.replace('/auth/complete-setup');
        }
      })
      .catch(() => {});
  }, [router]);

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden"
      style={{ background: 'var(--wo-bg)', transition: 'background 0.25s ease' }}
    >
      {/* Single full-width header — stays put; sidebar expand/collapse is below */}
      <TopNav />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <main
          className="flex-1 overflow-auto min-w-0"
          style={{ background: 'var(--wo-bg)', transition: 'background 0.25s ease' }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
