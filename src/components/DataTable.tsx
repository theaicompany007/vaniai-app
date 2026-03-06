'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, Grid3X3, MoreHorizontal } from 'lucide-react';

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  sortKey?: string; // Optional: use different key for sorting (e.g. 'opp_count' for display key)
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
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [openSortDropdown, setOpenSortDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenSortDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const perPage = 10;

  const filtered = data.filter((item) =>
    columns.some((col) => {
      const val = (item as Record<string, unknown>)[col.key];
      return String(val ?? '').toLowerCase().includes(search.toLowerCase());
    })
  );

  const sorted = [...filtered];
  if (sortColumn) {
    const col = columns.find((c) => c.key === sortColumn);
    const key = col?.sortKey ?? col?.key ?? sortColumn;
    sorted.sort((a, b) => {
      const va = (a as Record<string, unknown>)[key];
      const vb = (b as Record<string, unknown>)[key];
      const isStr = typeof va === 'string' || typeof vb === 'string';
      const aVal = isStr ? String(va ?? '').toLowerCase() : (Number(va) ?? 0);
      const bVal = isStr ? String(vb ?? '').toLowerCase() : (Number(vb) ?? 0);
      if (isStr) {
        const cmp = String(aVal).localeCompare(String(bVal));
        return sortDirection === 'asc' ? cmp : -cmp;
      }
      const cmp = (aVal as number) < (bVal as number) ? -1 : (aVal as number) > (bVal as number) ? 1 : 0;
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const pageData = sorted.slice((page - 1) * perPage, page * perPage);

  function handleSort(colKey: string, direction: 'asc' | 'desc') {
    setSortColumn(colKey);
    setSortDirection(direction);
    setOpenSortDropdown(null);
    setPage(1);
  }

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
                <th key={col.key} className="relative">
                  {col.sortable ? (
                    <div ref={col.key === openSortDropdown ? dropdownRef : undefined} className="inline-flex items-center gap-1.5">
                      <Grid3X3 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--wo-text-muted)' }} />
                      <span>{col.label}</span>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenSortDropdown((prev) => (prev === col.key ? null : col.key))}
                          className="p-0.5 rounded transition-colors hover:bg-white/10"
                          style={{ color: sortColumn === col.key ? 'var(--wo-primary)' : 'var(--wo-text-muted)' }}
                          title="Sort options"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {openSortDropdown === col.key && (
                          <div
                            className="absolute left-0 top-full mt-0.5 py-1 min-w-[140px] rounded-lg shadow-lg z-10"
                            style={{ background: 'var(--wo-surface-2)', border: '1px solid rgba(255,255,255,0.08)' }}
                          >
                            <button
                              type="button"
                              onClick={() => handleSort(col.key, 'asc')}
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 transition-colors"
                              style={{ color: 'var(--wo-text)' }}
                            >
                              Sort Ascending
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSort(col.key, 'desc')}
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 transition-colors"
                              style={{ color: 'var(--wo-text)' }}
                            >
                              Sort Descending
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    col.label
                  )}
                </th>
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
