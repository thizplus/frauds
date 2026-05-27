'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, FileText, Search, ShoppingCart, AlertTriangle, ChevronRight, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/lib/stores/auth'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { LoginModal } from '@/features/auth'
import { useDashboard } from '../hooks'

export function DashboardPage() {
  const [mounted, setMounted] = useState(false)
  const [showLogin, setShowLogin] = useState(false)

  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  useEffect(() => { setMounted(true) }, [])

  // ดึง auth state แบบ hydration-safe
  const [authState, setAuthState] = useState<{ name: string | null; avatarUrl: string | null; role: string | null }>({ name: null, avatarUrl: null, role: null })
  useEffect(() => {
    const state = useAuthStore.getState()
    setAuthState({ name: state.user?.name || null, avatarUrl: state.user?.avatarUrl || null, role: state.user?.role || null })
    const unsub = useAuthStore.subscribe((s) => {
      setAuthState({ name: s.user?.name || null, avatarUrl: s.user?.avatarUrl || null, role: s.user?.role || null })
    })
    return unsub
  }, [])

  const { data: kpi, isLoading } = useDashboard()
  const { data: subInfo } = useSubscription()

  if (!mounted) return null

  if (!isLoggedIn) {
    return (
      <>
        <section className="flex-1 flex items-center justify-center px-4">
          <div className="card p-8 text-center max-w-sm w-full">
            <AlertTriangle className="w-10 h-10 mx-auto mb-4" style={{ color: 'var(--accent)' }} />
            <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>ต้องเข้าสู่ระบบก่อน</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>กรุณาเข้าสู่ระบบเพื่อดูแดชบอร์ด</p>
            <button className="btn btn-primary btn-lg w-full" onClick={() => setShowLogin(true)}>เข้าสู่ระบบ</button>
          </div>
        </section>
        <LoginModal open={showLogin} onOpenChange={setShowLogin} />
      </>
    )
  }

  return (
    <section className="w-full max-w-lg mx-auto px-4 py-8">
      {/* Back */}
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeft className="w-4 h-4" />กลับ
      </Link>

      {/* User Profile */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
          style={{ background: 'var(--surface-2, var(--card-bg))', border: '2px solid var(--accent)' }}>
          {authState.avatarUrl ? (
            <img src={authState.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <span className="text-lg font-bold" style={{ color: 'var(--accent)' }}>
              {authState.name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          )}
        </div>
        <div>
          <div className="font-bold" style={{ color: 'var(--text)' }}>{authState.name || 'ผู้ใช้'}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {authState.role === 'admin' ? 'Admin' : subInfo?.hasSubscription ? `Member (เหลือ ${subInfo.daysLeft} วัน)` : 'Free'}
          </div>
        </div>
      </div>

      {/* Search quota */}
      {kpi && (
        <div className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          <Search className="w-4 h-4 inline-block mr-1" style={{ color: 'var(--accent)' }} />
          {kpi.searchQuotaTotal === 0
            ? <>ค้นหาวันนี้ <span className="font-bold" style={{ color: 'var(--accent)' }}>{kpi.searchQuotaUsed}</span> ครั้ง (ไม่จำกัด)</>
            : <>ค้นหาวันนี้ <span className="font-bold" style={{ color: 'var(--text)' }}>{kpi.searchQuotaUsed}/{kpi.searchQuotaTotal}</span> ครั้ง</>
          }
        </div>
      )}

      {/* KPI Cards */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : kpi ? (
        <div className="grid grid-cols-3 gap-3 mb-8">
          <KPICard icon={FileText} label="รายงาน" value={kpi.totalReports} />
          <KPICard icon={Search} label="ค้นหา" value={kpi.totalSearches} />
          <KPICard icon={ShoppingCart} label="บริการ" value={kpi.totalServicePayments} />
        </div>
      ) : null}

      {/* Menu Links */}
      <div className="space-y-2">
        <MenuLink href="/dashboard/reports" icon={FileText} label="รายงานที่ลงไว้" count={kpi?.totalReports} />
        <MenuLink href="/dashboard/searches" icon={Search} label="ประวัติค้นหา" count={kpi?.totalSearches} />
      </div>
    </section>
  )
}

// === Sub-components ===

function KPICard({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: number }) {
  return (
    <div className="card p-3 text-center">
      <Icon className="w-5 h-5 mx-auto mb-1" style={{ color: 'var(--accent)' }} />
      <div className="text-xl font-extrabold" style={{ color: 'var(--text)' }}>{value}</div>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}

function MenuLink({ href, icon: Icon, label, count, disabled }: {
  href: string; icon: typeof FileText; label: string; count?: number; disabled?: boolean
}) {
  const content = (
    <div className={`card p-4 flex items-center gap-3 ${disabled ? 'opacity-50' : ''}`}>
      <Icon className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
      <span className="flex-1 font-medium text-sm" style={{ color: 'var(--text)' }}>{label}</span>
      {count !== undefined && (
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-dim, rgba(0,0,0,0.05))', color: 'var(--accent)' }}>
          {count}
        </span>
      )}
      <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-dim)' }} />
    </div>
  )

  if (disabled) return <div className="cursor-not-allowed">{content}</div>
  return <Link href={href}>{content}</Link>
}
