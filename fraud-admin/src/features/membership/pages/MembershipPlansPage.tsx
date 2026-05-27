import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Pencil, Trash2, CreditCard } from 'lucide-react'
import { usePlanList, useCreatePlan, useUpdatePlan, useDeletePlan } from '../hooks'
import { PlanFormDialog } from '../components/PlanFormDialog'
import type { PlanItem } from '../types'
import { toast } from 'sonner'

const TYPE_LABELS: Record<string, string> = { subscription: 'สมัครสมาชิก', one_time: 'ครั้งเดียว' }

export function MembershipPlansPage() {
  const { data: plans, isLoading } = usePlanList()
  const createMut = useCreatePlan()
  const updateMut = useUpdatePlan()
  const deleteMut = useDeletePlan()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<PlanItem | null>(null)

  const handleSubmit = (data: { name: string; description: string; type: 'subscription' | 'one_time'; price: number; durationDays: number; features: string[] }) => {
    if (editItem) {
      updateMut.mutate({ id: editItem.id, data }, {
        onSuccess: () => { toast.success('แก้ไขสำเร็จ'); setDialogOpen(false) },
        onError: () => toast.error('แก้ไขไม่สำเร็จ'),
      })
    } else {
      createMut.mutate(data, {
        onSuccess: () => { toast.success('สร้างสำเร็จ'); setDialogOpen(false) },
        onError: () => toast.error('สร้างไม่สำเร็จ'),
      })
    }
  }

  const handleToggleActive = (plan: PlanItem) => {
    updateMut.mutate({ id: plan.id, data: { isActive: !plan.isActive } }, {
      onSuccess: () => toast.success(plan.isActive ? 'ปิดแพลนแล้ว' : 'เปิดแพลนแล้ว'),
      onError: () => toast.error('เปลี่ยนสถานะไม่สำเร็จ'),
    })
  }

  const handleDelete = (plan: PlanItem) => {
    if (!confirm(`ลบแพลน "${plan.name}"? แพลนจะหายจากระบบ`)) return
    deleteMut.mutate(plan.id, { onSuccess: () => toast.success('ลบแล้ว') })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">แพลนสมาชิก</h1>
        <Button onClick={() => { setEditItem(null); setDialogOpen(true) }} className="gap-1.5">
          <Plus className="h-4 w-4" />เพิ่มแพลน
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>ราคา</TableHead>
                  <TableHead>ระยะเวลา</TableHead>
                  <TableHead>สมาชิก</TableHead>
                  <TableHead>เปิด/ปิด</TableHead>
                  <TableHead className="w-28"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans?.length ? plans.map(plan => (
                  <TableRow key={plan.id} className={!plan.isActive ? 'opacity-50' : ''}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{plan.name}</div>
                        {plan.description && <div className="text-xs text-muted-foreground mt-0.5">{plan.description}</div>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{TYPE_LABELS[plan.type] || plan.type}</Badge>
                    </TableCell>
                    <TableCell className="font-mono">{plan.price.toLocaleString()} บาท</TableCell>
                    <TableCell>{plan.type === 'subscription' ? `${plan.durationDays} วัน` : '-'}</TableCell>
                    <TableCell>{plan.subscriberCount}</TableCell>
                    <TableCell>
                      <Switch
                        checked={plan.isActive}
                        onCheckedChange={() => handleToggleActive(plan)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditItem(plan); setDialogOpen(true) }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(plan)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />ยังไม่มีแพลน
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PlanFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSubmit={handleSubmit}
        loading={createMut.isPending || updateMut.isPending} editItem={editItem} />
    </div>
  )
}
