'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, FileText, Clock, BadgeCheck, AlertTriangle, ChevronLeft, ChevronRight, Loader2, Bot, Pause, Play, Trash2, ChevronDown } from 'lucide-react'
import { useAuthStore } from '@/lib/stores/auth'
import { LoginModal } from '@/features/auth'
import { ServiceDetailDrawer, PaymentDrawer } from '@/features/services'
import type { ServiceItem } from '@/features/services'
import { useMyReports, useServicePaymentAction } from '../hooks'
import type { MyReport, ReportServicePayment } from '../types'

const REPORT_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'รอตรวจสอบ', color: 'var(--warning, #facc15)' },
  verified: { label: 'ยืนยันแล้ว', color: 'var(--accent)' },
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
  } catch {
    return dateStr
  }
}

export function ReportsPage() {
  const [mounted, setMounted] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [reportPage, setReportPage] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [serviceDrawerFraudId, setServiceDrawerFraudId] = useState<string | null>(null)
  const [paymentTarget, setPaymentTarget] = useState<{ service: ServiceItem; fraudId: string } | null>(null)
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null)

  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  useEffect(() => { setMounted(true) }, [])

  const { data: reportsData, isLoading } = useMyReports(reportPage)
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

      <h1 className="text-xl font-extrabold tracking-tight mb-1" style={{ color: 'var(--text)' }}>
        รายงานที่ลงไว้
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        {meta ? `ทั้งหมด ${meta.total} รายการ` : ''}
      </p>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : reports.length === 0 ? (
        <div className="card p-8 text-center">
          <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-dim)' }} />
          <p className="text-sm mb-4" style={{ color: 'var(--text-dim)' }}>ยังไม่มีรายงาน</p>
          <Link href="/report" className="btn btn-primary">แจ้งรายงานใหม่</Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {reports.map((r) => (
              <ReportCard
                key={r.id}
                report={r}
                expanded={expandedId === r.id}
                confirmCancel={confirmCancel}
                actionPending={actionPending}
                onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
                onOpenServiceDrawer={() => setServiceDrawerFraudId(r.fraudId)}
                onAction={handleAction}
                onConfirmCancel={(id) => { doAction({ id, action: 'cancel' }); setConfirmCancel(null) }}
                onDismissCancel={() => setConfirmCancel(null)}
              />
            ))}
          </div>
          {meta && meta.totalPages > 1 && (
            <Pagination
              page={reportPage}
              totalPages={meta.totalPages}
              onPrev={() => setReportPage((p) => Math.max(1, p - 1))}
              onNext={() => setReportPage((p) => Math.min(meta.totalPages, p + 1))}
            />
          )}
        </>
      )}

      {/* Service Detail Drawer — อธิบาย service ก่อนชำระเงิน */}
      <ServiceDetailDrawer
        open={!!serviceDrawerFraudId}
        onClose={() => setServiceDrawerFraudId(null)}
        onSelectService={(service) => {
          const fraudId = serviceDrawerFraudId || ''
          setServiceDrawerFraudId(null)
          setTimeout(() => setPaymentTarget({ service, fraudId }), 150)
        }}
      />

      {/* Payment Drawer — ชำระเงิน (เปิดหลังปิด ServiceDetailDrawer) */}
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

