import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiClient } from '@/lib/api-client'
import { ARTICLE_ROUTES } from '@/constants/api-routes'
import type { ArticleCategory } from '../types'

interface AIGenerateDialogProps {
  categories: ArticleCategory[]
}

interface GenerateResult {
  title: string
  content: string
  excerpt: string
  metaTitle: string
  metaDescription: string
  suggestedTags: string[]
  suggestedSlug: string
}

export function AIGenerateDialog({ categories }: AIGenerateDialogProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [topic, setTopic] = useState('')
  const [category, setCategory] = useState('')
  const [tone, setTone] = useState('educational')
  const [length, setLength] = useState('medium')
  const [keywords, setKeywords] = useState('')
  const [outline, setOutline] = useState('')

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error('กรุณากรอกหัวข้อ')
      return
    }

    setLoading(true)
    try {
      const result = await apiClient.post<GenerateResult>(ARTICLE_ROUTES.GENERATE, {
        topic: topic.trim(),
        category: category || undefined,
        tone,
        length,
        keywords: keywords ? keywords.split(',').map((k) => k.trim()).filter(Boolean) : undefined,
        outline: outline ? outline.split('\n').map((o) => o.trim()).filter(Boolean) : undefined,
      })

      // สร้าง article draft จากผลลัพธ์
      const categoryId = categories.find((c) => c.name === category || c.slug === category)?.id

      const article = await apiClient.post<{ id: string }>(ARTICLE_ROUTES.LIST, {
        title: result.title,
        slug: result.suggestedSlug || undefined,
        content: result.content,
        excerpt: result.excerpt,
        metaTitle: result.metaTitle,
        metaDescription: result.metaDescription,
        tags: result.suggestedTags,
        categoryId: categoryId || undefined,
        status: 'draft',
      })

      toast.success('สร้างบทความด้วย AI สำเร็จ')
      setOpen(false)
      navigate(`/articles/${article.id}/edit`)
    } catch (err) {
      toast.error('สร้างบทความไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Sparkles className="mr-2 h-4 w-4" />
          สร้างด้วย AI
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            สร้างบทความด้วย AI
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label htmlFor="ai-topic">หัวข้อ *</Label>
            <Input
              id="ai-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="เช่น วิธีเช็คว่าเว็บหลอกลวงหรือไม่"
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>หมวดหมู่</Label>
              <Select value={category} onValueChange={setCategory} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือก" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>โทน</Label>
              <Select value={tone} onValueChange={setTone} disabled={loading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="educational">ให้ความรู้</SelectItem>
                  <SelectItem value="casual">เป็นกันเอง</SelectItem>
                  <SelectItem value="formal">ทางการ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>ความยาว</Label>
            <Select value={length} onValueChange={setLength} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">สั้น (~500 คำ)</SelectItem>
                <SelectItem value="medium">ปานกลาง (~1,000 คำ)</SelectItem>
                <SelectItem value="long">ยาว (~2,000 คำ)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="ai-keywords">Keywords (คั่นด้วย comma)</Label>
            <Input
              id="ai-keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="เว็บหลอกลวง, ตรวจสอบ, ป้องกันโกง"
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="ai-outline">โครงร่าง (1 ข้อ/บรรทัด, optional)</Label>
            <Textarea
              id="ai-outline"
              value={outline}
              onChange={(e) => setOutline(e.target.value)}
              placeholder={"วิธีสังเกต\nเครื่องมือที่ใช้ตรวจ\nสรุป"}
              rows={3}
              disabled={loading}
            />
          </div>

          <Button
            className="w-full"
            onClick={handleGenerate}
            disabled={loading || !topic.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                กำลังสร้าง... (15-30 วินาที)
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                สร้างบทความ
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
