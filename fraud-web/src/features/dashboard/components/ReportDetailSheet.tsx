'use client'

import { useState } from 'react'
import { X, BadgeCheck, Clock, User, Phone, CreditCard, Building2, IdCard, MessageSquare, FileText, Calendar, Hash, Image, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'
import type { MyReport } from '../types'

interface ReportDetailSheetProps {
  report: MyReport | null
  open: boolean
  onClose: () => void
  /** Robot button — render ข้างใน sheet */
  robotButton?: React.ReactNode
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function parseEvidenceUrls(raw?: string): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    if (typeof parsed === 'string') return [parsed]
  } catch {
    if (raw.startsWith('http')) return [raw]
  }
  return []
}

export function ReportDetailSheet({ report, open, onClose, robotButton }: ReportDetailSheetProps) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  if (!open || !report) return null

  const r = report
  const isVerified = r.status === 'verified'
  const fullName = [r.firstName, r.lastName].filter(Boolean).join(' ') || 'ไม่ระบุชื่อ'
  const evidenceUrls = parseEvidenceUrls(r.evidenceUrl)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet — desktop: slide จากขวา, mobile: slide จากล่าง */}
      <div className="report-detail-sheet">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>รายละเอียดรายงาน</h2>
            <span className="text-xs font-mono" style={{ color: 'var(--accent)' }}>{r.refCode}</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: 'var(--text-muted)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Status + Category badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
              style={{
                background: isVerified ? 'rgba(34,197,94,0.1)' : 'rgba(250,204,21,0.1)',
                color: isVerified ? 'var(--accent)' : 'var(--warning, #facc15)',
              }}
            >
              {isVerified ? <BadgeCheck className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
              {isVerified ? 'ยืนยันแล้ว' : 'รอตรวจสอบ'}
            </span>
            {r.categoryName && (
              <span
                className="text-xs font-medium px-2.5 py-1 rounded-full"
                style={{ background: 'var(--surface-2, rgba(255,255,255,0.05))', color: 'var(--text-muted)' }}
              >
                {r.categoryName}
              </span>
            )}
          </div>

          {/* ข้อมูลบุคคล */}
          <div className="space-y-0.5">
            <SectionTitle>ข้อมูลบุคคล</SectionTitle>
            <div className="card p-3 space-y-3">
              <DetailRow icon={User} label="ชื่อ-นามสกุล" value={fullName} />
              {r.phone && <DetailRow icon={Phone} label="เบอร์โทร" value={r.phone} mono />}
              {r.bankAccount && <DetailRow icon={CreditCard} label="เลขบัญชี" value={r.bankAccount} mono />}
              {r.bankName && <DetailRow icon={Building2} label="ธนาคาร" value={r.bankName} />}
              {r.idCard && <DetailRow icon={IdCard} label="เลขบัตร" value={r.idCard} mono />}
              {r.socialAccounts && r.socialAccounts.length > 0 && (
                <DetailRow icon={MessageSquare} label="Social" value={r.socialAccounts.join(', ')} />
              )}
            </div>
          </div>

          {/* หมายเหตุ */}
          {r.reporterNote && (
            <div className="space-y-0.5">
              <SectionTitle>หมายเหตุจากผู้แจ้ง</SectionTitle>
              <div className="card p-3">
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{r.reporterNote}</p>
              </div>
            </div>
          )}

          {/* ภาพหลักฐาน */}
          {evidenceUrls.length > 0 && (
            <div className="space-y-0.5">
              <SectionTitle>
                <Image className="w-4 h-4" />
                ภาพหลักฐาน ({evidenceUrls.length})
              </SectionTitle>
              <div className="grid grid-cols-3 gap-2">
                {evidenceUrls.map((url, i) => (
                  <button
                    key={i}
                    className="aspect-square rounded-lg overflow-hidden border"
                    style={{ borderColor: 'var(--border, rgba(255,255,255,0.08))' }}
                    onClick={() => setLightboxIdx(i)}
                  >
                    <img
                      src={url}
                      alt={`หลักฐาน ${i + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ข้อมูลอ้างอิง */}
          <div className="space-y-0.5">
            <SectionTitle>ข้อมูลอ้างอิง</SectionTitle>
            <div className="card p-3 space-y-3">
              <DetailRow icon={Hash} label="รหัสอ้างอิง" value={r.refCode} mono accent />
              <DetailRow icon={Calendar} label="วันที่แจ้ง" value={formatDate(r.createdAt)} />
            </div>
          </div>

          {/* บริการ AI — Robot button */}
          {robotButton && (
            <div className="space-y-0.5">
              <SectionTitle>บริการ AI</SectionTitle>
              <div className="card p-4 flex items-center justify-center">
                {robotButton}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && evidenceUrls[lightboxIdx] && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center" onClick={() => setLightboxIdx(null)}>
          <img
            src={evidenceUrls[lightboxIdx]}
            alt="หลักฐาน"
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <button className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white" onClick={() => setLightboxIdx(null)}>
            <X className="w-6 h-6" />
          </button>
          {evidenceUrls.length > 1 && (
            <>
              {lightboxIdx > 0 && (
                <button className="absolute left-4 p-2 rounded-full bg-black/50 text-white" onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1) }}>
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}
              {lightboxIdx < evidenceUrls.length - 1 && (
                <button className="absolute right-4 p-2 rounded-full bg-black/50 text-white" onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1) }}>
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
              <div className="absolute bottom-4 text-white text-sm font-medium">
                {lightboxIdx + 1} / {evidenceUrls.length}
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}

// === Sub-components ===

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-dim)' }}>
      {children}
    </div>
  )
}

function DetailRow({ icon: Icon, label, value, mono, accent }: {
  icon: typeof User; label: string; value: string; mono?: boolean; accent?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2 text-sm flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
        <Icon className="w-4 h-4" />
        {label}
      </div>
      <span
        className={`text-sm text-right ${mono ? 'font-mono' : ''}`}
        style={{ color: accent ? 'var(--accent)' : 'var(--text)' }}
      >
        {value}
      </span>
    </div>
  )
}
