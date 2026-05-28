'use client'

import { useEffect, useState } from 'react'
import { User, BadgeCheck, Phone, CreditCard, IdCard, ShieldAlert, Flag, Lock } from 'lucide-react'
import { formatDateShort } from '@/lib/utils/format-date'
import { Drawer } from '@/components/ui/Drawer'
import { EvidenceGallery } from '@/components/ui/EvidenceGallery'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { searchService } from '@/features/search/service'
import type { FraudResponse, FraudPublicDetail } from '@/features/search/types'
import Link from 'next/link'

interface FraudDetailDrawerProps {
  fraud: FraudResponse | null
  open: boolean
  onClose: () => void
}

export function FraudDetailDrawer({ fraud, open, onClose }: FraudDetailDrawerProps) {
  const { data: subInfo } = useSubscription()
  const isMember = subInfo?.hasSubscription ?? false
  const [detail, setDetail] = useState<FraudPublicDetail | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch detail เมื่อเปิด drawer
  useEffect(() => {
    if (!open || !fraud?.id) {
      setDetail(null)
      return
    }
    setLoading(true)
    searchService.getFraudDetail(fraud.id)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false))
  }, [open, fraud?.id])

  if (!fraud) return null

  const evidenceUrls = detail?.evidenceUrls ?? []

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <>
          <div className="row-avatar" style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--border-accent)' }}>
            <User className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold truncate" style={{ color: 'var(--text)' }}>
                {fraud.name || 'ไม่ทราบชื่อ'}
              </h2>
              {fraud.verified && <BadgeCheck className="w-4 h-4 text-accent flex-shrink-0" />}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>{fraud.categoryName}</div>
          </div>
        </>
      }
      footer={
        <>
          <button onClick={onClose} className="btn btn-secondary flex-1">ปิด</button>
          <Link href="/report" className="btn btn-primary flex-1" onClick={onClose}>
            <Flag className="w-4 h-4" />
            รายงานเพิ่ม
          </Link>
        </>
      }
    >
      {/* Status banner */}
      <div className="ai-status-banner mb-5">
        <div className="ai-status-banner-bg" />
        <div className="relative flex items-start gap-3">
          <span className="ai-status-icon">
            <ShieldAlert className="w-5 h-5" />
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>พบข้อมูลในระบบ</span>
              <span className="ai-status-tag">DETECTED</span>
            </div>
            <p className="text-xs mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>
              ถูกรายงาน <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{fraud.reportCount} ครั้ง</span>
            </p>
          </div>
        </div>
      </div>

      {/* Contact details */}
      <div className="text-xs uppercase tracking-wider mb-2 px-1 font-mono" style={{ color: 'var(--text-dim)' }}>
        ข้อมูลติดต่อ
      </div>

      {fraud.phone && (
        <div className="detail-item">
          <div className="detail-icon"><Phone className="w-4 h-4" /></div>
          <div className="flex-1 min-w-0">
            <div className="detail-label">เบอร์โทร</div>
            <div className="detail-value font-mono">
              {isMember ? fraud.phone : `${fraud.phone.slice(0, 3)}-xxx-${fraud.phone.slice(-4)}`}
            </div>
          </div>
        </div>
      )}

      {fraud.bankAccount && (
        <div className="detail-item">
          <div className="detail-icon"><CreditCard className="w-4 h-4" /></div>
          <div className="flex-1 min-w-0">
            <div className="detail-label">เลขบัญชี{fraud.bankName ? ` · ${fraud.bankName}` : ''}</div>
            <div className="detail-value font-mono">
              {isMember ? fraud.bankAccount : `xxx-x-xxxxx-${fraud.bankAccount.slice(-1)}`}
            </div>
          </div>
        </div>
      )}

      <div className="detail-item">
        <div className="detail-icon"><IdCard className="w-4 h-4" /></div>
        <div className="flex-1 min-w-0">
          <div className="detail-label">บัตรประชาชน</div>
          <div className="detail-value" style={{ color: isMember && fraud.idCard ? 'var(--text)' : 'var(--text-dim)', fontStyle: !fraud.idCard ? 'italic' : 'normal' }}>
            {isMember ? (fraud.idCard || 'ไม่มีข้อมูล') : 'สมาชิกเท่านั้น'}
          </div>
        </div>
      </div>

      {!isMember && (
        <div className="card p-3 mt-4 text-center" style={{ background: 'var(--bg-input)' }}>
          <Lock className="w-4 h-4 mx-auto mb-1" style={{ color: 'var(--accent)' }} />
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            สมัครสมาชิกเพื่อดูข้อมูลเต็ม
          </p>
          <a href="/pricing" className="btn btn-primary btn-sm mt-2" onClick={onClose}>
            สมัครเลย
          </a>
        </div>
      )}

      {/* Evidence Gallery */}
      {loading ? (
        <div className="mt-4">
          <div className="text-xs uppercase tracking-wider mb-2 px-1 font-mono" style={{ color: 'var(--text-dim)' }}>
            หลักฐาน
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="aspect-square rounded-lg animate-pulse" style={{ background: 'var(--bg-elevated)' }} />
            ))}
          </div>
        </div>
      ) : evidenceUrls.length > 0 ? (
        <EvidenceGallery urls={evidenceUrls} isMember={isMember} />
      ) : null}

      {/* Description */}
      {fraud.description && (
        <div className="mt-5">
          <div className="text-xs uppercase tracking-wider mb-2 px-1 font-mono" style={{ color: 'var(--text-dim)' }}>
            รายละเอียด
          </div>
          <div
            className="rounded-lg text-sm leading-relaxed"
            style={{ padding: '.75rem 1rem', background: 'rgba(255,255,255,.03)', color: 'var(--text-secondary)', lineHeight: 1.7 }}
          >
            {fraud.description}
          </div>
        </div>
      )}

      {/* Extra data */}
      {fraud.extraData && Object.keys(fraud.extraData).length > 0 && (
        <div className="mt-5">
          <div className="text-xs uppercase tracking-wider mb-2 px-1 font-mono" style={{ color: 'var(--text-dim)' }}>
            ข้อมูลเพิ่มเติม
          </div>
          <div className="space-y-1">
            {Object.entries(fraud.extraData).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between text-sm px-1">
                <span style={{ color: 'var(--text-muted)' }}>{key}</span>
                <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Created at */}
      <div className="mt-5 text-sm font-mono px-1" style={{ color: 'var(--text-dim)' }}>
        ลงข้อมูล: {formatDateShort(fraud.createdAt)}
      </div>
    </Drawer>
  )
}
