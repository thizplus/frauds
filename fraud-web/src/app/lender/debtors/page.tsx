'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Users, Loader2, AlertTriangle, ChevronLeft, ChevronRight, Phone, ShieldAlert, CheckCircle, Clock } from 'lucide-react'
import { SearchInput } from '@/components/shared/SearchInput'
import { useAuthStore } from '@/lib/stores/auth'
import { LoginModal } from '@/features/auth'
import { useDebtorList } from '@/features/lender'
import type { Debtor } from '@/features/lender'
import { formatDateNoYear } from '@/lib/utils/format-date'
import { DebtorDetailDrawer } from './DebtorDetailDrawer'

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle }> = {
  active: { label: 'ปกติ', color: 'var(--accent)', bg: 'rgba(34,197,94,0.1)', icon: CheckCircle },
  flagged: { label: 'ถูกแจ้ง', color: 'var(--danger)', bg: 'rgba(248,113,113,0.1)', icon: ShieldAlert },
  cleared: { label: 'ปลดแล้ว', color: 'var(--text-muted)', bg: 'var(--bg-elevated)', icon: Clock },
  archived: { label: 'ถังขยะ', color: 'var(--text-dim)', bg: 'var(--bg-elevated)', icon: Clock },
}

export default function DebtorsPage() {
  const [mounted, setMounted] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selectedDebtorId, setSelectedDebtorId] = useState<string | null>(null)

  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  useEffect(() => { setMounted(true) }, [])

  const { data, isLoading } = useDebtorList({ q: search || undefined, status: statusFilter || undefined, page, limit: 20 })
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

      {/* Search */}
      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={(v) => { setSearch(v); setPage(1) }}
          placeholder="ค้นหา ชื่อ / เบอร์ / เลข ปชช"
        />
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {[{ value: '', label: 'ทั้งหมด' }, { value: 'unchecked', label: 'รอตรวจสอบ' }, { value: 'active', label: 'ปกติ' }, { value: 'flagged', label: 'ถูกแจ้ง' }, { value: 'archived', label: '🗑 ถังขยะ' }].map((f) => (
          <button key={f.value} className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap flex-shrink-0"
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
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
            {search || statusFilter ? 'ไม่พบสมาชิกที่ตรงกัน' : 'ยังไม่มีสมาชิก'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {debtors.map((d) => (
              <DebtorCard
                key={d.id}
                debtor={d}
                onOpenDetail={() => setSelectedDebtorId(d.id)}
              />
            ))}
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

      {/* Detail Drawer */}
      <DebtorDetailDrawer
        debtorId={selectedDebtorId}
        open={!!selectedDebtorId}
        onClose={() => setSelectedDebtorId(null)}
      />
    </section>
  )
}

// === Debtor Card ===

function DebtorCard({ debtor, onOpenDetail }: {
  debtor: Debtor; onOpenDetail: () => void
}) {
  const d = debtor
  const st = STATUS_MAP[d.status] || STATUS_MAP.active
  const StatusIcon = st.icon

  return (
    <div className="card w-full text-left p-0 overflow-hidden cursor-pointer" onClick={onOpenDetail}>
      <div className="flex items-center gap-2.5 p-3">
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>
              {[d.firstName, d.lastName].filter(Boolean).join(' ')}
            </span>
            <span
              className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ background: st.bg, color: st.color }}
            >
              <StatusIcon className="w-2.5 h-2.5" />
              {st.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {d.phone && (
              <span className="flex items-center gap-1 text-sm font-mono" style={{ color: 'var(--text-dim)' }}>
                <Phone className="w-3 h-3" />{d.phone}
              </span>
            )}
            <span className="text-sm" style={{ color: 'var(--text-dim)' }}>{formatDateNoYear(d.createdAt)}</span>
          </div>
        </div>

        {/* Check badge */}
        <div className="flex-shrink-0">
          {d.checkedAt ? (
            <span
              className="text-xs font-bold px-2 py-1 rounded-lg"
              style={{
                background: d.checkMatches > 0 ? 'rgba(248,113,113,0.1)' : 'var(--bg-elevated)',
                color: d.checkMatches > 0 ? 'var(--danger)' : 'var(--text-dim)',
              }}
            >
              {d.checkMatches > 0 ? `ตรวจพบ ${d.checkMatches}` : 'ไม่พบข้อมูล'}
            </span>
          ) : (
            <span className="text-xs font-medium px-2 py-1" style={{ color: 'var(--text-dim)' }}>
              รอตรวจสอบ
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
