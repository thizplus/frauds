import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, GripVertical, Save, Loader2 } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

interface SocialLink {
  platform: string
  title: string
  description: string
  url: string
}

const PLATFORMS = [
  { value: 'facebook_page', label: 'Facebook Page' },
  { value: 'facebook_group', label: 'Facebook Group' },
  { value: 'line', label: 'LINE' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'website', label: 'เว็บไซต์' },
]

export function SocialLinksEditor() {
  const [links, setLinks] = useState<SocialLink[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  useEffect(() => {
    apiClient.get('/admin/settings/social.links')
      .then((res: any) => {
        const val = res?.value
        if (Array.isArray(val)) setLinks(val)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const addLink = () => {
    setLinks([...links, { platform: 'facebook_page', title: '', description: '', url: '' }])
  }

  const removeLink = (idx: number) => {
    setLinks(links.filter((_, i) => i !== idx))
  }

  const updateLink = (idx: number, field: keyof SocialLink, value: string) => {
    setLinks(links.map((link, i) => i === idx ? { ...link, [field]: value } : link))
  }

  const handleDragStart = (idx: number) => setDragIdx(idx)
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    const newLinks = [...links]
    const [moved] = newLinks.splice(dragIdx, 1)
    newLinks.splice(idx, 0, moved)
    setLinks(newLinks)
    setDragIdx(idx)
  }
  const handleDragEnd = () => setDragIdx(null)

  const save = async () => {
    const valid = links.filter((l) => l.url.trim() && l.title.trim())
    setSaving(true)
    try {
      await apiClient.put('/admin/settings/social.links', { value: valid })
      toast.success('บันทึกสำเร็จ')
    } catch {
      toast.error('บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-4">
      {links.map((link, idx) => (
        <div
          key={idx}
          draggable
          onDragStart={() => handleDragStart(idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDragEnd={handleDragEnd}
          className={`flex gap-3 p-4 rounded-lg border bg-card transition-opacity ${dragIdx === idx ? 'opacity-50' : ''}`}
        >
          <div className="flex items-center cursor-grab text-muted-foreground hover:text-foreground">
            <GripVertical className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Platform</Label>
                <Select value={link.platform} onValueChange={(v) => updateLink(idx, 'platform', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Title</Label>
                <Input
                  value={link.title}
                  onChange={(e) => updateLink(idx, 'title', e.target.value)}
                  placeholder="เช่น กลุ่มเฟสบุ๊ค"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Input
                value={link.description}
                onChange={(e) => updateLink(idx, 'description', e.target.value)}
                placeholder="คำอธิบายสั้นๆ"
              />
            </div>
            <div>
              <Label className="text-xs">URL</Label>
              <Input
                value={link.url}
                onChange={(e) => updateLink(idx, 'url', e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          <Button variant="ghost" size="icon" className="text-destructive shrink-0 self-start" onClick={() => removeLink(idx)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <Button variant="outline" className="w-full gap-2" onClick={addLink}>
        <Plus className="h-4 w-4" /> เพิ่มลิงก์ใหม่
      </Button>

      <Button className="w-full gap-2" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        บันทึก
      </Button>
    </div>
  )
}
