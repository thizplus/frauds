import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Eye, EyeOff, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ArticleStatusBadge } from '../components/ArticleStatusBadge'
import { useArticleList, useDeleteArticle, usePublishArticle, useUnpublishArticle } from '../hooks'

export function ArticleListPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<string>('')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useArticleList({ page, limit: 20, status: status || undefined, search: search || undefined })
  const deleteMutation = useDeleteArticle()
  const publishMutation = usePublishArticle()
  const unpublishMutation = useUnpublishArticle()

  const articles = data?.data ?? []
  const meta = data?.meta

  const handleDelete = (id: string, title: string) => {
    if (!confirm(`ลบบทความ "${title}" ?`)) return
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success('ลบบทความสำเร็จ'),
      onError: () => toast.error('ลบบทความไม่สำเร็จ'),
    })
  }

  const handleTogglePublish = (id: string, currentStatus: string) => {
    if (currentStatus === 'published') {
      unpublishMutation.mutate(id, {
        onSuccess: () => toast.success('ยกเลิกเผยแพร่สำเร็จ'),
      })
    } else {
      publishMutation.mutate(id, {
        onSuccess: () => toast.success('เผยแพร่สำเร็จ'),
      })
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>บทความ</CardTitle>
        <Button onClick={() => navigate('/articles/new')}>
          <Plus className="mr-2 h-4 w-4" />
          สร้างบทความ
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex gap-3">
          <Input
            placeholder="ค้นหาบทความ..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="max-w-xs"
          />
          <Select value={status} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="สถานะทั้งหมด" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="draft">แบบร่าง</SelectItem>
              <SelectItem value="published">เผยแพร่แล้ว</SelectItem>
              <SelectItem value="archived">เก็บถาวร</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">หัวข้อ</TableHead>
              <TableHead>หมวด</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
                </TableRow>
              ))
            ) : articles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  ยังไม่มีบทความ
                </TableCell>
              </TableRow>
            ) : (
              articles.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {a.isFeatured && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                      <div>
                        <p className="font-medium line-clamp-1">{a.title}</p>
                        <p className="text-xs text-muted-foreground">{a.slug}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{a.categoryName || '-'}</TableCell>
                  <TableCell><ArticleStatusBadge status={a.status} /></TableCell>
                  <TableCell className="text-right text-sm">{a.viewCount.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title={a.status === 'published' ? 'ยกเลิกเผยแพร่' : 'เผยแพร่'} onClick={() => handleTogglePublish(a.id, a.status)}>
                        {a.status === 'published' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="แก้ไข" onClick={() => navigate(`/articles/${a.id}/edit`)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="ลบ" onClick={() => handleDelete(a.id, a.title)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {meta && meta.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              ทั้งหมด {meta.total} บทความ (หน้า {meta.page}/{meta.totalPages})
            </p>
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
