import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { BadgeCheck, Clock, Phone, CreditCard, User, Calendar, FileText, ShieldAlert, IdCard, Globe, MessageSquare, Image } from 'lucide-react'
import type { FraudItem, FraudReportItem } from '../types'
import { useVerifyFraud, useDeleteFraud, useFraudDetail } from '../hooks'
import { toast } from 'sonner'

interface FraudDetailSheetProps {
  fraud: FraudItem | null
  open: boolean
  onClose: () => void
}

function displayName(f: { firstName?: string; lastName?: string; name?: string }): string {
  if (f.firstName || f.lastName) {
    return [f.firstName, f.lastName].filter(Boolean).join(' ')
  }
  return f.name || 'ไม่ทราบชื่อ'
}

export function FraudDetailSheet({ fraud, open, onClose }: FraudDetailSheetProps) {
  const verify = useVerifyFraud()
  const remove = useDeleteFraud()
  const { data: detail, isLoading } = useFraudDetail(open && fraud ? fraud.id : null)

  if (!fraud) return null

  const handleVerify = () => {
    verify.mutate(fraud.id, {
      onSuccess: () => { toast.success('ยืนยันแล้ว'); onClose() },
      onError: () => toast.error('ยืนยันไม่สำเร็จ'),
    })
  }

  const handleDelete = () => {
    if (!confirm('ต้องการลบรายการนี้?')) return
    remove.mutate(fraud.id, {
      onSuccess: () => { toast.success('ลบแล้ว'); onClose() },
      onError: () => toast.error('ลบไม่สำเร็จ'),
    })
  }

  const reports = detail?.reports || []

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-lg overflow-y-auto p-6">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            {displayName(fraud)}
            {fraud.verified
              ? <Badge variant="default" className="ml-2"><BadgeCheck className="h-3 w-3 mr-1" />ยืนยันแล้ว</Badge>
              : <Badge variant="secondary" className="ml-2"><Clock className="h-3 w-3 mr-1" />รอตรวจสอบ</Badge>
            }
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* ข้อมูลส่วนตัว */}
          <DetailRow icon={User} label="ชื่อ" value={fraud.firstName} />
          <DetailRow icon={User} label="นามสกุล" value={fraud.lastName} />
          {fraud.name && !fraud.firstName && <DetailRow icon={User} label="ชื่อ (เดิม)" value={fraud.name} />}
          <DetailRow icon={IdCard} label="เลขบัตร ปชช." value={fraud.idCard} mono />
          <DetailRow icon={Phone} label="เบอร์โทร" value={fraud.phone} mono />
          <DetailRow icon={CreditCard} label="เลขบัญชี" value={fraud.bankAccount} mono />
          {fraud.bankName && <DetailRow icon={CreditCard} label="ธนาคาร" value={fraud.bankName} />}

          {fraud.socialAccounts && fraud.socialAccounts.length > 0 && (
            <div className="flex items-start gap-3">
              <Globe className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">ช่องทาง Social</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {fraud.socialAccounts.map((s, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          <Separator />

          <DetailRow icon={FileText} label="หมวดหมู่" value={fraud.categoryName} />
          <DetailRow icon={Calendar} label="วันที่" value={new Date(fraud.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })} />
          <DetailRow icon={FileText} label="จำนวนรายงาน" value={`${fraud.reportCount} ครั้ง`} />

          {fraud.description && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">รายละเอียด</p>
                <p className="text-sm whitespace-pre-wrap">{fraud.description}</p>
              </div>
            </>
          )}

          {/* Reports — ข้ามรายการแรก (เป็นคนสร้าง fraud เอง ข้อมูลซ้ำกับด้านบน) */}
          {(() => {
            const otherReports = reports.length > 1 ? reports.slice(1) : []
            return (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                    <MessageSquare className="h-4 w-4" />
                    รายงานจากผู้ใช้อื่น ({otherReports.length})
                  </p>

                  {isLoading ? (
                    <div className="space-y-3">
                      {[1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                    </div>
                  ) : otherReports.length > 0 ? (
                    <div className="space-y-3">
                      {otherReports.map((report) => (
                        <ReportCard key={report.id} report={report} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีผู้ใช้อื่นรายงาน</p>
                  )}
                </div>
              </>
            )
          })()}

          <Separator />

          <div className="flex gap-2">
            {!fraud.verified && (
              <Button onClick={handleVerify} disabled={verify.isPending} className="flex-1">
                <BadgeCheck className="h-4 w-4 mr-1" />
                ยืนยัน
              </Button>
            )}
            <Button variant="destructive" onClick={handleDelete} disabled={remove.isPending} className="flex-1">
              ลบ
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ReportCard({ report }: { report: FraudReportItem }) {
  const name = [report.firstName, report.lastName].filter(Boolean).join(' ')

  // Parse evidence URLs (JSON array string)
  let evidenceUrls: string[] = []
  if (report.evidenceUrl) {
    try {
      const parsed = JSON.parse(report.evidenceUrl)
      if (Array.isArray(parsed)) evidenceUrls = parsed
      else if (typeof parsed === 'string' && parsed.startsWith('http')) evidenceUrls = [parsed]
    } catch {
      if (report.evidenceUrl.startsWith('http')) evidenceUrls = [report.evidenceUrl]
    }
  }

  return (
    <div className="rounded-lg border p-3 text-sm space-y-2">
      <div className="flex items-center justify-between">
        {report.refCode && (
          <span className="text-xs font-mono text-primary">{report.refCode}</span>
        )}
        <span className="text-xs text-muted-foreground">
          {new Date(report.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      {name && (
        <div className="flex items-center gap-1.5 text-xs">
          <User className="h-3 w-3 text-muted-foreground" />
          <span>{name}</span>
        </div>
      )}
      {report.phone && (
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <Phone className="h-3 w-3 text-muted-foreground" />
          <span>{report.phone}</span>
        </div>
      )}
      {report.bankAccount && (
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <CreditCard className="h-3 w-3 text-muted-foreground" />
          <span>{report.bankAccount} {report.bankName && `(${report.bankName})`}</span>
        </div>
      )}
      {report.socialAccounts && report.socialAccounts.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {report.socialAccounts.map((s, i) => (
            <Badge key={i} variant="outline" className="text-[10px] h-5">{s}</Badge>
          ))}
        </div>
      )}
      {report.reporterNote && (
        <p className="text-xs whitespace-pre-wrap text-muted-foreground border-t pt-2 mt-2">
          {report.reporterNote}
        </p>
      )}
      {evidenceUrls.length > 0 && (
        <div className="border-t pt-2 mt-2">
          <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
            <Image className="h-3 w-3" /> หลักฐาน ({evidenceUrls.length})
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {evidenceUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt={`หลักฐาน ${i + 1}`} className="h-16 w-16 object-cover rounded border hover:opacity-80 transition-opacity" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({ icon: Icon, label, value, mono }: { icon: typeof User; label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
    </div>
  )
}
