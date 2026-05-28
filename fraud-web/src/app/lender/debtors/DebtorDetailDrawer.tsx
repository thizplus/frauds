'use client'

import { useState, useEffect } from 'react'
import { User, Phone, CreditCard, IdCard, MapPin, Globe, ShieldAlert, CheckCircle, Loader2, Search, AlertTriangle, X, Building2, BrainCircuit, Check, Archive } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { useDebtor, useCheckDebtor, useFlagDebtor, useClearDebtor, useDeleteDebtor } from '@/features/lender'
import type { DebtorDetail, CheckResultItem } from '@/features/lender'

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'ปกติ', color: 'var(--accent)', bg: 'rgba(34,197,94,0.1)' },
  flagged: { label: 'ถูกแจ้ง', color: 'var(--danger)', bg: 'rgba(248,113,113,0.1)' },
  cleared: { label: 'ปลดแล้ว', color: 'var(--text-muted)', bg: 'var(--bg-elevated)' },
  archived: { label: 'ถังขยะ', color: 'var(--text-dim)', bg: 'var(--bg-elevated)' },
}

interface DebtorDetailDrawerProps {
  debtorId: string | null
  open: boolean
  onClose: () => void
}

export function DebtorDetailDrawer({ debtorId, open, onClose }: DebtorDetailDrawerProps) {
  const { data: debtor, isLoading } = useDebtor(open ? debtorId : null)
  const checkMutation = useCheckDebtor()
  const flagMutation = useFlagDebtor()
  const clearMutation = useClearDebtor()
  const archiveMutation = useDeleteDebtor()

  const [flagDialog, setFlagDialog] = useState(false)
  const [clearDialog, setClearDialog] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanStep, setScanStep] = useState(0)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanElapsed, setScanElapsed] = useState(0)

  const scanSteps = [
    { label: 'ค้นหาในระบบ' },
    { label: 'เช็คฐานข้อมูล' },
    { label: 'สรุปผล' },
  ]

  useEffect(() => {
    if (!scanning) { setScanElapsed(0); return }
    const start = performance.now()
    const id = setInterval(() => {
      setScanElapsed(+((performance.now() - start) / 1000).toFixed(1))
    }, 100)
    return () => clearInterval(id)
  }, [scanning])

  const handleCheck = async () => {
    setScanning(true)
    setScanStep(0)
    setScanProgress(0)

    const stepDelays = [1500, 2000, 1500] // รวม ~5 วินาที
    for (let i = 0; i < 3; i++) {
      setScanStep(i)
      setScanProgress(((i + 1) / 3) * 100)
      await new Promise(r => setTimeout(r, stepDelays[i]))
    }

    checkMutation.mutate(debtorId!, {
      onSettled: () => {
        setScanning(false)
      }
    })
  }

  const st = debtor ? (STATUS_MAP[debtor.status] || STATUS_MAP.active) : STATUS_MAP.active
  const checkResults: CheckResultItem[] = debtor?.checkResult || []

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={debtor && (
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
              {[debtor.firstName, debtor.lastName].filter(Boolean).join(' ')}
            </h2>
            <span className="text-xs font-bold" style={{ color: st.color }}>{st.label}</span>
          </div>
        )}
      >
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} />
          </div>
        ) : !debtor ? (
          <p className="text-center py-12" style={{ color: 'var(--text-muted)' }}>ไม่พบข้อมูล</p>
        ) : (
          <div className="space-y-5">

            {/* Primary action */}
            {!debtor.checkedAt ? (
              <button
                className="btn btn-primary btn-lg w-full"
                onClick={handleCheck}
                disabled={checkMutation.isPending || scanning}
              >
                {(checkMutation.isPending || scanning) ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                ตรวจสอบประวัติ
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  className="btn btn-secondary btn-lg flex-1"
                  onClick={handleCheck}
                  disabled={checkMutation.isPending || scanning}
                >
                  {(checkMutation.isPending || scanning) ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  ตรวจซ้ำ
                </button>
                {(debtor.status === 'active' || debtor.status === 'cleared') && (
                  <button
                    className="btn btn-lg flex-1"
                    style={{ background: 'var(--danger)', color: '#fff' }}
                    onClick={() => setFlagDialog(true)}
                  >
                    <ShieldAlert className="w-5 h-5" /> แจ้งเตือน
                  </button>
                )}
                {debtor.status === 'flagged' && (
                  <button
                    className="btn btn-secondary btn-lg flex-1"
                    onClick={() => setClearDialog(true)}
                  >
                    <CheckCircle className="w-5 h-5" /> ปลดแจ้งเตือน
                  </button>
                )}
              </div>
            )}

            {/* Scan Animation */}
            {scanning && (
              <div className="card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 animate-pulse" style={{ color: 'var(--accent)' }} />
                  <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>กำลังตรวจสอบ</span>
                  <span className="text-xs font-mono ml-auto" style={{ color: 'var(--text-dim)' }}>{scanElapsed}s</span>
                </div>
                {/* Progress bar */}
                <div style={{ height: 3, background: 'var(--bg-input)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${scanProgress}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.5s' }} />
                </div>
                {/* Steps */}
                <div className="space-y-2">
                  {scanSteps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {i < scanStep ? (
                        <Check className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                      ) : i === scanStep ? (
                        <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent)' }} />
                      ) : (
                        <span className="w-4 h-4 flex items-center justify-center">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--text-dim)' }} />
                        </span>
                      )}
                      <span style={{ color: i <= scanStep ? 'var(--text)' : 'var(--text-dim)' }}>{step.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ข้อมูลบุคคล */}
            <div>
              <SectionTitle>ข้อมูลบุคคล</SectionTitle>
              <div className="card p-3 space-y-3">
                <InfoRow icon={User} label="ชื่อ-นามสกุล" value={[debtor.firstName, debtor.lastName].filter(Boolean).join(' ')} />
                {debtor.phone && <InfoRow icon={Phone} label="เบอร์โทร" value={debtor.phone} mono />}
                {debtor.bankAccount && <InfoRow icon={CreditCard} label="เลขบัญชี" value={debtor.bankAccount} mono />}
                {debtor.bankName && <InfoRow icon={Building2} label="ธนาคาร" value={debtor.bankName} />}
                {debtor.idCard && <InfoRow icon={IdCard} label="เลข ปชช" value={debtor.idCard} mono />}
                {debtor.address && <InfoRow icon={MapPin} label="ที่อยู่" value={debtor.address} />}
                {debtor.socialAccounts && debtor.socialAccounts.length > 0 && (
                  <InfoRow icon={Globe} label="Social" value={debtor.socialAccounts.join(', ')} />
                )}
              </div>
            </div>

            {/* รูปภาพ */}
            {(debtor.selfieImage || debtor.idCardImage) && (
              <div>
                <SectionTitle>รูปภาพ</SectionTitle>
                <div className="grid grid-cols-2 gap-2">
                  {debtor.selfieImage && (
                    <div>
                      <p className="text-xs mb-1" style={{ color: 'var(--text-dim)' }}>เซลฟี่</p>
                      <img src={debtor.selfieImage} alt="Selfie" className="w-full rounded-lg" style={{ border: '1px solid var(--border)' }} />
                    </div>
                  )}
                  {debtor.idCardImage && (
                    <div>
                      <p className="text-xs mb-1" style={{ color: 'var(--text-dim)' }}>บัตรประชาชน</p>
                      <img src={debtor.idCardImage} alt="ID Card" className="w-full rounded-lg" style={{ border: '1px solid var(--border)' }} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ผลเช็คประวัติ */}
            {debtor.checkedAt && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <SectionTitle>
                    ผลตรวจสอบประวัติ
                    <span className="text-xs font-normal" style={{ color: 'var(--text-dim)' }}>
                      {' '}({new Date(debtor.checkedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })})
                    </span>
                  </SectionTitle>
                  {debtor.status !== 'archived' && !confirmArchive && (
                    <button
                      className="text-xs flex items-center gap-1"
                      style={{ color: 'var(--text-dim)' }}
                      onClick={() => setConfirmArchive(true)}
                    >
                      <Archive className="w-3.5 h-3.5" /> ซ่อนรายชื่อนี้
                    </button>
                  )}
                  {confirmArchive && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: 'var(--danger)' }}>ซ่อน?</span>
                      <button
                        className="text-xs font-bold px-2.5 py-1 rounded-md"
                        style={{ background: 'var(--danger)', color: '#fff' }}
                        onClick={() => archiveMutation.mutate(debtorId!, { onSuccess: onClose })}
                        disabled={archiveMutation.isPending}
                      >ใช่</button>
                      <button
                        className="text-xs font-bold px-2.5 py-1 rounded-md"
                        style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                        onClick={() => setConfirmArchive(false)}
                      >ไม่</button>
                    </div>
                  )}
                </div>
                {checkResults.length === 0 ? (
                  <div className="card p-3">
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>ไม่พบข้อมูลในระบบ</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>พบ {checkResults.length} รายการ</p>
                    {checkResults.map((r, i) => (
                      <div key={i} className="card p-3 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium" style={{ color: 'var(--text)' }}>
                            {r.source === 'fraud_report' ? 'รายงานจากผู้ใช้' : r.source}
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

            {/* ประวัติการแจ้งเตือน — แสดงเมื่อเคย flagged (มี flaggedAt) */}
            {debtor.flaggedAt && (
              <div>
                <SectionTitle>ประวัติการแจ้งเตือน</SectionTitle>
                <div className="card p-3 space-y-2">
                  {/* ข้อมูลตอนแจ้ง */}
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
                    <div className="text-sm">
                      <span style={{ color: 'var(--danger)' }}>แจ้งเตือนเมื่อ </span>
                      <span style={{ color: 'var(--text)' }}>
                        {new Date(debtor.flaggedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </span>
                      {debtor.flaggedReason && <span style={{ color: 'var(--text-muted)' }}> • {debtor.flaggedReason}</span>}
                      {debtor.flaggedAmount ? <span style={{ color: 'var(--text-muted)' }}> • {(debtor.flaggedAmount / 100).toLocaleString()} บาท</span> : null}
                    </div>
                  </div>
                  {debtor.flaggedDetail && (
                    <p className="text-sm pl-6" style={{ color: 'var(--text-muted)' }}>{debtor.flaggedDetail}</p>
                  )}
                  {/* ข้อมูลตอนปลด (ถ้ามี) */}
                  {debtor.clearedAt && (
                    <div className="flex items-start gap-2 pt-1" style={{ borderTop: '1px solid var(--border, rgba(255,255,255,0.06))' }}>
                      <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
                      <div className="text-sm">
                        <span style={{ color: 'var(--accent)' }}>ปลดแจ้งเตือนเมื่อ </span>
                        <span style={{ color: 'var(--text)' }}>
                          {new Date(debtor.clearedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </span>
                        {debtor.clearedNote && <span style={{ color: 'var(--text-muted)' }}> • {debtor.clearedNote}</span>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Note */}
            {debtor.note && (
              <div>
                <SectionTitle>หมายเหตุ</SectionTitle>
                <div className="card p-3">
                  <p className="text-sm" style={{ color: 'var(--text)' }}>{debtor.note}</p>
                </div>
              </div>
            )}

          </div>
        )}
      </Drawer>

      {/* Flag Dialog */}
      {flagDialog && debtorId && debtor && (
        <FlagDialog
          name={[debtor.firstName, debtor.lastName].filter(Boolean).join(' ')}
          onClose={() => setFlagDialog(false)}
          onSubmit={(data) => {
            flagMutation.mutate({ id: debtorId, ...data }, {
              onSuccess: () => setFlagDialog(false),
            })
          }}
          loading={flagMutation.isPending}
        />
      )}

      {/* Clear Dialog */}
      {clearDialog && debtorId && debtor && (
        <ClearDialog
          name={[debtor.firstName, debtor.lastName].filter(Boolean).join(' ')}
          onClose={() => setClearDialog(false)}
          onSubmit={(note) => {
            clearMutation.mutate({ id: debtorId, note }, {
              onSuccess: () => setClearDialog(false),
            })
          }}
          loading={clearMutation.isPending}
        />
      )}
    </>
  )
}

// === Sub-components ===

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-sm font-bold mb-1.5" style={{ color: 'var(--text-muted)' }}>
      {children}
    </div>
  )
}

function InfoRow({ icon: Icon, label, value, mono }: { icon: typeof User; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2 text-sm flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
        <Icon className="w-4 h-4" />
        {label}
      </div>
      <span className={`text-sm text-right ${mono ? 'font-mono' : ''}`} style={{ color: 'var(--text)', wordBreak: 'break-all' }}>
        {value}
      </span>
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
    <Drawer open={true} onClose={onClose} title={
      <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>แจ้งเตือน "{name}"</h3>
    }>
      <div className="space-y-4">
        <div>
          <label className="report-label">เหตุผล <span style={{ color: 'var(--danger)' }}>*</span></label>
          <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
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
          <input type="number" className="input font-mono" placeholder="เช่น 20000" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="report-label">รายละเอียดเพิ่มเติม</label>
          <textarea className="textarea" rows={3} placeholder="อธิบายเหตุการณ์..." value={detail} onChange={(e) => setDetail(e.target.value)} />
        </div>
        <div className="p-3 rounded-lg text-xs" style={{ background: 'rgba(248,113,113,0.1)', color: 'var(--danger)' }}>
          <AlertTriangle className="w-4 h-4 inline mr-1" />
          ข้อมูลจะถูกเผยแพร่ในระบบค้นหาทันทีหลังยืนยัน
        </div>
        <button className="btn btn-lg w-full" style={{ background: 'var(--danger)', color: '#fff' }}
          disabled={!reason || loading}
          onClick={() => onSubmit({ reason, amount: amount ? Math.round(parseFloat(amount) * 100) : undefined, detail })}>
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldAlert className="w-5 h-5" />}
          ยืนยันแจ้งเตือน
        </button>
      </div>
    </Drawer>
  )
}

function ClearDialog({ name, onClose, onSubmit, loading }: {
  name: string; onClose: () => void; onSubmit: (note: string) => void; loading: boolean
}) {
  const [note, setNote] = useState('')

  return (
    <Drawer open={true} onClose={onClose} title={
      <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>ปลดแจ้งเตือน "{name}"</h3>
    }>
      <div className="space-y-4">
        <div>
          <label className="report-label">หมายเหตุ</label>
          <textarea className="textarea" rows={3} placeholder="เช่น ชดใช้ครบแล้ว" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-lg w-full" disabled={loading} onClick={() => onSubmit(note)}>
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
          ยืนยันปลดแจ้งเตือน
        </button>
      </div>
    </Drawer>
  )
}
