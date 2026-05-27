'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, User, Phone, CreditCard, IdCard, MapPin, Globe, ShieldAlert, CheckCircle, Loader2, Search, AlertTriangle, X } from 'lucide-react'
import { useAuthStore } from '@/lib/stores/auth'
import { useDebtor, useCheckDebtor, useFlagDebtor, useClearDebtor } from '@/features/lender'
import type { CheckResultItem } from '@/features/lender'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: 'ปกติ', color: 'var(--accent)' },
  flagged: { label: 'โกง', color: 'var(--danger)' },
  cleared: { label: 'ปลดแล้ว', color: 'var(--text-muted)' },
}

export default function DebtorDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [mounted, setMounted] = useState(false)
  const [flagDialog, setFlagDialog] = useState(false)
  const [clearDialog, setClearDialog] = useState(false)

  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  useEffect(() => { setMounted(true) }, [])

  const { data: debtor, isLoading } = useDebtor(mounted && isLoggedIn ? id : null)
  const checkMutation = useCheckDebtor()
  const flagMutation = useFlagDebtor()
  const clearMutation = useClearDebtor()

  if (!mounted || !isLoggedIn) return null

  if (isLoading) {
    return <section className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} /></section>
  }

  if (!debtor) {
    return <section className="flex-1 flex items-center justify-center"><p style={{ color: 'var(--text-muted)' }}>ไม่พบข้อมูล</p></section>
  }

  const st = STATUS_MAP[debtor.status] || STATUS_MAP.active
  const checkResults: CheckResultItem[] = debtor.checkResult || []

  return (
    <section className="w-full max-w-lg mx-auto px-4 py-8">
      <Link href="/lender/debtors" className="inline-flex items-center gap-1.5 text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeft className="w-4 h-4" />รายชื่อสมาชิก
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text)' }}>
            {[debtor.firstName, debtor.lastName].filter(Boolean).join(' ')}
          </h1>
          <span className="text-sm font-bold" style={{ color: st.color }}>{st.label}</span>
        </div>
        <button className="btn btn-secondary" onClick={() => checkMutation.mutate(id)} disabled={checkMutation.isPending}>
          {checkMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          เช็คประวัติ
        </button>
      </div>

      {/* Info */}
      <div className="card p-4 mb-4 space-y-3">
        {debtor.phone && <InfoRow icon={Phone} label="เบอร์โทร" value={debtor.phone} mono />}
        {debtor.idCard && <InfoRow icon={IdCard} label="เลข ปชช" value={debtor.idCard} mono />}
        {debtor.bankAccount && <InfoRow icon={CreditCard} label="เลขบัญชี" value={`${debtor.bankAccount}${debtor.bankName ? ` (${debtor.bankName})` : ''}`} mono />}
        {debtor.address && <InfoRow icon={MapPin} label="ที่อยู่" value={debtor.address} />}
        {debtor.socialAccounts && debtor.socialAccounts.length > 0 && (
          <InfoRow icon={Globe} label="Social" value={debtor.socialAccounts.join(', ')} />
        )}
      </div>

      {/* Check results */}
      {debtor.checkedAt && (
        <div className="card p-4 mb-4">
          <p className="text-sm font-bold mb-2" style={{ color: 'var(--text)' }}>
            ผลเช็คประวัติ <span className="font-normal text-xs" style={{ color: 'var(--text-dim)' }}>
              (เช็คเมื่อ {new Date(debtor.checkedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })})
            </span>
          </p>
          {checkResults.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>ไม่พบข้อมูลในระบบ</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>พบ {checkResults.length} รายการ</p>
              {checkResults.map((r, i) => (
                <div key={i} className="rounded-lg p-3 text-sm" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium" style={{ color: 'var(--text)' }}>
                      {r.source === 'fraud_report' ? 'รายงานจากผู้ใช้' : r.source === 'lender_flag' ? 'แจ้งโดยผู้ใช้ในระบบ' : r.source}
                    </span>
                    {r.verified && <span className="text-xs font-bold" style={{ color: 'var(--danger)' }}>ยืนยันแล้ว</span>}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    match: {r.matchedBy} {r.name && `• ${r.name}`} {r.reportCount ? `• ถูกแจ้ง ${r.reportCount} ครั้ง` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Flag info */}
      {debtor.status === 'flagged' && (
        <div className="card p-4 mb-4" style={{ borderColor: 'var(--danger)' }}>
          <p className="text-sm font-bold mb-1 flex items-center gap-1.5" style={{ color: 'var(--danger)' }}>
            <ShieldAlert className="w-4 h-4" /> แจ้งโกงแล้ว
          </p>
          {debtor.flaggedReason && <p className="text-sm" style={{ color: 'var(--text)' }}>เหตุผล: {debtor.flaggedReason}</p>}
          {debtor.flaggedAmount ? <p className="text-sm" style={{ color: 'var(--text)' }}>จำนวน: {(debtor.flaggedAmount / 100).toLocaleString()} บาท</p> : null}
          {debtor.flaggedDetail && <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{debtor.flaggedDetail}</p>}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {debtor.status === 'active' && (
          <button className="btn btn-lg flex-1" style={{ background: 'var(--danger)', color: '#fff' }}
            onClick={() => setFlagDialog(true)}>
            <ShieldAlert className="w-5 h-5" /> แจ้งว่าคนนี้โกง
          </button>
        )}
        {debtor.status === 'flagged' && (
          <button className="btn btn-secondary btn-lg flex-1" onClick={() => setClearDialog(true)}>
            <CheckCircle className="w-5 h-5" /> ปลดโกง
          </button>
        )}
      </div>

      {/* Flag Dialog */}
      {flagDialog && (
        <FlagDialog
          name={[debtor.firstName, debtor.lastName].filter(Boolean).join(' ')}
          onClose={() => setFlagDialog(false)}
          onSubmit={(data) => {
            flagMutation.mutate({ id, ...data }, { onSuccess: () => setFlagDialog(false) })
          }}
          loading={flagMutation.isPending}
        />
      )}

      {/* Clear Dialog */}
      {clearDialog && (
        <ClearDialog
          name={[debtor.firstName, debtor.lastName].filter(Boolean).join(' ')}
          onClose={() => setClearDialog(false)}
          onSubmit={(note) => {
            clearMutation.mutate({ id, note }, { onSuccess: () => setClearDialog(false) })
          }}
          loading={clearMutation.isPending}
        />
      )}
    </section>
  )
}

function InfoRow({ icon: Icon, label, value, mono }: { icon: typeof User; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-dim)' }} />
      <div>
        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{label}</p>
        <p className={`text-sm ${mono ? 'font-mono' : ''}`} style={{ color: 'var(--text)' }}>{value}</p>
      </div>
    </div>
  )
}

function FlagDialog({ name, onClose, onSubmit, loading }: {
  name: string; onClose: () => void
  onSubmit: (data: { reason: string; amount?: number; detail?: string }) => void
  loading: boolean
}) {
  const [reason, setReason] = useState('')
  const [amount, setAmount] = useState('')
  const [detail, setDetail] = useState('')

  return (
    <>
      <div className="payment-drawer-backdrop" onClick={onClose} />
      <div className="payment-drawer">
        <div className="payment-drawer-header">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>แจ้งว่า "{name}" เป็นคนโกง</h3>
          <button className="btn-ghost btn-icon" onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="payment-drawer-body">
          <div className="space-y-4">
            <div>
              <label className="report-label">เหตุผล <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select className="input" value={reason} onChange={(e) => setReason(e.target.value)} required>
                <option value="">เลือกเหตุผล</option>
                <option value="ไม่จ่ายเงิน">ไม่จ่ายเงิน</option>
                <option value="หนีหนี้">หนีหนี้</option>
                <option value="ไม่ส่งแชร์">ไม่ส่งแชร์</option>
                <option value="ไม่ส่งของ">ไม่ส่งของ</option>
                <option value="หลอกลงทุน">หลอกลงทุน</option>
                <option value="อื่นๆ">อื่นๆ</option>
              </select>
            </div>
            <div>
              <label className="report-label">จำนวนเงิน (บาท)</label>
              <input type="number" className="input font-mono" placeholder="เช่น 20000"
                value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="report-label">รายละเอียดเพิ่มเติม</label>
              <textarea className="textarea" rows={3} placeholder="อธิบายเหตุการณ์..."
                value={detail} onChange={(e) => setDetail(e.target.value)} />
            </div>

            <div className="p-3 rounded-lg text-xs" style={{ background: 'rgba(248,113,113,0.1)', color: 'var(--danger)' }}>
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              ข้อมูลจะถูกเผยแพร่ในระบบค้นหาทันทีหลังยืนยัน
            </div>

            <button className="btn btn-lg w-full" style={{ background: 'var(--danger)', color: '#fff' }}
              disabled={!reason || loading}
              onClick={() => onSubmit({ reason, amount: amount ? Math.round(parseFloat(amount) * 100) : undefined, detail })}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldAlert className="w-5 h-5" />}
              ยืนยันแจ้งโกง
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function ClearDialog({ name, onClose, onSubmit, loading }: {
  name: string; onClose: () => void; onSubmit: (note: string) => void; loading: boolean
}) {
  const [note, setNote] = useState('')

  return (
    <>
      <div className="payment-drawer-backdrop" onClick={onClose} />
      <div className="payment-drawer">
        <div className="payment-drawer-header">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>ปลดโกง "{name}"</h3>
          <button className="btn-ghost btn-icon" onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="payment-drawer-body">
          <div className="space-y-4">
            <div>
              <label className="report-label">หมายเหตุ</label>
              <textarea className="textarea" rows={3} placeholder="เช่น ชดใช้ครบแล้ว"
                value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-lg w-full" disabled={loading}
              onClick={() => onSubmit(note)}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
              ยืนยันปลดโกง
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
