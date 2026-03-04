'use client';

/**
 * Wrapper for layouts that use PlaybookProvider.
 * Playbook chip is now shown in the header (TopNav) with hide/show option.
 */
export default function PlaybookClientWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
