import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronLeft, ChevronRight, CreditCard } from 'lucide-react'
import { usePaymentList } from '../hooks'
import { PaymentDetailSheet } from '../components/PaymentDetailSheet'
import type { PaymentItem } from '../types'

const STATUS_LABELS: Record<string, string> = { pending: 'รอตรวจสอบ', approved: 'อนุมัติ', rejected: 'ปฏิเสธ' }
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = { pending: 'secondary', approved: 'default', rejected: 'destructive' }

export function PaymentsPage() {
  const [params, setParams] = useState<{ status?: string; page?: number; limit?: number }>({ page: 1, limit: 20 })
  const { data, isLoading } = usePaymentList(params)
  const [selected, setSelected] = useState<PaymentItem | null>(null)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">การชำระเงิน</h1>
        <Select value={params.status || 'all'} onValueChange={(v) => setParams((p) => ({ ...p, status: v === 'all' ? undefined : v, page: 1 }))}>
          <SelectTrigger className="w-36"><SelectValue placeholder="สถานะ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทั้งหมด</SelectItem>
            <SelectItem value="pending">รอตรวจสอบ</SelectItem>
            <SelectItem value="approved">อนุมัติ</SelectItem>
            <SelectItem value="rejected">ปฏิเสธ</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ผู้ชำระ</TableHead>
                  <TableHead>แพลน</TableHead>
                  <TableHead>จำนวน</TableHead>
                  <TableHead>วิธี</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>วันที่</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.length ? data.data.map((payment) => (
                  <TableRow key={payment.id} className="cursor-pointer" onClick={() => setSelected(payment)}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{payment.userName}</div>
                        <div className="text-xs text-muted-foreground">{payment.userEmail}</div>
                      </div>
                    </TableCell>
                    <TableCell>{payment.planName}</TableCell>
                    <TableCell className="font-mono">{payment.amount.toLocaleString()} ฿</TableCell>
                    <TableCell>{payment.paymentMethod}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[payment.status] || 'secondary'}>
                        {STATUS_LABELS[payment.status] || payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{new Date(payment.createdAt).toLocaleDateString('th-TH')}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      ยังไม่มีรายการชำระเงิน
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {data?.meta && data.meta.totalPages > 1 && (
          <CardContent className="border-t flex items-center justify-between py-3">
            <p className="text-sm text-muted-foreground">หน้า {data.meta.page}/{data.meta.totalPages} ({data.meta.total} รายการ)</p>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" disabled={!data.meta.hasPrev} onClick={() => setParams((p) => ({ ...p, page: (p.page || 1) - 1 }))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" disabled={!data.meta.hasNext} onClick={() => setParams((p) => ({ ...p, page: (p.page || 1) + 1 }))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <PaymentDetailSheet payment={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  )
}
