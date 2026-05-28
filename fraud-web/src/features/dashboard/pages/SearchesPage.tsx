'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, Clock, ChevronLeft, ChevronRight, Loader2, AlertTriangle, Phone, CreditCard, IdCard, User, ScanFace, Copy, Check, ShieldAlert, CheckCircle } from 'lucide-react'
import { useAuthStore } from '@/lib/stores/auth'
import { LoginModal } from '@/features/auth'
import { formatDatetime } from '@/lib/utils/format-date'
import { useMySearches } from '../hooks'

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Search; color: string }> = {
  all: { label: 'ค้นทั้งหมด', icon: Search, color: 'var(--accent)' },
  phone: { label: 'เบอร์โทร', icon: Phone, color: 'var(--accent)' },
  bank: { label: 'เลขบัญชี', icon: CreditCard, color: 'var(--accent)' },
  idcard: { label: 'บัตร ปชช.', icon: IdCard, color: 'var(--accent)' },
  name: { label: 'ชื่อ', icon: User, color: 'var(--accent)' },
  unified: { label: 'Unified Search', icon: Search, color: 'var(--accent)' },
  face: { label: 'ค้นด้วยใบหน้า', icon: ScanFace, color: 'var(--accent)' },
}

export function SearchesPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [page, setPage] = useState(1)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  useEffect(() => { setMounted(true) }, [])

  const handleCopy = (query: string, id: string) => {
    navigator.clipboard.writeText(query)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleResearch = (query: string) => {
    router.push(`/search?q=${encodeURIComponent(query)}`)
  }

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

  const { data, isLoading } = useMySearches(page)
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
          <div className="space-y-2.5">
            {searches.map((s) => {
              const typeKey = s.searchSource || s.searchType || 'all'
              const config = TYPE_CONFIG[typeKey] || TYPE_CONFIG.all
              const TypeIcon = config.icon
              const hasResults = s.resultCount > 0
              const isFace = typeKey === 'face'

              return (
                <div key={s.id} className="card overflow-hidden">
                  <div className="flex">
                    {/* Left: content */}
                    <div className="flex-1 p-4 min-w-0">
                      {/* Query */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-bold text-base truncate" style={{ color: 'var(--text)' }}>
                          {isFace ? 'ค้นด้วยใบหน้า' : s.query}
                        </span>
                        {!isFace && (
                          <button
                            className="shrink-0 p-1 rounded transition-colors hover:bg-white/5"
                            onClick={() => handleCopy(s.query, s.id)}
                            title="คัดลอก"
                          >
                            {copiedId === s.id
                              ? <Check className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                              : <Copy className="w-3.5 h-3.5" style={{ color: 'var(--text-dim)' }} />
                            }
                          </button>
                        )}
                      </div>

                      {/* Result count badge */}
                      <div className="flex items-center gap-2 mb-2">
                        {hasResults ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(239,68,68,.12)', color: 'var(--danger)' }}
                          >
                            <ShieldAlert className="w-3 h-3" />
                            พบ {s.resultCount} รายการ
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
                          >
                            <CheckCircle className="w-3 h-3" />
                            ไม่พบประวัติ
                          </span>
                        )}
                      </div>

                      {/* Meta: type + time */}
                      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-dim)' }}>
                        <span className="flex items-center gap-1">
                          <TypeIcon className="w-3.5 h-3.5" />
                          {config.label}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDatetime(s.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Right: re-search button */}
                    {!isFace && (
                      <button
                        className="flex flex-col items-center justify-center gap-1 px-4 shrink-0 transition-opacity hover:opacity-80"
                        style={{ background: 'var(--accent-dim)', color: 'var(--accent)', minWidth: 72 }}
                        onClick={() => handleResearch(s.query)}
                      >
                        <Search className="w-5 h-5" />
                        <span className="text-xs font-bold">ค้นอีกครั้ง</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-4">
              <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>{page} / {meta.totalPages}</span>
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
