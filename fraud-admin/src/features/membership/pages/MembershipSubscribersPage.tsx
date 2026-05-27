import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronLeft, ChevronRight, Users, XCircle } from 'lucide-react'
import { useSubscribers, useCancelSubscription } from '../hooks'
import { toast } from 'sonner'

const STATUS_LABELS: Record<string, string> = { active: 'ใช้งาน', expired: 'หมดอายุ', cancelled: 'ยกเลิก' }
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = { active: 'default', expired: 'secondary', cancelled: 'destructive' }

export function MembershipSubscribersPage() {
  const [params, setParams] = useState<{ status?: string; page?: number; limit?: number }>({ page: 1, limit: 20 })
  const { data, isLoading } = useSubscribers(params)
  const cancelMut = useCancelSubscription()

  const handleCancel = (id: string) => {
    if (!confirm('ต้องการยกเลิกสมาชิกนี้?')) return
    cancelMut.mutate(id, {
      onSuccess: () => toast.success('ยกเลิกแล้ว'),
      onError: () => toast.error('ยกเลิกไม่สำเร็จ'),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">รายการสมาชิก</h1>
        <Select value={params.status || 'all'} onValueChange={(v) => setParams((p) => ({ ...p, status: v === 'all' ? undefined : v, page: 1 }))}>
          <SelectTrigger className="w-36"><SelectValue placeholder="สถานะ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทั้งหมด</SelectItem>
            <SelectItem value="active">ใช้งาน</SelectItem>
            <SelectItem value="expired">หมดอายุ</SelectItem>
            <SelectItem value="cancelled">ยกเลิก</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead>อีเมล</TableHead>
                  <TableHead>แพลน</TableHead>
                  <TableHead>เริ่ม</TableHead>
                  <TableHead>หมดอายุ</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.length ? data.data.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">{sub.userName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{sub.userEmail}</TableCell>
                    <TableCell>{sub.planName}</TableCell>
                    <TableCell className="text-sm">{new Date(sub.startDate).toLocaleDateString('th-TH')}</TableCell>
                    <TableCell className="text-sm">{new Date(sub.endDate).toLocaleDateString('th-TH')}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[sub.status] || 'secondary'}>
                        {STATUS_LABELS[sub.status] || sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {sub.status === 'active' && (
                        <Button variant="ghost" size="icon" onClick={() => handleCancel(sub.id)} title="ยกเลิก">
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      ยังไม่มีสมาชิก
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {data?.meta && data.meta.totalPages > 1 && (
          <CardContent className="border-t flex items-center justify-between py-3">
            <p className="text-sm text-muted-foreground">
              หน้า {data.meta.page}/{data.meta.totalPages} ({data.meta.total} รายการ)
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" disabled={!data.meta.hasPrev}
                onClick={() => setParams((p) => ({ ...p, page: (p.page || 1) - 1 }))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" disabled={!data.meta.hasNext}
                onClick={() => setParams((p) => ({ ...p, page: (p.page || 1) + 1 }))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
