'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, Users, Loader2, AlertTriangle, ChevronLeft, ChevronRight, Eye, ShieldAlert, CheckCircle } from 'lucide-react'
import { useAuthStore } from '@/lib/stores/auth'
import { LoginModal } from '@/features/auth'
import { useDebtorList, useCheckDebtor } from '@/features/lender'
import type { Debtor } from '@/features/lender'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: 'ปกติ', color: 'var(--accent)' },
  flagged: { label: 'โกง', color: 'var(--danger)' },
  cleared: { label: 'ปลดแล้ว', color: 'var(--text-muted)' },
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
  } catch { return dateStr }
}

export default function DebtorsPage() {
  const [mounted, setMounted] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  useEffect(() => { setMounted(true) }, [])

  const { data, isLoading } = useDebtorList({ q: search || undefined, status: statusFilter || undefined, page, limit: 20 })
  const checkMutation = useCheckDebtor()

  if (!mounted) return null

  if (!isLoggedIn) {
    return (
      <>
        <section className="flex-1 flex items-center justify-center px-4">
          <div className="card p-8 text-center max-w-sm w-full">
            <AlertTriangle className="w-10 h-10 mx-auto mb-4" style={{ color: 'var(--accent)' }} />
            <h2 className="text-lg font-bold mb-2">ต้องเข้าสู่ระบบก่อน</h2>
            <button className="btn btn-primary btn-lg w-full" onClick={() => setShowLogin(true)}>เข้าสู่ระบบ</button>
          </div>
        </section>
        <LoginModal open={showLogin} onOpenChange={setShowLogin} />
      </>
    )
  }

  const debtors = data?.data || []
  const meta = data?.meta

  return (
    <section className="w-full max-w-lg mx-auto px-4 py-8">
      <Link href="/lender" className="inline-flex items-center gap-1.5 text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeft className="w-4 h-4" />ระบบเก็บข้อมูล
      </Link>

      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>รายชื่อสมาชิก</h1>
        {meta && <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{meta.total} คน</span>}
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 report-input-wrap">
          <Search className="report-input-icon" />
          <input type="text" className="input pl-10 text-sm" placeholder="ค้นหา ชื่อ / เบอร์ / เลข ปชช"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {[{ value: '', label: 'ทั้งหมด' }, { value: 'active', label: 'ปกติ' }, { value: 'flagged', label: 'โกง' }, { value: 'cleared', label: 'ปลดแล้ว' }].map((f) => (
          <button key={f.value} className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
            style={{
              background: statusFilter === f.value ? 'var(--accent-dim)' : 'var(--bg-input)',
              color: statusFilter === f.value ? 'var(--accent)' : 'var(--text-muted)',
              border: statusFilter === f.value ? '1px solid var(--accent)' : '1px solid transparent',
            }}
            onClick={() => { setStatusFilter(f.value); setPage(1) }}
          >{f.label}</button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} /></div>
      ) : debtors.length === 0 ? (
        <div className="card p-8 text-center">
          <Users className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-dim)' }} />
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>ยังไม่มีสมาชิก</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {debtors.map((d) => {
              const st = STATUS_MAP[d.status] || STATUS_MAP.active
              return (
                <Link key={d.id} href={`/lender/debtors/${d.id}`} className="card p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-base truncate" style={{ color: 'var(--text)' }}>
                      {[d.firstName, d.lastName].filter(Boolean).join(' ')}
                    </div>
                    <div className="flex items-center gap-3 text-sm mt-0.5" style={{ color: 'var(--text-dim)' }}>
                      {d.phone && <span className="font-mono">{d.phone}</span>}
                      <span>{formatDate(d.createdAt)}</span>
                    </div>
                  </div>

                  {/* Check matches */}
                  <div className="text-center flex-shrink-0">
                    {d.checkedAt ? (
                      <span className="text-xs font-mono" style={{ color: d.checkMatches > 0 ? 'var(--danger)' : 'var(--text-dim)' }}>
                        {d.checkMatches > 0 ? `${d.checkMatches} พบ` : '—'}
                      </span>
                    ) : (
                      <button className="text-xs px-2 py-1 rounded" style={{ color: 'var(--accent)', background: 'var(--accent-dim)' }}
                        onClick={(e) => { e.preventDefault(); checkMutation.mutate(d.id) }}>
                        เช็ค
                      </button>
                    )}
                  </div>

                  {/* Status */}
                  <span className="text-xs font-bold flex-shrink-0" style={{ color: st.color }}>
                    {st.label}
                  </span>
                </Link>
              )
            })}
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-3">
              <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{page} / {meta.totalPages}</span>
              <button className="btn btn-secondary btn-sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
