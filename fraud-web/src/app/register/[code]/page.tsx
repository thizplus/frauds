'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { User, Phone, CreditCard, IdCard, MapPin, Globe, Plus, X, Check, Loader2, AlertCircle, Bot } from 'lucide-react'
import { lenderService } from '@/features/lender/service'
import { compressAndUpload } from '@/lib/utils/image-upload'
import { BankSelector } from '@/components/shared/BankSelector'
import { ImageUpload } from '@/components/shared/ImageUpload'

export default function RegisterPage() {
  const params = useParams()
  const code = params.code as string

  const [info, setInfo] = useState<{ businessName: string; ownerName: string; formFields?: any } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    firstName: '', lastName: '', idCard: '', phone: '',
    bankAccount: '', bankName: '', address: '', socialAccounts: [] as string[],
    idCardImage: '', selfieImage: '',
  })
  const [newSocial, setNewSocial] = useState('')
  const [idCardFile, setIdCardFile] = useState<{ file: File; preview: string } | null>(null)
  const [selfieFile, setSelfieFile] = useState<{ file: File; preview: string } | null>(null)

  useEffect(() => {
    lenderService.getInviteInfo(code)
      .then(setInfo)
      .catch(() => setError('ลิงก์ไม่ถูกต้องหรือหมดอายุ'))
      .finally(() => setLoading(false))
  }, [code])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const submitData = { ...form }
      if (idCardFile) {
        submitData.idCardImage = await compressAndUpload(idCardFile.file, 'register/id-cards')
      }
      if (selfieFile) {
        submitData.selfieImage = await compressAndUpload(selfieFile.file, 'register/selfies')
      }
      await lenderService.register(code, submitData)
      setSubmitted(true)
    } catch {
      setError('ลงทะเบียนไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <section className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} /></section>
  }

  if (error && !info) {
    return (
      <section className="flex-1 flex items-center justify-center px-4">
        <div className="card p-8 text-center max-w-sm w-full">
          <AlertCircle className="w-10 h-10 mx-auto mb-4" style={{ color: 'var(--danger)' }} />
          <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>ไม่พบข้อมูล</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{error}</p>
        </div>
      </section>
    )
  }

  if (submitted) {
    return (
      <section className="flex-1 flex items-center justify-center px-4">
        <div className="card p-8 text-center max-w-sm w-full">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--accent-dim)', border: '2px solid var(--accent)' }}>
            <Check className="w-8 h-8" style={{ color: 'var(--accent)' }} />
          </div>
          <h2 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--text)' }}>ลงทะเบียนสำเร็จ!</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>ข้อมูลของคุณถูกบันทึกเรียบร้อยแล้ว</p>
        </div>
      </section>
    )
  }

  const ff = info?.formFields || { lastName: true, idCard: true, phone: true, bankAccount: true, bankName: true, address: true, socialAccounts: true }

  return (
    <>
      {/* Header แทน Navbar */}
      <nav className="navbar" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-5xl mx-auto px-4 flex items-center gap-2.5 h-16">
          <Bot className="w-6 h-6 text-accent" />
          <span className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
            {info?.businessName}
          </span>
        </div>
      </nav>

      <section className="w-full max-w-lg mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1" style={{ color: 'var(--text)' }}>
          ลงทะเบียนข้อมูล
        </h1>
        <p className="text-xs mt-1" style={{ color: 'var(--text-dim)', lineHeight: '1.3' }}>
          กรุณากรอกข้อมูลให้ครบถ้วน ข้อมูลจะถูกเก็บเป็นความลับ
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {/* ชื่อ — บังคับเสมอ */}
        <div className={ff.lastName ? 'grid grid-cols-2 gap-3' : ''}>
          <div>
            <label className="report-label">ชื่อ <span style={{ color: 'var(--accent)' }}>*</span></label>
            <div className="report-input-wrap">
              <User className="report-input-icon" />
              <input type="text" className="input pl-10" placeholder="ชื่อ" required
                value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
          </div>
          {ff.lastName && (
            <div>
              <label className="report-label">นามสกุล</label>
              <input type="text" className="input" placeholder="นามสกุล"
                value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
          )}
        </div>

        {ff.idCard && (
          <div>
            <label className="report-label">เลขบัตรประชาชน</label>
            <div className="report-input-wrap">
              <IdCard className="report-input-icon" />
              <input type="text" className="input pl-10 font-mono" placeholder="1234567890123" maxLength={13} inputMode="numeric"
                value={form.idCard} onChange={(e) => setForm({ ...form, idCard: e.target.value.replace(/\D/g, '').slice(0, 13) })} />
            </div>
          </div>
        )}

        {ff.phone && (
          <div>
            <label className="report-label">เบอร์โทรศัพท์</label>
            <div className="report-input-wrap">
              <Phone className="report-input-icon" />
              <input type="tel" className="input pl-10 font-mono" placeholder="0812345678" maxLength={10} inputMode="numeric"
                value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
            </div>
          </div>
        )}

        {ff.bankAccount && (
          <div>
            <label className="report-label">เลขบัญชี</label>
            <div className="report-input-wrap">
              <CreditCard className="report-input-icon" />
              <input type="text" className="input pl-10 font-mono" placeholder="1234567890" maxLength={15} inputMode="numeric"
                value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value.replace(/\D/g, '').slice(0, 15) })} />
            </div>
          </div>
        )}

        {ff.bankName && (
          <BankSelector value={form.bankName} onChange={(v) => setForm({ ...form, bankName: v })} />
        )}

        {ff.address && (
          <div>
            <label className="report-label">ที่อยู่</label>
            <div className="report-input-wrap">
              <MapPin className="report-input-icon" style={{ top: '0.75rem', transform: 'none' }} />
              <textarea className="textarea pl-10" rows={2} placeholder="ที่อยู่ปัจจุบัน"
                value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
          </div>
        )}

        {ff.socialAccounts && (
        <div>
          <label className="report-label">LINE ID / Social</label>
          <div className="flex gap-2 mb-2">
            <div className="report-input-wrap flex-1">
              <Globe className="report-input-icon" />
              <input type="text" className="input pl-10" placeholder="เช่น LINE: @somchai"
                value={newSocial} onChange={(e) => setNewSocial(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (newSocial.trim()) { setForm({ ...form, socialAccounts: [...form.socialAccounts, newSocial.trim()] }); setNewSocial('') } } }} />
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => { if (newSocial.trim()) { setForm({ ...form, socialAccounts: [...form.socialAccounts, newSocial.trim()] }); setNewSocial('') } }}>
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {form.socialAccounts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {form.socialAccounts.map((s, i) => (
                <span key={i} className="report-tag">
                  {s}
                  <button type="button" onClick={() => setForm({ ...form, socialAccounts: form.socialAccounts.filter((_, idx) => idx !== i) })}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        )}

        {/* รูปบัตรประชาชน */}
        {ff.idCardImage !== false && (
          <ImageUpload
            label="รูปบัตรประชาชน"
            file={idCardFile}
            onChange={setIdCardFile}
            icon="image"
            placeholder="เลือกรูปบัตรประชาชน"
          />
        )}

        {ff.selfieImage !== false && (
          <ImageUpload
            label="รูปถ่ายตัวเอง (Selfie)"
            file={selfieFile}
            onChange={setSelfieFile}
            icon="image"
            placeholder="เลือกรูปถ่ายตัวเอง"
          />
        )}

        {error && <p className="text-sm text-center" style={{ color: 'var(--danger)' }}>{error}</p>}

        <button type="submit" className="btn btn-primary btn-lg w-full" disabled={submitting || !form.firstName.trim()}>
          {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> กำลังส่ง...</> : 'ลงทะเบียน'}
        </button>
      </form>
    </section>
    </>
  )
}
