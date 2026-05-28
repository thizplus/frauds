'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, Clock, ChevronLeft, ChevronRight, Loader2, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '@/lib/stores/auth'
import { LoginModal } from '@/features/auth'
import { formatDatetime } from '@/lib/utils/format-date'
import { useMySearches } from '../hooks'

const TYPE_LABELS: Record<string, string> = {
  all: 'ทั้งหมด',
  phone: 'เบอร์โทร',
  bank: 'เลขบัญชี',
  idcard: 'บัตร ปชช.',
  name: 'ชื่อ',
}

export function SearchesPage() {
  const [mounted, setMounted] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [page, setPage] = useState(1)

  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  useEffect(() => { setMounted(true) }, [])

  const { data, isLoading } = useMySearches(page)

  if (!mounted) return null

  if (!isLoggedIn) {
    return (
      <>
        <section className="flex-1 flex items-center justify-center px-4">
          <div className="card p-8 text-center max-w-sm w-full">
            <AlertTriangle className="w-10 h-10 mx-auto mb-4" style={{ color: 'var(--accent)' }} />
            <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>ต้องเข้าสู่ระบบก่อน</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>กรุณาเข้าสู่ระบบเพื่อดูประวัติค้นหา</p>
            <button className="btn btn-primary btn-lg w-full" onClick={() => setShowLogin(true)}>เข้าสู่ระบบ</button>
          </div>
        </section>
        <LoginModal open={showLogin} onOpenChange={setShowLogin} />
      </>
    )
  }

  const searches = data?.data || []
  const meta = data?.meta

  return (
    <section className="w-full max-w-lg mx-auto px-4 py-8">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeft className="w-4 h-4" />แดชบอร์ด
      </Link>

      <h1 className="text-xl font-extrabold tracking-tight mb-1" style={{ color: 'var(--text)' }}>
        ประวัติค้นหา
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        {meta ? `ทั้งหมด ${meta.total} รายการ` : ''}
      </p>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : searches.length === 0 ? (
        <div className="card p-8 text-center">
          <Search className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-dim)' }} />
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>ยังไม่มีประวัติค้นหา</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {searches.map((s) => (
              <div key={s.id} className="card p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-base" style={{ color: 'var(--text)' }}>
                    {s.query}
                  </span>
                  <span className="text-sm font-mono" style={{ color: 'var(--accent)' }}>
                    {s.resultCount} ผล
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-dim)' }}>
                  <span className="flex items-center gap-1">
                    <Search className="w-3.5 h-3.5" />
                    {TYPE_LABELS[s.searchType] || s.searchType || 'ทั้งหมด'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDatetime(s.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-3">
              <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{page} / {meta.totalPages}</span>
              <button className="btn btn-secondary btn-sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
