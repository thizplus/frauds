import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Loader2, Banknote, TrendingUp, ShoppingCart, Users, Shield, AlertTriangle,
  CreditCard, Phone, Globe, Car, Home, Heart, Briefcase, Gift, Zap,
  Lock, Eye, MessageSquare, Flag, Star, Award, Target, Flame,
} from 'lucide-react'
import type { CategoryItem } from '../types'

const ICON_OPTIONS = [
  { name: 'banknote', icon: Banknote, label: 'เงิน' },
  { name: 'trending-up', icon: TrendingUp, label: 'ลงทุน' },
  { name: 'shopping-cart', icon: ShoppingCart, label: 'ซื้อขาย' },
  { name: 'users', icon: Users, label: 'กลุ่มคน' },
  { name: 'credit-card', icon: CreditCard, label: 'บัตรเครดิต' },
  { name: 'phone', icon: Phone, label: 'โทรศัพท์' },
  { name: 'globe', icon: Globe, label: 'ออนไลน์' },
  { name: 'shield', icon: Shield, label: 'ความปลอดภัย' },
  { name: 'alert-triangle', icon: AlertTriangle, label: 'แจ้งเตือน' },
  { name: 'car', icon: Car, label: 'รถยนต์' },
  { name: 'home', icon: Home, label: 'บ้าน' },
  { name: 'heart', icon: Heart, label: 'หัวใจ' },
  { name: 'briefcase', icon: Briefcase, label: 'ธุรกิจ' },
  { name: 'gift', icon: Gift, label: 'ของขวัญ' },
  { name: 'zap', icon: Zap, label: 'พลังงาน' },
  { name: 'lock', icon: Lock, label: 'ล็อค' },
  { name: 'eye', icon: Eye, label: 'ตา' },
  { name: 'message-square', icon: MessageSquare, label: 'ข้อความ' },
  { name: 'flag', icon: Flag, label: 'ธง' },
  { name: 'star', icon: Star, label: 'ดาว' },
  { name: 'award', icon: Award, label: 'รางวัล' },
  { name: 'target', icon: Target, label: 'เป้าหมาย' },
  { name: 'flame', icon: Flame, label: 'ไฟ' },
]

interface CategoryFormDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: { id: string; name: string; description: string; icon: string }) => void
  loading?: boolean
  editItem?: CategoryItem | null
}

export function CategoryFormDialog({ open, onClose, onSubmit, loading, editItem }: CategoryFormDialogProps) {
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('')

  useEffect(() => {
    if (editItem) {
      setId(editItem.id)
      setName(editItem.name)
      setDescription(editItem.description || '')
      setIcon(editItem.icon || '')
    } else {
      setId('')
      setName('')
      setDescription('')
      setIcon('')
    }
  }, [editItem, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ id, name, description, icon })
  }

  const isEdit = !!editItem

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>ID (ภาษาอังกฤษ ไม่มีเว้นวรรค)</Label>
            <Input
              value={id}
              onChange={(e) => setId(e.target.value.toLowerCase().replace(/\s/g, '_'))}
              placeholder="loan_fraud"
              disabled={isEdit}
              required
            />
          </div>
          <div>
            <Label>ชื่อหมวดหมู่</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="เบี้ยวหนี้เงินกู้" required />
          </div>
          <div>
            <Label>คำอธิบาย</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="กู้เงินไปแล้วไม่คืน" />
          </div>
          <div>
            <Label>ไอคอน</Label>
            <div className="grid grid-cols-6 gap-1.5 mt-1.5">
              {ICON_OPTIONS.map((opt) => {
                const IconComp = opt.icon
                const isActive = icon === opt.name
                return (
                  <button
                    key={opt.name}
                    type="button"
                    className={`flex flex-col items-center gap-0.5 p-2 rounded-lg border transition-colors ${isActive ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted'}`}
                    onClick={() => setIcon(opt.name)}
                    title={opt.label}
                  >
                    <IconComp className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`text-[9px] leading-tight ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" disabled={loading || !id || !name}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {isEdit ? 'บันทึก' : 'สร้าง'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
