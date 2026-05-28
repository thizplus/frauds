'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Users, Copy, Check, AlertTriangle, Loader2, Plus, ArrowLeft, Database, ShieldCheck, Bot, Zap, Settings, X } from 'lucide-react'
import { useAuthStore } from '@/lib/stores/auth'
import { LoginModal } from '@/features/auth'
import { useQueryClient } from '@tanstack/react-query'
import { useLenderProfile, useSetupLender } from '@/features/lender'
import { lenderKeys } from '@/features/lender/hooks'
import { apiClient } from '@/lib/api/client'
import type { FormFieldsConfig } from '@/features/lender'

export default function LenderPage() {
  const [mounted, setMounted] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [copied, setCopied] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  useEffect(() => { setMounted(true) }, [])

  const { data: profile, isLoading, error } = useLenderProfile()
  const hasProfile = !!profile && !error

  if (!mounted) return null

  if (!isLoggedIn) {
    return (
      <>
        <section className="flex-1 flex items-center justify-center px-4">
          <div className="card p-8 text-center max-w-sm w-full">
            <AlertTriangle className="w-10 h-10 mx-auto mb-4" style={{ color: 'var(--accent)' }} />
            <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>ต้องเข้าสู่ระบบก่อน</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>กรุณาเข้าสู่ระบบเพื่อใช้ระบบเก็บข้อมูล</p>
            <button className="btn btn-primary btn-lg w-full" onClick={() => setShowLogin(true)}>เข้าสู่ระบบ</button>
          </div>
        </section>
        <LoginModal open={showLogin} onOpenChange={setShowLogin} />
      </>
    )
  }

  if (isLoading) {
    return <section className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} /></section>
  }

  if (!hasProfile) return <SetupForm />

  const handleCopy = () => {
    navigator.clipboard.writeText(profile.inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="w-full max-w-lg mx-auto px-4 py-8">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeft className="w-4 h-4" />กลับ
      </Link>

      <h1 className="text-2xl font-extrabold tracking-tight mb-1" style={{ color: 'var(--text)' }}>
        ระบบเก็บข้อมูล
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>{profile.businessName}</p>

      {/* Invite link */}
      <div className="card p-4 mb-6">
        <p className="text-base font-medium mb-2" style={{ color: 'var(--text)' }}>ลิงก์ลงทะเบียน</p>
        <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>ส่งลิงก์นี้ให้สมาชิก/ลูกค้าเพื่อกรอกข้อมูล</p>
        <div className="flex gap-2">
          <input type="text" className="input flex-1 text-sm font-mono"
            value={profile.inviteUrl} readOnly onClick={(e) => (e.target as HTMLInputElement).select()} />
          <button className="btn btn-primary px-4" onClick={handleCopy}>
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Menu */}
      <div className="space-y-2">
        <Link href="/lender/debtors" className="card p-4 flex items-center gap-3">
          <Users className="w-6 h-6 flex-shrink-0" style={{ color: 'var(--accent)' }} />
          <span className="flex-1 font-medium text-base" style={{ color: 'var(--text)' }}>รายชื่อสมาชิก</span>
          <span className="text-base" style={{ color: 'var(--text-dim)' }}>→</span>
        </Link>
        <button className="card p-4 flex items-center gap-3 w-full text-left" onClick={() => setSettingsOpen(true)}>
          <Settings className="w-6 h-6 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
          <span className="flex-1 font-medium text-base" style={{ color: 'var(--text)' }}>ตั้งค่าฟอร์มลงทะเบียน</span>
          <span className="text-base" style={{ color: 'var(--text-dim)' }}>→</span>
        </button>
      </div>

      {/* Settings Drawer */}
      <FieldSettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        formFields={profile.formFields}
      />
    </section>
  )
}

