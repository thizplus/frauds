import { useState } from 'react'
import { toast } from 'sonner'
import { Check, EyeOff, Trash2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { COMMENT_ROUTES } from '@/constants/api-routes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface Comment {
  id: string
  content: string
  status: string
  userName: string
  createdAt: string
}

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  pending: { label: 'รอตรวจ', variant: 'secondary' },
  approved: { label: 'อนุมัติ', variant: 'default' },
  hidden: { label: 'ซ่อน', variant: 'outline' },
}

export function CommentModerationPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['comments', page, status],
    queryFn: () => apiClient.getPaginated<Comment>(COMMENT_ROUTES.LIST, { params: { page, limit: 20, status: status || undefined } }),
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(COMMENT_ROUTES.APPROVE(id)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comments'] }); toast.success('อนุมัติแล้ว') },
  })

  const hideMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(COMMENT_ROUTES.HIDE(id)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comments'] }); toast.success('ซ่อนแล้ว') },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(COMMENT_ROUTES.BY_ID(id)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comments'] }); toast.success('ลบแล้ว') },
  })

  const comments = data?.data ?? []
  const meta = data?.meta

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>ความคิดเห็น</CardTitle>
        <Select value={status} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="สถานะทั้งหมด" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทั้งหมด</SelectItem>
            <SelectItem value="pending">รอตรวจ</SelectItem>
            <SelectItem value="approved">อนุมัติ</SelectItem>
            <SelectItem value="hidden">ซ่อน</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ผู้เขียน</TableHead>
              <TableHead className="w-[50%]">ข้อความ</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
              ))
            ) : comments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">ไม่มีความคิดเห็น</TableCell>
              </TableRow>
            ) : (
              comments.map((c) => {
                const badge = STATUS_BADGE[c.status] || STATUS_BADGE.pending
                return (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm font-medium">{c.userName}</TableCell>
                    <TableCell className="text-sm">
                      <p className="line-clamp-2">{c.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(c.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </TableCell>
                    <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {c.status !== 'approved' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="อนุมัติ" onClick={() => approveMutation.mutate(c.id)}>
                            <Check className="h-4 w-4 text-green-500" />
                          </Button>
                        )}
                        {c.status !== 'hidden' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="ซ่อน" onClick={() => hideMutation.mutate(c.id)}>
                            <EyeOff className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="ลบ" onClick={() => { if (confirm('ลบความคิดเห็นนี้?')) deleteMutation.mutate(c.id) }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        {meta && meta.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">ทั้งหมด {meta.total} ({meta.page}/{meta.totalPages})</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={!meta.hasPrev} onClick={() => setPage(page - 1)}>ก่อนหน้า</Button>
              <Button variant="outline" size="sm" disabled={!meta.hasNext} onClick={() => setPage(page + 1)}>ถัดไป</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
