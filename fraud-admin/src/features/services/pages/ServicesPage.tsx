import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Pencil, Trash2, Sparkles, Loader2, X } from 'lucide-react'
import { useServiceList, useCreateService, useUpdateService, useDeleteService } from '../hooks'
import type { ServiceItem, CreateServiceRequest } from '../types'
import { toast } from 'sonner'

export function ServicesPage() {
  const { data: services, isLoading } = useServiceList()
  const createMut = useCreateService()
  const updateMut = useUpdateService()
  const deleteMut = useDeleteService()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<ServiceItem | null>(null)

  const handleSubmit = (data: CreateServiceRequest) => {
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

  const handleToggleActive = (item: ServiceItem) => {
    updateMut.mutate({ id: item.id, data: { isActive: !item.isActive } }, {
      onSuccess: () => toast.success(item.isActive ? 'ปิดบริการแล้ว' : 'เปิดบริการแล้ว'),
      onError: () => toast.error('เปลี่ยนสถานะไม่สำเร็จ'),
    })
  }

  const handleDelete = (item: ServiceItem) => {
    if (!confirm(`ลบบริการ "${item.name}"?`)) return
    deleteMut.mutate(item.id, { onSuccess: () => toast.success('ลบแล้ว') })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">บริการ</h1>
        <Button onClick={() => { setEditItem(null); setDialogOpen(true) }} className="gap-1.5">
          <Plus className="h-4 w-4" />เพิ่มบริการ
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead>ราคา</TableHead>
                  <TableHead>ระยะเวลา</TableHead>
                  <TableHead>ฟีเจอร์</TableHead>
                  <TableHead>เปิด/ปิด</TableHead>
                  <TableHead className="w-28"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services?.length ? services.map(item => (
                  <TableRow key={item.id} className={!item.isActive ? 'opacity-50' : ''}>
                    <TableCell>
                      <div className="font-medium">{item.name}</div>
                      {item.description && <div className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">{item.description}</div>}
                    </TableCell>
                    <TableCell className="font-mono">{item.price.toLocaleString()} บาท</TableCell>
                    <TableCell className="text-sm">{item.duration || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {item.features?.length ? item.features.map((f, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{f}</Badge>
                        )) : <span className="text-xs text-muted-foreground">-</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch checked={item.isActive} onCheckedChange={() => handleToggleActive(item)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditItem(item); setDialogOpen(true) }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />ยังไม่มีบริการ
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ServiceFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        loading={createMut.isPending || updateMut.isPending}
        editItem={editItem}
      />
    </div>
  )
}

// --- Form Dialog ---

function ServiceFormDialog({ open, onClose, onSubmit, loading, editItem }: {
  open: boolean
  onClose: () => void
  onSubmit: (data: CreateServiceRequest) => void
  loading?: boolean
  editItem?: ServiceItem | null
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState(199)
  const [duration, setDuration] = useState('')
  const [features, setFeatures] = useState<string[]>([])
  const [expectedResults, setExpectedResults] = useState('')
  const [notes, setNotes] = useState('')
  const [newFeature, setNewFeature] = useState('')

  useEffect(() => {
    if (editItem) {
      setName(editItem.name)
      setDescription(editItem.description || '')
      setPrice(editItem.price)
      setDuration(editItem.duration || '')
      setFeatures(Array.isArray(editItem.features) ? editItem.features : [])
      setExpectedResults(editItem.expectedResults || '')
      setNotes(editItem.notes || '')
    } else {
      setName(''); setDescription(''); setPrice(199); setDuration('')
      setFeatures([]); setExpectedResults(''); setNotes('')
    }
    setNewFeature('')
  }, [editItem, open])

  const addItem = (list: string[], setList: (v: string[]) => void, value: string, setValue: (v: string) => void) => {
    if (value.trim()) { setList([...list, value.trim()]); setValue('') }
  }

  const removeItem = (list: string[], setList: (v: string[]) => void, index: number) => {
    setList(list.filter((_, i) => i !== index))
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? 'แก้ไขบริการ' : 'สร้างบริการ'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, description, price, duration, features, expectedResults, notes }) }} className="space-y-4">
          <div>
            <Label>ชื่อบริการ</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="AI เปิดโปงคนโกง" required />
          </div>
          <div>
            <Label>คำอธิบาย</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="อธิบายบริการให้ลูกค้าเข้าใจ" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>ราคา (บาท)</Label>
              <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} min={0} required />
            </div>
            <div>
              <Label>ระยะเวลาดำเนินการ</Label>
              <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="เช่น ภายใน 7 วัน" />
            </div>
          </div>

          {/* ฟีเจอร์ */}
          <TagListInput
            label="ฟีเจอร์ / สิ่งที่ได้รับ"
            placeholder="เช่น โพสลง 10+ เว็บไซต์"
            items={features}
            value={newFeature}
            onChange={setNewFeature}
            onAdd={() => addItem(features, setFeatures, newFeature, setNewFeature)}
            onRemove={(i) => removeItem(features, setFeatures, i)}
          />

          {/* ผลลัพธ์ที่คาดหวัง */}
          <div>
            <Label>ผลลัพธ์ที่คาดหวัง</Label>
            <Textarea value={expectedResults} onChange={(e) => setExpectedResults(e.target.value)} placeholder="เช่น ค้นชื่อ/เบอร์/บัญชีใน Google จะเจอว่าคนนี้มีประวัติโกง" rows={2} />
          </div>

          {/* หมายเหตุ */}
          <div>
            <Label>หมายเหตุ</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ข้อควรรู้ เงื่อนไข หรือคำเตือนสำหรับลูกค้า" rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" disabled={loading || !name}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editItem ? 'บันทึก' : 'สร้าง'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Reusable Tag List Input ---

function TagListInput({ label, placeholder, items, value, onChange, onAdd, onRemove }: {
  label: string
  placeholder: string
  items: string[]
  value: string
  onChange: (v: string) => void
  onAdd: () => void
  onRemove: (i: number) => void
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2 mt-1">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAdd() } }}
        />
        <Button type="button" variant="outline" size="icon" onClick={onAdd}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {items.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
              {item}
              <button type="button" onClick={() => onRemove(i)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
