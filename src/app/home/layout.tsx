import AppShell from '@/components/AppShell';
import { PlaybookProvider } from '@/context/PlaybookContext';
import PlaybookClientWrapper from '@/components/PlaybookClientWrapper';

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlaybookProvider>
      <PlaybookClientWrapper>
        <AppShell>{children}</AppShell>
      </PlaybookClientWrapper>
    </PlaybookProvider>
  );
}