function ReportCard({ report, expanded, confirmCancel, actionPending, onToggle, onOpenServiceDrawer, onAction, onConfirmCancel, onDismissCancel }: {
  report: MyReport
  expanded: boolean
  confirmCancel: string | null
  actionPending: boolean
  onToggle: () => void
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
        {/* Left: report info (clickable to expand) */}
        <button className="flex-1 p-4 text-left min-w-0" onClick={onToggle}>
          <div className="font-bold text-lg truncate" style={{ color: 'var(--text)' }}>
            {[r.firstName, r.lastName].filter(Boolean).join(' ') || 'ไม่ระบุชื่อ'}
          </div>
          {r.refCode && (
            <div className="text-sm font-mono mt-0.5" style={{ color: 'var(--accent)' }}>{r.refCode}</div>
          )}
          <div className="flex items-center gap-2 text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
            <span>{formatDate(r.createdAt)}</span>
            <span className="flex items-center gap-1">
              {r.status === 'verified' ? <BadgeCheck className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
              {rs.label}
            </span>
          </div>
        </button>

        {/* Right: AI Robot button */}
        <div className="flex-shrink-0 flex items-center px-2" style={{ borderLeft: '1px solid var(--border, rgba(255,255,255,0.06))' }}>
          <RobotButton
            sp={sp}
            confirmCancel={confirmCancel}
            actionPending={actionPending}
            onOpenServiceDrawer={onOpenServiceDrawer}
            onAction={onAction}
            onConfirmCancel={onConfirmCancel}
            onDismissCancel={onDismissCancel}
          />
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 fade-in" style={{ borderTop: '1px solid var(--border, rgba(255,255,255,0.06))' }}>
          <div className="pt-3 space-y-2.5 text-sm" style={{ color: 'var(--text-muted)' }}>
            {r.firstName && (
              <div className="flex justify-between">
                <span>ชื่อ-นามสกุล</span>
                <span style={{ color: 'var(--text)' }}>{[r.firstName, r.lastName].filter(Boolean).join(' ')}</span>
              </div>
            )}
            {r.phone && (
              <div className="flex justify-between">
                <span>เบอร์โทร</span>
                <span className="font-mono" style={{ color: 'var(--text)' }}>{r.phone}</span>
              </div>
            )}
            {r.bankAccount && (
              <div className="flex justify-between">
                <span>เลขบัญชี</span>
                <span className="font-mono" style={{ color: 'var(--text)' }}>{r.bankAccount}</span>
              </div>
            )}
            {r.refCode && (
              <div className="flex justify-between">
                <span>รหัสอ้างอิง</span>
                <span className="font-mono" style={{ color: 'var(--accent)' }}>{r.refCode}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>วันที่แจ้ง</span>
              <span style={{ color: 'var(--text)' }}>{formatDate(r.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span>สถานะ</span>
              <span style={{ color: rs.color }}>{rs.label}</span>
            </div>
            {sp && (
              <>
                <div className="pt-2 mt-2" style={{ borderTop: '1px solid var(--border, rgba(255,255,255,0.06))' }}>
                  <div className="flex justify-between">
                    <span>บริการ AI</span>
                    <span style={{ color: 'var(--text)' }}>{sp.serviceName}</span>
                  </div>
                </div>
                {sp.refCode && (
                  <div className="flex justify-between">
                    <span>รหัสบริการ</span>
                    <span className="font-mono" style={{ color: 'var(--accent)' }}>{sp.refCode}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function RobotButton({ sp, confirmCancel, actionPending, onOpenServiceDrawer, onAction, onConfirmCancel, onDismissCancel }: {
  sp?: ReportServicePayment | null
  confirmCancel: string | null
  actionPending: boolean
  onOpenServiceDrawer: () => void
  onAction: (id: string, action: 'pause' | 'resume' | 'cancel') => void
  onConfirmCancel: (id: string) => void
  onDismissCancel: () => void
}) {
  // ยังไม่สั่งซื้อ — ปุ่มสั่งซื้อ (เทาๆ)
  if (!sp) {
    return (
      <button
        className="flex flex-col items-center gap-1.5 py-2 px-3 rounded-xl"
        onClick={onOpenServiceDrawer}
      >
        <div className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ border: '2px solid var(--text-dim)', opacity: 0.5 }}>
          <Bot className="w-7 h-7" style={{ color: 'var(--text-dim)' }} />
        </div>
        <span className="text-xs font-medium leading-tight" style={{ color: 'var(--text-dim)' }}>จ้าง AI</span>
      </button>
    )
  }

  // Confirm cancel
  if (confirmCancel === sp.id) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-2 px-3 rounded-xl" style={{ background: 'rgba(248,113,113,0.1)' }}>
        <p className="text-[10px] font-bold" style={{ color: 'var(--danger)' }}>ยกเลิก?</p>
        <div className="flex gap-1">
          <button className="text-[10px] px-2.5 py-1 rounded-md font-bold"
            style={{ background: 'var(--danger)', color: '#fff' }}
            onClick={() => onConfirmCancel(sp.id)} disabled={actionPending}>ใช่</button>
          <button className="text-[10px] px-2.5 py-1 rounded-md font-bold"
            style={{ background: 'var(--surface-2, var(--card-bg))', color: 'var(--text-muted)' }}
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
            <button key={action.type} className="p-1 rounded-md transition-colors"
              style={{ color: action.color }}
              title={action.title}
              onClick={() => onAction(sp.id, action.type)}
              disabled={actionPending}>
              <action.icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type ActionBtn = {
  type: 'pause' | 'resume' | 'cancel'
  icon: typeof Pause
  title: string
  color: string
  bg: string
}

function getRobotConfig(status: string) {
  switch (status) {
    case 'approved':
      return {
        label: 'กำลังทำงาน',
        iconColor: 'var(--accent)',
        borderColor: 'var(--accent)',
        textColor: 'var(--accent)',
        bg: 'var(--accent-dim, rgba(0,0,0,0.05))',
        animate: true,
        actions: [
          { type: 'pause' as const, icon: Pause, title: 'หยุดชั่วคราว', color: 'var(--warning, #facc15)', bg: 'rgba(250,204,21,0.15)' },
          { type: 'cancel' as const, icon: Trash2, title: 'ยกเลิก', color: 'var(--danger)', bg: 'rgba(248,113,113,0.15)' },
        ],
      }
    case 'paused':
      return {
        label: 'หยุดชั่วคราว',
        iconColor: 'var(--warning, #facc15)',
        borderColor: 'var(--warning, #facc15)',
        textColor: 'var(--warning, #facc15)',
        bg: 'rgba(250,204,21,0.06)',
        animate: false,
        actions: [
          { type: 'resume' as const, icon: Play, title: 'เริ่มต่อ', color: 'var(--accent)', bg: 'var(--accent-dim, rgba(0,0,0,0.1))' },
          { type: 'cancel' as const, icon: Trash2, title: 'ยกเลิก', color: 'var(--danger)', bg: 'rgba(248,113,113,0.15)' },
        ],
      }
    case 'pending':
      return {
        label: 'รอตรวจสลิป',
        iconColor: 'var(--warning, #facc15)',
        borderColor: 'var(--warning, #facc15)',
        textColor: 'var(--warning, #facc15)',
        bg: 'rgba(250,204,21,0.06)',
        animate: false,
        actions: [] as ActionBtn[],
      }
    case 'cancelled':
      return {
        label: 'ยกเลิกแล้ว',
        iconColor: 'var(--text-dim)',
        borderColor: 'var(--text-dim)',
        textColor: 'var(--text-dim)',
        bg: 'rgba(0,0,0,0.03)',
        animate: false,
        actions: [] as ActionBtn[],
      }
    case 'rejected':
      return {
        label: 'สลิปไม่ผ่าน',
        iconColor: 'var(--danger)',
        borderColor: 'var(--danger)',
        textColor: 'var(--danger)',
        bg: 'rgba(248,113,113,0.06)',
        animate: false,
        actions: [] as ActionBtn[],
      }
    default:
      return {
        label: status,
        iconColor: 'var(--text-dim)',
        borderColor: 'var(--text-dim)',
        textColor: 'var(--text-dim)',
        bg: 'rgba(0,0,0,0.03)',
        animate: false,
        actions: [] as ActionBtn[],
      }
  }
}

function Pagination({ page, totalPages, onPrev, onNext }: { page: number; totalPages: number; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center justify-center gap-4 mt-3">
      <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={onPrev}>
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{page} / {totalPages}</span>
      <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={onNext}>
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
