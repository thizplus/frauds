'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, FileText, Clock, BadgeCheck, CheckCircle, AlertTriangle, Loader2, Bot, Pause, Play, Trash2 } from 'lucide-react'
import { Pagination } from '@/components/shared/Pagination'
import { SearchInput } from '@/components/shared/SearchInput'
import { useAuthStore } from '@/lib/stores/auth'
import { LoginModal } from '@/features/auth'
import { ServiceDetailDrawer, PaymentDrawer } from '@/features/services'
import type { ServiceItem } from '@/features/services'
import { useMyReports, useServicePaymentAction } from '../hooks'
import type { MyReport, ReportServicePayment } from '../types'
import { formatDateShort } from '@/lib/utils/format-date'
import { ReportDetailSheet } from '../components/ReportDetailSheet'

const REPORT_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'รอตรวจสอบ', color: 'var(--warning, #facc15)' },
  verified: { label: 'ยืนยันแล้ว', color: 'var(--danger)' },
  settled: { label: 'ชำระหนี้แล้ว', color: 'var(--accent)' },
}

export function ReportsPage() {
  const [mounted, setMounted] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [reportPage, setReportPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedReport, setSelectedReport] = useState<MyReport | null>(null)
  const [serviceDrawerFraudId, setServiceDrawerFraudId] = useState<string | null>(null)
  const [paymentTarget, setPaymentTarget] = useState<{ service: ServiceItem; fraudId: string } | null>(null)
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null)

  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setReportPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data: reportsData, isLoading } = useMyReports(reportPage, debouncedSearch, statusFilter)
  const { mutate: doAction, isPending: actionPending } = useServicePaymentAction()

  if (!mounted) return null

  if (!isLoggedIn) {
    return (
      <>
        <section className="flex-1 flex items-center justify-center px-4">
          <div className="card p-8 text-center max-w-sm w-full">
            <AlertTriangle className="w-10 h-10 mx-auto mb-4" style={{ color: 'var(--accent)' }} />
            <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>ต้องเข้าสู่ระบบก่อน</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>กรุณาเข้าสู่ระบบเพื่อดูรายงาน</p>
            <button className="btn btn-primary btn-lg w-full" onClick={() => setShowLogin(true)}>เข้าสู่ระบบ</button>
          </div>
        </section>
        <LoginModal open={showLogin} onOpenChange={setShowLogin} />
      </>
    )
  }

  const reports = reportsData?.data || []
  const meta = reportsData?.meta

  const handleAction = (id: string, action: 'pause' | 'resume' | 'cancel') => {
    if (action === 'cancel') {
      setConfirmCancel(id)
      return
    }
    doAction({ id, action })
  }

  return (
    <section className="w-full max-w-lg mx-auto px-4 py-8">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeft className="w-4 h-4" />แดชบอร์ด
      </Link>

      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
          รายงานที่ลงไว้
        </h1>
        {meta && (
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {meta.total} รายการ
          </span>
        )}
      </div>

      {/* Search */}
      <div className="mb-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="ค้นหาชื่อ เบอร์ หรือเลขบัญชี..."
        />
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-4">
        {[
          { value: '', label: 'ทั้งหมด' },
          { value: 'verified', label: 'ยืนยันแล้ว' },
          { value: 'settled', label: 'ชำระหนี้แล้ว' },
          { value: 'pending', label: 'รอตรวจสอบ' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => { setStatusFilter(f.value); setReportPage(1) }}
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: statusFilter === f.value ? 'var(--accent-dim)' : 'var(--bg-input)',
              color: statusFilter === f.value ? 'var(--accent)' : 'var(--text-muted)',
              border: statusFilter === f.value ? '1px solid var(--accent)' : '1px solid transparent',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : reports.length === 0 ? (
        <div className="card p-8 text-center">
          <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-dim)' }} />
          {debouncedSearch || statusFilter ? (
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>ไม่พบรายงานที่ตรงกัน</p>
          ) : (
            <>
              <p className="text-sm mb-4" style={{ color: 'var(--text-dim)' }}>ยังไม่มีรายงาน</p>
              <Link href="/report" className="btn btn-primary">แจ้งรายงานใหม่</Link>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {reports.map((r) => (
              <ReportCard
                key={r.id}
                report={r}
                confirmCancel={confirmCancel}
                actionPending={actionPending}
                onOpenDetail={() => setSelectedReport(r)}
                onOpenServiceDrawer={() => setServiceDrawerFraudId(r.fraudId)}
                onAction={handleAction}
                onConfirmCancel={(id) => { doAction({ id, action: 'cancel' }); setConfirmCancel(null) }}
                onDismissCancel={() => setConfirmCancel(null)}
              />
            ))}
          </div>
          {meta && (
            <Pagination page={reportPage} totalPages={meta.totalPages} onPageChange={setReportPage} />
          )}
        </>
      )}

      {/* Report Detail Sheet — กดที่ card เปิด sheet/drawer แสดงรายละเอียดเต็ม */}
      <ReportDetailSheet
        report={selectedReport}
        open={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        robotButton={selectedReport && (
          <RobotButton
            sp={selectedReport.servicePayment}
            reportStatus={selectedReport.status}
            confirmCancel={confirmCancel}
            actionPending={actionPending}
            onOpenServiceDrawer={() => {
              setServiceDrawerFraudId(selectedReport.fraudId)
              setSelectedReport(null)
            }}
            onAction={handleAction}
            onConfirmCancel={(id) => { doAction({ id, action: 'cancel' }); setConfirmCancel(null) }}
            onDismissCancel={() => setConfirmCancel(null)}
          />
        )}
      />

      {/* Service Detail Drawer */}
      <ServiceDetailDrawer
        open={!!serviceDrawerFraudId}
        onClose={() => setServiceDrawerFraudId(null)}
        onSelectService={(service) => {
          const fraudId = serviceDrawerFraudId || ''
          setServiceDrawerFraudId(null)
          setTimeout(() => setPaymentTarget({ service, fraudId }), 150)
        }}
      />

      {/* Payment Drawer */}
      <PaymentDrawer
        service={paymentTarget?.service || null}
        open={!!paymentTarget}
        onClose={() => setPaymentTarget(null)}
        fraudId={paymentTarget?.fraudId}
      />
    </section>
  )
}

// === Sub-components ===

function ReportCard({ report, confirmCancel, actionPending, onOpenDetail, onOpenServiceDrawer, onAction, onConfirmCancel, onDismissCancel }: {
  report: MyReport
  confirmCancel: string | null
  actionPending: boolean
  onOpenDetail: () => void
  onOpenServiceDrawer: () => void
  onAction: (id: string, action: 'pause' | 'resume' | 'cancel') => void
  onConfirmCancel: (id: string) => void
  onDismissCancel: () => void
}) {
  const r = report
  const rs = REPORT_STATUS[r.status] || REPORT_STATUS.pending
  const sp = r.servicePayment

  return (
    <div className="card overflow-hidden">
      <div className="flex">
        {/* Left: report info — กดเปิด detail sheet */}
        <button className="flex-1 p-4 text-left min-w-0" onClick={onOpenDetail}>
          <div className="font-bold text-lg truncate" style={{ color: 'var(--text)' }}>
            {[r.firstName, r.lastName].filter(Boolean).join(' ') || 'ไม่ระบุชื่อ'}
          </div>
          {r.refCode && (
            <div className="text-sm font-mono mt-0.5" style={{ color: 'var(--accent)' }}>{r.refCode}</div>
          )}
          <div className="flex items-center gap-2 text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
            <span>{formatDateShort(r.createdAt)}</span>
            <span className="flex items-center gap-1">
              {r.status === 'verified' ? <BadgeCheck className="w-3.5 h-3.5" /> : r.status === 'settled' ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
              {rs.label}
            </span>
          </div>
        </button>

        {/* Right: AI Robot button — คงอยู่ใน card เหมือนเดิม */}
        <div className="flex-shrink-0 flex items-center justify-center" style={{ borderLeft: '1px solid var(--border, rgba(255,255,255,0.06))', width: 90 }}>
          <RobotButton
            sp={sp}
            reportStatus={r.status}
            confirmCancel={confirmCancel}
            actionPending={actionPending}
            onOpenServiceDrawer={onOpenServiceDrawer}
            onAction={onAction}
            onConfirmCancel={onConfirmCancel}
            onDismissCancel={onDismissCancel}
          />
        </div>
      </div>
    </div>
  )
}

function RobotButton({ sp, reportStatus, confirmCancel, actionPending, onOpenServiceDrawer, onAction, onConfirmCancel, onDismissCancel }: {
  sp?: ReportServicePayment | null
  reportStatus?: string
  confirmCancel: string | null
  actionPending: boolean
  onOpenServiceDrawer: () => void
  onAction: (id: string, action: 'pause' | 'resume' | 'cancel') => void
  onConfirmCancel: (id: string) => void
  onDismissCancel: () => void
}) {
  // settled → disabled + แสดง "ได้เงินคืนแล้ว"
  if (reportStatus === 'settled') {
    return (
      <div className="flex flex-col items-center gap-1.5 py-2 px-3 rounded-xl" style={{ opacity: 0.4 }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ border: '2px solid var(--accent)' }}>
          <Bot className="w-7 h-7" style={{ color: 'var(--accent)' }} />
        </div>
        <span className="text-xs font-medium leading-tight text-center" style={{ color: 'var(--accent)' }}>ได้เงินคืนแล้ว</span>
      </div>
    )
  }

  if (!sp) {
    return (
      <button className="flex flex-col items-center gap-1.5 py-2 px-3 rounded-xl" onClick={onOpenServiceDrawer}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ border: '2px solid var(--text-dim)', opacity: 0.5 }}>
          <Bot className="w-7 h-7" style={{ color: 'var(--text-dim)' }} />
        </div>
        <span className="text-xs font-medium leading-tight" style={{ color: 'var(--text-dim)' }}>จ้าง AI</span>
      </button>
    )
  }

  if (confirmCancel === sp.id) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-2 px-3 rounded-xl" style={{ background: 'rgba(248,113,113,0.1)' }}>
        <p className="text-[10px] font-bold" style={{ color: 'var(--danger)' }}>ยกเลิก?</p>
        <div className="flex gap-1">
          <button className="text-[10px] px-2.5 py-1 rounded-md font-bold" style={{ background: 'var(--danger)', color: '#fff' }}
            onClick={() => onConfirmCancel(sp.id)} disabled={actionPending}>ใช่</button>
          <button className="text-[10px] px-2.5 py-1 rounded-md font-bold" style={{ background: 'var(--surface-2, var(--card-bg))', color: 'var(--text-muted)' }}
            onClick={onDismissCancel}>ไม่</button>
        </div>
      </div>
    )
  }

  const config = getRobotConfig(sp.status)

  return (
    <div className="flex flex-col items-center gap-1.5 py-2 px-3 rounded-xl">
      <div className={`w-14 h-14 rounded-full flex items-center justify-center ${config.animate ? 'animate-pulse' : ''}`}
        style={{ border: `2px solid ${config.borderColor}` }}>
        <Bot className="w-7 h-7" style={{ color: config.iconColor }} />
      </div>
      <span className="text-xs font-bold leading-tight" style={{ color: config.textColor }}>{config.label}</span>
      {config.actions.length > 0 && (
        <div className="flex gap-1">
          {config.actions.map((action) => (
            <button key={action.type} className="p-1 rounded-md transition-colors" style={{ color: action.color }}
              title={action.title} onClick={() => onAction(sp.id, action.type)} disabled={actionPending}>
              <action.icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type ActionBtn = { type: 'pause' | 'resume' | 'cancel'; icon: typeof Pause; title: string; color: string }

function getRobotConfig(status: string) {
  switch (status) {
    case 'approved':
      return { label: 'กำลังทำงาน', iconColor: 'var(--accent)', borderColor: 'var(--accent)', textColor: 'var(--accent)', animate: true,
        actions: [
          { type: 'pause' as const, icon: Pause, title: 'หยุดชั่วคราว', color: 'var(--warning, #facc15)' },
          { type: 'cancel' as const, icon: Trash2, title: 'ยกเลิก', color: 'var(--danger)' },
        ] }
    case 'paused':
      return { label: 'หยุดชั่วคราว', iconColor: 'var(--warning, #facc15)', borderColor: 'var(--warning, #facc15)', textColor: 'var(--warning, #facc15)', animate: false,
        actions: [
          { type: 'resume' as const, icon: Play, title: 'เริ่มต่อ', color: 'var(--accent)' },
          { type: 'cancel' as const, icon: Trash2, title: 'ยกเลิก', color: 'var(--danger)' },
        ] }
    case 'pending':
      return { label: 'รอตรวจสลิป', iconColor: 'var(--warning, #facc15)', borderColor: 'var(--warning, #facc15)', textColor: 'var(--warning, #facc15)', animate: false, actions: [] as ActionBtn[] }
    case 'cancelled':
      return { label: 'ยกเลิกแล้ว', iconColor: 'var(--text-dim)', borderColor: 'var(--text-dim)', textColor: 'var(--text-dim)', animate: false, actions: [] as ActionBtn[] }
    case 'rejected':
      return { label: 'สลิปไม่ผ่าน', iconColor: 'var(--danger)', borderColor: 'var(--danger)', textColor: 'var(--danger)', animate: false, actions: [] as ActionBtn[] }
    default:
      return { label: status, iconColor: 'var(--text-dim)', borderColor: 'var(--text-dim)', textColor: 'var(--text-dim)', animate: false, actions: [] as ActionBtn[] }
  }
}

