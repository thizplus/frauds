import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus, X } from 'lucide-react'
import type { PlanItem } from '../types'

interface PlanFormDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: { name: string; description: string; type: 'subscription' | 'one_time'; price: number; durationDays: number; features: string[] }) => void
  loading?: boolean
  editItem?: PlanItem | null
}

export function PlanFormDialog({ open, onClose, onSubmit, loading, editItem }: PlanFormDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'subscription' | 'one_time'>('subscription')
  const [price, setPrice] = useState(199)
  const [durationDays, setDurationDays] = useState(30)
  const [features, setFeatures] = useState<string[]>([])
  const [newFeature, setNewFeature] = useState('')

  useEffect(() => {
    if (editItem) {
      setName(editItem.name)
      setDescription(editItem.description || '')
      setType(editItem.type)
      setPrice(editItem.price)
      setDurationDays(editItem.durationDays)
      setFeatures(Array.isArray(editItem.features) ? editItem.features : [])
    } else {
      setName('')
      setDescription('')
      setType('subscription')
      setPrice(199)
      setDurationDays(30)
      setFeatures([])
    }
    setNewFeature('')
  }, [editItem, open])

  const addFeature = () => {
    if (newFeature.trim()) {
      setFeatures([...features, newFeature.trim()])
      setNewFeature('')
    }
  }

  const removeFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index))
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editItem ? 'แก้ไขแพลน' : 'สร้างแพลน'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, description, type, price, durationDays, features }) }} className="space-y-4">
          <div>
            <Label>ชื่อแพลน</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="สมาชิกรายเดือน" required />
          </div>
          <div>
            <Label>คำอธิบาย</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="ค้นหาไม่จำกัด เห็นข้อมูลเต็ม" />
          </div>
          <div>
            <Label>ประเภท</Label>
            <Select value={type} onValueChange={(v) => setType(v as 'subscription' | 'one_time')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="subscription">สมัครสมาชิก (รายเดือน/ปี)</SelectItem>
                <SelectItem value="one_time">ครั้งเดียว</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>ราคา (บาท)</Label>
            <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} min={0} step="any" required />
          </div>
          {type === 'subscription' && (
            <div>
              <Label>ระยะเวลา (วัน)</Label>
              <Input type="number" value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))} min={1} required />
            </div>
          )}
          <div>
            <Label>ฟีเจอร์</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={newFeature}
                onChange={(e) => setNewFeature(e.target.value)}
                placeholder="เช่น ค้นหาไม่จำกัด"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFeature() } }}
              />
              <Button type="button" variant="outline" size="icon" onClick={addFeature}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {features.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {features.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                    {f}
                    <button type="button" onClick={() => removeFeature(i)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
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
