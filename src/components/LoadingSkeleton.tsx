'use client';

interface LoadingSkeletonProps {
  rows?: number;
  type?: 'card' | 'table' | 'list';
}

export function LoadingSkeleton({ rows = 3, type = 'card' }: LoadingSkeletonProps) {
  if (type === 'table') {
    return (
      <div className="animate-pulse space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 items-center p-4 rounded-lg bg-[var(--surface)]">
            <div className="w-8 h-8 rounded-full bg-[var(--border)]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-[var(--border)] rounded w-1/3" />
              <div className="h-2 bg-[var(--border)] rounded w-1/5" />
            </div>
            <div className="h-3 bg-[var(--border)] rounded w-16" />
            <div className="h-3 bg-[var(--border)] rounded w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className="animate-pulse space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-3 items-center p-3 rounded-lg bg-[var(--surface)]">
            <div className="w-6 h-6 rounded bg-[var(--border)]" />
            <div className="flex-1 h-3 bg-[var(--border)] rounded" />
            <div className="h-3 bg-[var(--border)] rounded w-12" />
          </div>
        ))}
      </div>
    );
  }

  // Default: card
  return (
    <div className="animate-pulse grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-5 rounded-xl bg-[var(--surface)] space-y-3">
          <div className="flex gap-3 items-center">
            <div className="w-10 h-10 rounded-lg bg-[var(--border)]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-[var(--border)] rounded w-2/3" />
              <div className="h-2 bg-[var(--border)] rounded w-1/3" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-[var(--border)] rounded" />
            <div className="h-3 bg-[var(--border)] rounded w-4/5" />
            <div className="h-3 bg-[var(--border)] rounded w-3/5" />
          </div>
          <div className="flex gap-2">
            <div className="h-5 bg-[var(--border)] rounded-full w-16" />
            <div className="h-5 bg-[var(--border)] rounded-full w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageLoadingSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-6 bg-[var(--border)] rounded w-48" />
          <div className="h-3 bg-[var(--border)] rounded w-64" />
        </div>
        <div className="h-9 bg-[var(--border)] rounded-lg w-32" />
      </div>
      <LoadingSkeleton rows={6} type="card" />
    </div>
  );
}
