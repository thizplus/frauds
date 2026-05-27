import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronLeft, ChevronRight, ArrowLeftRight, Crown, Bot } from 'lucide-react'
import { useTransactionList } from '../hooks'
import { useExtendedStats } from '@/features/dashboard/hooks'

const STATUS_LABELS: Record<string, string> = {
  pending: 'รอตรวจสอบ', approved: 'อนุมัติ', rejected: 'ปฏิเสธ',
  paused: 'หยุดชั่วคราว', cancelled: 'ยกเลิก',
}
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary', approved: 'default', rejected: 'destructive',
  paused: 'outline', cancelled: 'outline',
}

export function TransactionsPage() {
  const [params, setParams] = useState<{ status?: string; page?: number; limit?: number }>({ page: 1, limit: 20 })
  const { data, isLoading } = useTransactionList(params)
  const { data: ext } = useExtendedStats()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ภาพรวมธุรกรรม</h1>
        <Select value={params.status || 'all'} onValueChange={(v) => setParams((p) => ({ ...p, status: v === 'all' ? undefined : v, page: 1 }))}>
          <SelectTrigger className="w-40"><SelectValue placeholder="สถานะ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทั้งหมด</SelectItem>
            <SelectItem value="pending">รอตรวจสอบ</SelectItem>
            <SelectItem value="approved">อนุมัติ</SelectItem>
            <SelectItem value="rejected">ปฏิเสธ</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      {ext && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">รายรับวันนี้</p>
              <p className="text-2xl font-bold">{ext.revenueToday.toLocaleString()} ฿</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">รายรับเดือนนี้</p>
              <p className="text-2xl font-bold">{ext.revenueMonth.toLocaleString()} ฿</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">รอตรวจสอบ</p>
              <p className="text-2xl font-bold">{ext.pendingPayments + ext.pendingServicePayments}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>ผู้ชำระ</TableHead>
                  <TableHead>รายละเอียด</TableHead>
                  <TableHead>จำนวน</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>วันที่</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.length ? data.data.map((tx) => (
                  <TableRow key={`${tx.type}-${tx.id}`}>
                    <TableCell>
                      <Badge variant={tx.type === 'plan' ? 'default' : 'secondary'} className="gap-1">
                        {tx.type === 'plan' ? <Crown className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                        {tx.type === 'plan' ? 'Plan' : 'Service'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{tx.userName}</div>
                        <div className="text-xs text-muted-foreground">{tx.userEmail}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{tx.detail}</div>
                      {tx.refCode && <div className="text-xs font-mono text-muted-foreground">{tx.refCode}</div>}
                    </TableCell>
                    <TableCell className="font-mono">{tx.amount.toLocaleString()} &#3647;</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[tx.status] || 'secondary'}>
                        {STATUS_LABELS[tx.status] || tx.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{new Date(tx.createdAt).toLocaleDateString('th-TH')}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <ArrowLeftRight className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      ยังไม่มีธุรกรรม
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
    </div>
  )
}