function SetupForm() {
  const [businessName, setBusinessName] = useState('')
  const { mutate, isPending } = useSetupLender()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!businessName.trim()) return
    mutate({ businessName: businessName.trim() })
  }

  return (
    <section className="w-full max-w-lg mx-auto px-4 py-8">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeft className="w-4 h-4" />กลับ
      </Link>

      {/* Hero */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--accent-dim)', border: '2px solid var(--accent)' }}>
          <Database className="w-10 h-10" style={{ color: 'var(--accent)' }} />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight mb-2" style={{ color: 'var(--text)' }}>
          ระบบเก็บข้อมูลสมาชิก
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          จัดการข้อมูลสมาชิกในที่เดียว พร้อมระบบตรวจสอบอัตโนมัติ
        </p>
      </div>

      {/* Features */}
      <div className="space-y-3 mb-8">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-dim)' }}>
            <Database className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <div className="font-bold text-base" style={{ color: 'var(--text)' }}>เก็บข้อมูลง่าย</div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>ส่งลิงก์ให้สมาชิกกรอกข้อมูลเอง ไม่ต้องพิมพ์เอง</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-dim)' }}>
            <Zap className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <div className="font-bold text-base" style={{ color: 'var(--text)' }}>แจ้งเตือนได้ทันใจ</div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>กดแจ้งเตือนได้ทันที ข้อมูลเข้าระบบค้นหาอัตโนมัติ</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-dim)' }}>
            <Bot className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <div className="font-bold text-base" style={{ color: 'var(--text)' }}>ตรวจสอบอัตโนมัติ</div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>เช็คประวัติสมาชิกกับฐานข้อมูลและ AI Bot อัตโนมัติ</div>
          </div>
        </div>
      </div>

      {/* Setup form */}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="report-label">ตั้งชื่อระบบ <span style={{ color: 'var(--accent)' }}>*</span></label>
          <input type="text" className="input" placeholder="เช่น ร้านสมชาย, วงแชร์บ้านนาย" required
            value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>ชื่อนี้จะแสดงในหน้าลงทะเบียนของสมาชิก</p>
        </div>

        <button type="submit"
          className="flex items-center gap-4 w-full p-4 rounded-xl"
          style={{ background: 'var(--accent)', color: '#000' }}
          disabled={isPending || !businessName.trim()}
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,0,0,0.15)' }}>
            {isPending ? <Loader2 className="w-7 h-7 animate-spin" /> : <Database className="w-7 h-7" />}
          </div>
          <div className="text-left">
            <div className="text-lg font-extrabold leading-tight">{isPending ? 'กำลังสร้าง...' : 'เปิดระบบเก็บข้อมูล'}</div>
            <div className="text-xs font-medium opacity-80">ฟรี ไม่มีค่าใช้จ่าย</div>
          </div>
        </button>
      </form>
    </section>
  )
}

const FIELD_LABELS: { key: keyof FormFieldsConfig; label: string; description: string }[] = [
  { key: 'lastName', label: 'นามสกุล', description: 'นามสกุลของสมาชิก' },
  { key: 'idCard', label: 'เลขบัตรประชาชน', description: 'เลข 13 หลัก' },
  { key: 'phone', label: 'เบอร์โทรศัพท์', description: 'เบอร์มือถือ' },
  { key: 'bankAccount', label: 'เลขบัญชีธนาคาร', description: 'เลขบัญชีสำหรับโอนเงิน' },
  { key: 'bankName', label: 'ชื่อธนาคาร', description: 'เช่น กสิกรไทย, ไทยพาณิชย์' },
  { key: 'address', label: 'ที่อยู่', description: 'ที่อยู่ปัจจุบัน' },
  { key: 'socialAccounts', label: 'LINE / Social', description: 'LINE ID, Facebook, IG' },
  { key: 'idCardImage', label: 'รูปบัตรประชาชน', description: 'ถ่ายรูปบัตร ปชช' },
  { key: 'selfieImage', label: 'รูปถ่ายตัวเอง', description: 'Selfie ยืนยันตัวตน' },
]

function FieldSettingsDrawer({ open, onClose, formFields }: {
  open: boolean; onClose: () => void; formFields: FormFieldsConfig
}) {
  const [fields, setFields] = useState<FormFieldsConfig>(formFields)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const qc = useQueryClient()

  useEffect(() => {
    if (open) { setFields(formFields); setSaved(false) }
  }, [open, formFields])

  const handleToggle = (key: string) => {
    setFields((prev: any) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await apiClient.put('/lender/profile', { formFields: fields })
      setSaved(true)
      qc.invalidateQueries({ queryKey: lenderKeys.profile() })
      setTimeout(() => onClose(), 500)
    } catch {
      alert('บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <>
      <div className="payment-drawer-backdrop" onClick={onClose} />
      <div className="payment-drawer">
        <div className="payment-drawer-header">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>ตั้งค่าฟอร์มลงทะเบียน</h3>
          <button className="btn-ghost btn-icon" onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="payment-drawer-body">
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            เลือกข้อมูลที่ต้องการเก็บจากสมาชิก (ชื่อเป็นค่าบังคับเสมอ)
          </p>

          {/* ชื่อ — บังคับ */}
          <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
              <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>ชื่อ</div>
              <div className="text-xs" style={{ color: 'var(--text-dim)' }}>บังคับเสมอ</div>
            </div>
            <div className="w-11 h-6 rounded-full" style={{ background: 'var(--accent)', opacity: 0.5 }} />
          </div>

          {/* Toggle fields */}
          {FIELD_LABELS.map((f) => (
            <div key={f.key} className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{f.label}</div>
                <div className="text-xs" style={{ color: 'var(--text-dim)' }}>{f.description}</div>
              </div>
              <button
                className="w-11 h-6 rounded-full relative transition-colors"
                style={{ background: (fields as any)[f.key] ? 'var(--accent)' : 'var(--bg-input)' }}
                onClick={() => handleToggle(f.key)}
              >
                <div className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all"
                  style={{ left: (fields as any)[f.key] ? '22px' : '2px' }} />
              </button>
            </div>
          ))}

          <button className="btn btn-primary btn-lg w-full mt-4" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : saved ? <Check className="w-5 h-5" /> : null}
            {saving ? 'กำลังบันทึก...' : saved ? 'บันทึกแล้ว' : 'บันทึกการตั้งค่า'}
          </button>
        </div>
      </div>
    </>
  )
}
