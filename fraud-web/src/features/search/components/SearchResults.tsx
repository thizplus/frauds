'use client'

import { Bot, Database, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import type { FraudResponse } from '../types'
import type { PaginationMeta } from '@/lib/api/types'
import { FraudRow } from './FraudRow'

interface SearchResultsProps {
  query: string
  frauds: FraudResponse[]
  meta: PaginationMeta
  onSelect: (fraud: FraudResponse) => void
  onPageChange: (page: number) => void
  loading?: boolean
  isMember?: boolean
}

export function SearchResults({
  query,
  frauds,
  meta,
  onSelect,
  onPageChange,
  loading,
  isMember = false,
}: SearchResultsProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-slate-800" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-800 rounded w-1/3" />
                <div className="h-3 bg-slate-800 rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (frauds.length === 0) {
    return (
      <div className="card p-8 text-center">
        <Database className="w-10 h-10 mx-auto text-slate-600 mb-3" />
        <div className="text-slate-300 font-medium">ไม่พบข้อมูล</div>
        <div className="text-sm text-slate-500 mt-1">
          ไม่พบรายชื่อที่ตรงกับ &quot;{query}&quot;
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Result header */}
      <div className="mb-4 flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2.5 text-sm">
          <span className="result-bot-badge">
            <Bot className="w-4 h-4" />
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            AI พบ <span className="text-accent font-semibold">{meta.total} รายการ</span> ที่ตรงกับ{' '}
            <span className="font-mono" style={{ color: 'var(--text)' }}>{query}</span>
          </span>
        </div>
        <span className="hidden sm:inline-flex live-pill text-xs">
          <Sparkles className="w-3 h-3" />
          AI scored
        </span>
      </div>

      {/* Row list */}
      <div className="row-ai-list">
        {frauds.map((fraud) => (
          <FraudRow key={fraud.id} fraud={fraud} onClick={() => onSelect(fraud)} isMember={isMember} />
        ))}
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="pagination-ai">
          <div className="pagination-ai-info">
            <Database className="w-3.5 h-3.5 text-accent" />
            <span>
              <span className="accent">{frauds.length}</span> /{' '}
              <span className="text-slate-300">{meta.total}</span> ผลลัพธ์
            </span>
            <span className="divider-dot" />
            <span>
              PAGE <span className="text-slate-200">{meta.page}</span>/
              <span className="text-slate-500">{meta.totalPages}</span>
            </span>
          </div>
          <div className="pagination-ai-nav">
            <button
              className="btn-pg"
              disabled={!meta.hasPrev}
              onClick={() => onPageChange(meta.page - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="pagination-ai-page">{meta.page}</div>
            <button
              className="btn-pg"
              disabled={!meta.hasNext}
              onClick={() => onPageChange(meta.page + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
