'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

function buildPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = [1]
  if (current > 3) pages.push('...')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i)
  }
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-1.5 mt-3 flex-wrap">
      <button
        className="btn btn-secondary btn-sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {buildPageNumbers(page, totalPages).map((p, i) =>
        p === '...' ? (
          <span key={`dot-${i}`} className="px-1 text-xs" style={{ color: 'var(--text-dim)' }}>…</span>
        ) : (
          <button
            key={p}
            className="text-xs font-bold w-8 h-8 rounded-lg transition-all"
            style={{
              background: page === p ? 'var(--accent-dim)' : 'transparent',
              color: page === p ? 'var(--accent)' : 'var(--text-muted)',
              border: page === p ? '1px solid var(--accent)' : '1px solid transparent',
            }}
            onClick={() => onPageChange(p as number)}
          >
            {p}
          </button>
        )
      )}

      <button
        className="btn btn-secondary btn-sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
