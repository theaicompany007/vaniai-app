'use client';

import { useState } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  emptyMessage?: string;
}

export default function DataTable<T extends { id: string }>({
  columns,
  data,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found.',
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 10;

  const filtered = data.filter((item) =>
    columns.some((col) => {
      const val = (item as Record<string, unknown>)[col.key];
      return String(val ?? '').toLowerCase().includes(search.toLowerCase());
    })
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageData = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div>
      {/* Search */}
      <div className="mb-4">
        <div className="relative w-80">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--wo-text-muted)' }}
          />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="wo-input pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="wo-card overflow-hidden">
        <table className="wo-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-12"
                  style={{ color: 'var(--wo-text-muted)' }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageData.map((item) => (
                <tr key={item.id} className="transition-colors">
                  {columns.map((col) => (
                    <td key={col.key}>
                      {col.render
                        ? col.render(item)
                        : String((item as Record<string, unknown>)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-2 mt-4">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
          style={{ color: 'var(--wo-text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--wo-hover-btn)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            onClick={() => setPage(p)}
            className="w-8 h-8 rounded-lg text-sm font-medium transition-all"
            style={p === page ? {
              background: 'rgba(0,217,255,0.12)',
              color: 'var(--wo-primary)',
              border: '1px solid rgba(0,217,255,0.25)',
            } : {
              color: 'var(--wo-text-muted)',
            }}
            onMouseEnter={e => {
              if (p !== page) e.currentTarget.style.background = 'var(--wo-hover-btn)';
            }}
            onMouseLeave={e => {
              if (p !== page) e.currentTarget.style.background = 'transparent';
            }}
          >
            {p}
          </button>
        ))}

        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
          style={{ color: 'var(--wo-text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--wo-hover-btn)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
