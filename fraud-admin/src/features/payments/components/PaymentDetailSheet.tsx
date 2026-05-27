import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { User, CreditCard, Calendar, FileText, CheckCircle, XCircle, Image } from 'lucide-react'
import type { PaymentItem } from '../types'
import { useApprovePayment, useRejectPayment } from '../hooks'
import { toast } from 'sonner'

const STATUS_LABELS: Record<string, string> = { pending: 'รอตรวจสอบ', approved: 'อนุมัติ', rejected: 'ปฏิเสธ' }
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = { pending: 'secondary', approved: 'default', rejected: 'destructive' }

interface PaymentDetailSheetProps {
  payment: PaymentItem | null
  open: boolean
  onClose: () => void
}

export function PaymentDetailSheet({ payment, open, onClose }: PaymentDetailSheetProps) {
  const approve = useApprovePayment()
  const reject = useRejectPayment()

  if (!payment) return null

  const handleApprove = () => {
    approve.mutate(payment.id, {
      onSuccess: () => { toast.success('อนุมัติแล้ว'); onClose() },
      onError: () => toast.error('อนุมัติไม่สำเร็จ'),
    })
  }

  const handleReject = () => {
    if (!confirm('ต้องการปฏิเสธการชำระเงินนี้?')) return
    reject.mutate(payment.id, {
      onSuccess: () => { toast.success('ปฏิเสธแล้ว'); onClose() },
      onError: () => toast.error('ปฏิเสธไม่สำเร็จ'),
    })
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-lg overflow-y-auto p-6">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            การชำระเงิน
            <Badge variant={STATUS_VARIANT[payment.status] || 'secondary'} className="ml-2">
              {STATUS_LABELS[payment.status] || payment.status}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <DetailRow icon={User} label="ผู้ชำระ" value={`${payment.userName} (${payment.userEmail})`} />
          <DetailRow icon={FileText} label="แพลน" value={payment.planName} />
          <DetailRow icon={CreditCard} label="จำนวนเงิน" value={`${payment.amount.toLocaleString()} บาท`} />
          <DetailRow icon={CreditCard} label="วิธีชำระ" value={payment.paymentMethod} />
          <DetailRow icon={Calendar} label="วันที่" value={new Date(payment.createdAt).toLocaleString('th-TH')} />
          {payment.note && <DetailRow icon={FileText} label="หมายเหตุ" value={payment.note} />}

          {payment.slipUrl && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Image className="h-4 w-4" /> รูปสลิป
                </p>
                <img
                  src={payment.slipUrl}
                  alt="slip"
                  className="w-full max-h-96 object-contain rounded-lg border"
                />
              </div>
            </>
          )}

          {payment.status === 'pending' && (
            <>
              <Separator />
              <div className="flex gap-2">
                <Button onClick={handleApprove} disabled={approve.isPending} className="flex-1 gap-1">
                  <CheckCircle className="h-4 w-4" /> อนุมัติ
                </Button>
                <Button variant="destructive" onClick={handleReject} disabled={reject.isPending} className="flex-1 gap-1">
                  <XCircle className="h-4 w-4" /> ปฏิเสธ
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  )
}
