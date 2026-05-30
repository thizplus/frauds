'use client'

import { useState, useEffect, useRef } from 'react'
import { User, Phone, CreditCard, Send, ImagePlus, X, ArrowLeft, AlertTriangle, IdCard, Plus, Globe, Check, Sparkles, Clock, Zap, Loader2, TrendingUp, Banknote, ShoppingCart, Users, HelpCircle, FileText, Search } from 'lucide-react'
import Link from 'next/link'
import { useCreateReport, type CreateReportData } from '@/features/report'
import { useCategories } from '@/features/search'
import { useServices, type ServiceItem } from '@/features/services'
import { BankSelector } from '@/components/shared/BankSelector'
import { uploadMultipleImages } from '@/lib/utils/image-upload'

const CATEGORY_ICONS: Record<string, typeof Banknote> = {
  'banknote': Banknote,
  'trending-up': TrendingUp,
  'shopping-cart': ShoppingCart,
  'users': Users,
}
import { PaymentDrawer } from '@/features/services/PaymentDrawer'
import { useAuthStore } from '@/lib/stores/auth'
import { LoginModal } from '@/features/auth'


export default function ReportPage() {
  const [showLogin, setShowLogin] = useState(false)
  const [mounted, setMounted] = useState(false)
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const [form, setForm] = useState<CreateReportData>({
    categoryId: '',
    firstName: '',
    lastName: '',
    idCard: '',
    phone: '',
    bankAccount: '',
    bankName: '',
    socialAccounts: [],
    reporterNote: '',
  })
  const [newSocial, setNewSocial] = useState('')
  const [images, setImages] = useState<{ file: File; preview: string }[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progressText, setProgressText] = useState('')
  const [reportResult, setReportResult] = useState<{ refCode: string; fraudId: string } | null>(null)

  const { mutate, isPending } = useCreateReport()
  const { data: categories } = useCategories()
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setMounted(true) }, [])

  // Cleanup previews on unmount
  useEffect(() => {
    return () => { images.forEach((img) => URL.revokeObjectURL(img.preview)) }
  }, [images])

  const handleAddImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newImages = files.slice(0, 20 - images.length).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }))
    setImages((prev) => [...prev, ...newImages])
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeImage = (index: number) => {
    URL.revokeObjectURL(images[index].preview)
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUploading(true)
    setProgressText('')

    try {
      // Generate refCode
      const now = new Date()
      const yy = String(now.getFullYear()).slice(2)
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      const rand = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
      const refCode = `RPT-${yy}${mm}${dd}-${rand}`

      // Upload หลักฐาน — compress + upload พร้อม progress
      let evidenceUrl = ''
      if (images.length > 0) {
        const folder = `evidence/${refCode}`
        const result = await uploadMultipleImages(
          images.map((img) => img.file),
          folder,
          (_current, _total, status) => setProgressText(status),
        )
        if (result.error) {
          setProgressText(`${result.error} (${result.urls.length} รูปอัปโหลดสำเร็จ)`)
          setUploading(false)
          return
        }
        evidenceUrl = JSON.stringify(result.urls)
      }

      setProgressText('กำลังส่งรายงาน...')
      mutate({ ...form, evidenceUrl, refCode }, {
        onSuccess: (res) => {
          const data = res?.data as { refCode?: string; fraudId?: string } | undefined
          setReportResult({
            refCode: data?.refCode || '',
            fraudId: data?.fraudId || '',
          })
          setSubmitted(true)
        },
        onSettled: () => setUploading(false),
      })
    } catch {
      setUploading(false)
    }
  }

  if (!mounted) return null

  if (!isLoggedIn) {
    return (
      <>
        <section className="flex-1 flex items-center justify-center px-4">
          <div className="card p-8 text-center max-w-sm w-full">
            <AlertTriangle className="w-10 h-10 mx-auto mb-4" style={{ color: 'var(--accent)' }} />
            <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>ต้องเข้าสู่ระบบก่อน</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              กรุณาเข้าสู่ระบบเพื่อรายงานคนโกง
            </p>
            <button className="btn btn-primary btn-lg w-full" onClick={() => setShowLogin(true)}>
              เข้าสู่ระบบ
            </button>
          </div>
        </section>
        <LoginModal open={showLogin} onOpenChange={setShowLogin} />
      </>
    )
  }

  if (submitted) {
    return <ReportSuccess refCode={reportResult?.refCode || ''} fraudId={reportResult?.fraudId || ''} />
  }

  return (
    <section className="w-full max-w-lg mx-auto px-4 py-8">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeft className="w-4 h-4" />กลับ
      </Link>

      <h1 className="text-2xl font-extrabold tracking-tight mb-1" style={{ color: 'var(--text)' }}>
        รายงานคนโกง
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>กรอกข้อมูลคนโกงที่พบ</p>

      <form className="space-y-4" onSubmit={handleSubmit} autoComplete="off">
        {/* หมวดหมู่ */}
        <div>
          <label className="report-label">ประเภทการโกง <span style={{ color: 'var(--accent)' }}>*</span></label>
          <div className="grid grid-cols-4 gap-2">
            {categories?.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.icon || ''] || HelpCircle
              const isActive = form.categoryId === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all aspect-square justify-center"
                  style={{
                    background: isActive ? 'var(--accent-dim)' : 'var(--bg-input, var(--card-bg))',
                    border: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                  onClick={() => setForm({ ...form, categoryId: cat.id })}
                >
                  <Icon className="w-7 h-7" />
                  <span className="text-sm font-semibold leading-tight text-center">{cat.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ชื่อ + นามสกุล */}
        <div className="report-row">
          <div className="report-row-item">
            <label className="report-label">ชื่อ <span style={{ color: 'var(--accent)' }}>*</span></label>
            <div className="report-input-wrap">
              <User className="report-input-icon" />
              <input type="text" className="input pl-10" placeholder="สมชาย" required
                value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
          </div>
          <div className="report-row-item">
            <label className="report-label">นามสกุล</label>
            <input type="text" className="input" placeholder="ใจดี"
              value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </div>
        </div>

        {/* เลขบัตรประชาชน */}
        <div>
          <label className="report-label">เลขบัตรประชาชน</label>
          <div className="report-input-wrap">
            <IdCard className="report-input-icon" />
            <input type="text" className="input pl-10 font-mono" placeholder="1234567890123" maxLength={13} inputMode="numeric"
              value={form.idCard} onChange={(e) => setForm({ ...form, idCard: e.target.value.replace(/\D/g, '').slice(0, 13) })} />
          </div>
        </div>

        {/* เบอร์ */}
        <div>
          <label className="report-label">เบอร์โทรศัพท์ <span style={{ color: 'var(--accent)' }}>*</span></label>
          <div className="report-input-wrap">
            <Phone className="report-input-icon" />
            <input type="tel" className="input pl-10 font-mono" placeholder="0812345678" maxLength={10} inputMode="numeric" required
              value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
          </div>
        </div>

        {/* บัญชี */}
        <div>
          <label className="report-label">เลขบัญชี</label>
          <div className="report-input-wrap">
            <CreditCard className="report-input-icon" />
            <input type="text" className="input pl-10 font-mono" placeholder="1234567890" maxLength={15} inputMode="numeric"
              value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value.replace(/\D/g, '').slice(0, 15) })} />
          </div>
        </div>

        {/* ธนาคาร */}
        <BankSelector value={form.bankName || ''} onChange={(v) => setForm({ ...form, bankName: v })} />

        {/* ช่องทาง Social */}
        <div>
          <label className="report-label">ช่องทาง Social / LINE ID</label>
          <div className="flex gap-2 mb-2">
            <div className="report-input-wrap flex-1">
              <Globe className="report-input-icon" />
              <input type="text" className="input pl-10" placeholder="เช่น LINE: @somchai, FB: somchai.jaidee"
                value={newSocial}
                onChange={(e) => setNewSocial(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (newSocial.trim()) {
                      setForm({ ...form, socialAccounts: [...(form.socialAccounts || []), newSocial.trim()] })
                      setNewSocial('')
                    }
                  }
                }}
              />
            </div>
            <button type="button" className="btn btn-secondary" style={{ height: 'auto' }} onClick={() => {
              if (newSocial.trim()) {
                setForm({ ...form, socialAccounts: [...(form.socialAccounts || []), newSocial.trim()] })
                setNewSocial('')
              }
            }}>
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {form.socialAccounts && form.socialAccounts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {form.socialAccounts.map((s, i) => (
                <span key={i} className="report-tag">
                  {s}
                  <button type="button" onClick={() => setForm({ ...form, socialAccounts: form.socialAccounts?.filter((_, idx) => idx !== i) })}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* เล่าเหตุการณ์ */}
        <div>
          <label className="report-label">เล่าเหตุการณ์ <span style={{ color: 'var(--accent)' }}>*</span></label>
          <textarea className="textarea" rows={3} required
            placeholder="เช่น กู้เงิน 20,000 บาท นัดผ่อนเดือนละ 3,000 จ่ายไป 2 งวด แล้วบล็อกไลน์หนีหนี้..."
            value={form.reporterNote} onChange={(e) => setForm({ ...form, reporterNote: e.target.value })} />
        </div>

        {/* หลักฐาน */}
        <div>
          <label className="report-label">หลักฐาน ({images.length}/20 รูป)</label>
          <div className="report-gallery">
            {images.map((img, i) => (
              <div key={i} className="report-gallery-item">
                <img src={img.preview} alt={`หลักฐาน ${i + 1}`} />
                <button type="button" className="report-gallery-remove" onClick={() => removeImage(i)}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {images.length < 20 && (
              <button type="button" className="report-gallery-add" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="w-5 h-5" />
                <span>เพิ่มรูป</span>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleAddImages} />
        </div>

        {/* Progress */}
        {progressText && (
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--accent)' }}>
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
            <span>{progressText}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Link href="/" className="btn btn-secondary btn-lg flex-1 justify-center">ยกเลิก</Link>
          <button type="submit" className="btn btn-primary btn-lg flex-1 justify-center" disabled={isPending || uploading}>
            {isPending || uploading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {uploading ? 'กำลังอัปโหลดหลักฐาน...' : 'กำลังส่ง...'}</>
            ) : (
              <><Send className="w-4 h-4" /> ส่งรายงาน</>
            )}
          </button>
        </div>
      </form>
    </section>
  )
}

// === หน้าแจ้งสำเร็จ + เลือก Service ===

function ReportSuccess({ refCode, fraudId }: { refCode: string; fraudId: string }) {
  const { data: services } = useServices()
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null)
  const [paymentService, setPaymentService] = useState<ServiceItem | null>(null)

  return (
    <section className="w-full max-w-lg mx-auto px-4 py-8">
      {/* Success header */}
      <div className="text-center mb-8 fade-in">
        <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--accent-dim)', border: '2px solid var(--accent)' }}>
          <Check className="w-8 h-8" style={{ color: 'var(--accent)' }} />
        </div>
        <h2 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--text)' }}>แจ้งรายงานสำเร็จ!</h2>
        {refCode && (
          <p className="text-sm font-mono font-bold mb-1" style={{ color: 'var(--accent)' }}>
            {refCode}
          </p>
        )}
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          ข้อมูลจะถูกตรวจสอบและเผยแพร่โดยผู้ดูแลระบบ
        </p>
      </div>

      {/* Services */}
      {services && services.length > 0 && (
        <div className="mb-6 fade-in">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>ต้องการเพิ่มพลังให้การแจ้งนี้?</h3>
          </div>

          <div className="space-y-3">
            {services.map((service) => (
              <div
                key={service.id}
                className={`service-card ${selectedService?.id === service.id ? 'selected' : ''}`}
                onClick={() => setSelectedService(selectedService?.id === service.id ? null : service)}
              >
                <div className="service-card-header">
                  <div className="service-card-icon">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold" style={{ color: 'var(--text)' }}>{service.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{service.description}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-extrabold" style={{ color: 'var(--accent)' }}>{service.price.toLocaleString()}</div>
                    <div className="text-xs" style={{ color: 'var(--text-dim)' }}>บาท</div>
                  </div>
                </div>

                {/* Expanded details */}
                {selectedService?.id === service.id && (
                  <div className="service-card-detail fade-in">
                    {service.duration && (
                      <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                        <Clock className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                        ระยะเวลา: {service.duration} วัน
                      </div>
                    )}

                    {service.features && service.features.length > 0 && (
                      <div className="space-y-1 mb-3">
                        {service.features.map((f, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                            <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
                            {f}
                          </div>
                        ))}
                      </div>
                    )}

                    {service.expectedResults && (
                      <div className="text-xs p-2.5 rounded-lg mb-3" style={{ background: 'var(--accent-dim)', color: 'var(--text-secondary)' }}>
                        <span className="font-semibold" style={{ color: 'var(--accent)' }}>ผลลัพธ์ที่คาดหวัง: </span>
                        {service.expectedResults}
                      </div>
                    )}

                    {service.notes && (
                      <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                        * {service.notes}
                      </p>
                    )}

                    <button className="btn btn-primary btn-lg w-full mt-3" onClick={(e) => {
                      e.stopPropagation()
                      setPaymentService(service)
                    }}>
                      <Zap className="w-4 h-4" />
                      สั่งซื้อบริการ {service.price.toLocaleString()} บาท
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <Link href="/dashboard/reports" className="btn btn-primary btn-lg flex-1 justify-center">
          <FileText className="w-4 h-4" /> ดูรายงาน
        </Link>
        <Link href="/" className="btn btn-secondary btn-lg flex-1 justify-center">
          <Search className="w-4 h-4" /> ค้นหาอีกครั้ง
        </Link>
      </div>

      {/* Payment Drawer */}
      <PaymentDrawer
        service={paymentService}
        open={!!paymentService}
        onClose={() => setPaymentService(null)}
        fraudId={fraudId}
      />
    </section>
  )
}
