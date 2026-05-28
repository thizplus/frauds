'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Check, Loader2, Upload, Copy, ImagePlus, AlertCircle, FileImage, Eye, Crown, LayoutDashboard, Search } from 'lucide-react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import generatePayload from 'promptpay-qr'
import { apiClient } from '@/lib/api/client'
import { useAuthStore } from '@/lib/stores/auth'
import type { PlanItem } from '../types'

interface CheckoutModalProps {
  plan: PlanItem | null
  open: boolean
  onClose: () => void
}

interface PaymentSettings {
  promptpayNumber: string
  promptpayName: string
  bankAccount: string
  bankName: string
}

export function CheckoutModal({ plan, open, onClose }: CheckoutModalProps) {
  const [step, setStep] = useState<'pay' | 'done' | 'error'>('pay')
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [slipPreview, setSlipPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [resultMsg, setResultMsg] = useState('')
  const [autoApproved, setAutoApproved] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const [settings, setSettings] = useState<PaymentSettings>({ promptpayNumber: '', promptpayName: '', bankAccount: '', bankName: '' })
  const [copied, setCopied] = useState(false)
  const [qrPayload, setQrPayload] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const { isLoggedIn } = useAuthStore()
  const queryClient = useQueryClient()

  // Fetch payment settings + generate QR
  useEffect(() => {
    if (!open || !plan) return
    setStep('pay')
    setSlipFile(null)
    setSlipPreview(null)
    setResultMsg('')
    setAutoApproved(false)

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'
    const token = useAuthStore.getState().accessToken
    fetch(`${apiUrl}/me/payment-settings`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const data = d.data
          const clean = (v: unknown) => String(v || '').replace(/"/g, '')
          const ppNumber = clean(data['payment.promptpay_number'])
          const ppName = clean(data['payment.promptpay_name'])
          const bankAcc = clean(data['payment.bank_account'])
          const bankNm = clean(data['payment.bank_name'])

          setSettings({ promptpayNumber: ppNumber, promptpayName: ppName, bankAccount: bankAcc, bankName: bankNm })

          if (ppNumber) {
            try {
              const payload = generatePayload(ppNumber, { amount: plan.price })
              setQrPayload(payload)
            } catch {
              setQrPayload('')
            }
          }
        }
      })
      .catch(() => {})
  }, [open, plan])

  // Lock scroll
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open || !plan) return null

  const handleSlipUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSlipFile(file)
      setSlipPreview(URL.createObjectURL(file))
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSubmit = async () => {
    if (!slipFile || !plan || !isLoggedIn) return
    setSubmitting(true)
    setResultMsg('')

    try {
      // 1. Upload slip → folder=slips
      const formData = new FormData()
      formData.append('file', slipFile)
      const uploadRes = await apiClient.post('/uploads?folder=slips', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const slipUrl = uploadRes.data?.data?.url || ''

      // 2. Create payment with slip
      const paymentRes = await apiClient.post('/payments', {
        planId: plan.id,
        amount: plan.price,
        paymentMethod: 'promptpay',
        slipUrl,
      })
      const result = paymentRes.data?.data

      if (result?.status === 'approved') {
        setAutoApproved(true)
        setResultMsg('สลิปถูกต้อง อนุมัติอัตโนมัติแล้ว!')
      } else {
        setAutoApproved(false)
        setResultMsg(result?.verification?.errorMessage || 'ส่งสำเร็จ รอผู้ดูแลระบบตรวจสอบ')
      }
      setStep('done')

      // Invalidate cache เพื่อให้ dashboard + subscription refresh
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่'
      setResultMsg(msg)
      setStep('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="payment-drawer-backdrop" onClick={onClose} />
      <div className="payment-drawer">
        {/* Header */}
        <div className="payment-drawer-header">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
            {step === 'done' ? 'สมัครสมาชิกสำเร็จ' : `สมัคร ${plan.name}`}
          </h3>
          <button className="btn-ghost btn-icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'pay' && (
          <div className="payment-drawer-body">
            {/* Plan info */}
            <div className="payment-drawer-service">
              <span style={{ color: 'var(--text-secondary)' }}>{plan.name}</span>
              <span className="text-xl font-extrabold" style={{ color: 'var(--accent)' }}>
                {plan.price.toLocaleString()} บาท
              </span>
            </div>

            {/* Features */}
            {plan.features && plan.features.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {plan.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <Check className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                    {f}
                  </div>
                ))}
              </div>
            )}

            {/* QR + Account info */}
            <div className="payment-info-row">
              <div className="payment-qr-side">
                {qrPayload ? (
                  <div className="payment-qr-code">
                    <QRCodeSVG value={qrPayload} size={130} bgColor="#ffffff" fgColor="#000000" />
                  </div>
                ) : (
                  <div className="payment-qr-code" style={{ width: 130, height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="text-xs" style={{ color: 'var(--text-dim)' }}>ไม่พบ QR</span>
                  </div>
                )}
              </div>
              <div className="payment-account-side">
                <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>โอนเงินไปที่</p>
                <p className="text-2xl font-extrabold" style={{ color: 'var(--accent)' }}>
                  {plan.price.toLocaleString()} <span className="text-xs font-normal">บาท</span>
                </p>
                {settings.bankAccount && (
                  <div className="payment-drawer-number" onClick={() => handleCopy(settings.bankAccount)}>
                    <span className="font-mono text-sm font-bold" style={{ color: 'var(--text)' }}>{settings.bankAccount}</span>
                    {copied ? <Check className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} /> : <Copy className="w-3.5 h-3.5" style={{ color: 'var(--text-dim)' }} />}
                  </div>
                )}
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{settings.promptpayName}</p>
                {settings.bankName && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{settings.bankName}</p>}
              </div>
            </div>

            {/* Slip upload */}
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>แนบสลิปโอนเงิน</p>
              <p className="text-xs mb-2" style={{ color: 'var(--text-dim)' }}>ระบบตรวจสลิปอัตโนมัติ กรุณาแนบสลิปจริงเท่านั้น</p>
              {slipFile ? (
                <div className="payment-slip-file">
                  <FileImage className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                  <span className="payment-slip-filename">{slipFile.name}</span>
                  <button type="button" className="payment-slip-action" onClick={() => setLightbox(true)} title="ดูรูป">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button type="button" className="payment-slip-action" onClick={() => { setSlipFile(null); setSlipPreview(null); if (fileRef.current) fileRef.current.value = '' }} title="ลบ">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button className="payment-drawer-upload" onClick={() => fileRef.current?.click()}>
                  <ImagePlus className="w-6 h-6" />
                  <span>กดเพื่อเลือกรูปสลิป</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleSlipUpload} />
            </div>

            {/* Submit */}
            <button
              className="btn btn-primary btn-lg w-full"
              disabled={!slipFile || submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> กำลังส่ง...</>
              ) : (
                <><Upload className="w-5 h-5" /> ยืนยันการชำระเงิน</>
              )}
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="payment-drawer-body fade-in" style={{ textAlign: 'center', gap: 0 }}>
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--accent-dim)', border: '2px solid var(--accent)' }}>
              <Crown className="w-7 h-7" style={{ color: 'var(--accent)' }} />
            </div>

            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>
              {autoApproved ? 'สมัครสำเร็จ!' : 'ส่งคำขอเรียบร้อย!'}
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              {autoApproved ? 'คุณเป็นสมาชิกแล้ว ค้นหาได้ไม่จำกัด!' : resultMsg}
            </p>

            <div className="flex gap-2 w-full">
              <Link href="/dashboard" className="btn btn-primary btn-lg flex-1 justify-center" onClick={onClose}>
                <LayoutDashboard className="w-4 h-4" />
                ไปแดชบอร์ด
              </Link>
              <Link href="/" className="btn btn-secondary btn-lg flex-1 justify-center" onClick={onClose}>
                <Search className="w-4 h-4" />
                กลับไปค้นหา
              </Link>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="payment-drawer-body" style={{ textAlign: 'center' }}>
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(248,113,113,.1)', border: '2px solid var(--danger)' }}>
              <AlertCircle className="w-8 h-8" style={{ color: 'var(--danger)' }} />
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>เกิดข้อผิดพลาด</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>{resultMsg}</p>
            <button className="btn btn-primary btn-lg w-full" onClick={() => setStep('pay')}>ลองใหม่</button>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && slipPreview && (
        <div className="slip-lightbox" onClick={() => setLightbox(false)}>
          <img src={slipPreview} alt="สลิป" onClick={(e) => e.stopPropagation()} />
          <button className="slip-lightbox-close" onClick={() => setLightbox(false)}>
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </>
  )
}
