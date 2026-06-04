import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ArrowLeft, Save, Globe, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { TipTapEditor } from '../components/TipTapEditor'
import { useArticleDetail, useCreateArticle, useUpdateArticle, useArticleCategories } from '../hooks'

export function ArticleEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const { data: article, isLoading } = useArticleDetail(isNew ? '' : id!)
  const { data: categories } = useArticleCategories()
  const createMutation = useCreateArticle()
  const updateMutation = useUpdateArticle()

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [content, setContent] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [metaTitle, setMetaTitle] = useState('')
  const [metaDescription, setMetaDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [isFeatured, setIsFeatured] = useState(false)
  const [authorDisplayName, setAuthorDisplayName] = useState('')
  const [authorBio, setAuthorBio] = useState('')
  const [authorAvatar, setAuthorAvatar] = useState('')

  useEffect(() => {
    if (article && !isNew) {
      setTitle(article.title)
      setSlug(article.slug)
      setExcerpt(article.excerpt || '')
      setContent(article.content || '')
      setCoverImage(article.coverImage || '')
      setCategoryId(article.categoryId || '')
      setMetaTitle(article.metaTitle || '')
      setMetaDescription(article.metaDescription || '')
      setTags(article.tags || [])
      setIsFeatured(article.isFeatured)
      setAuthorDisplayName(article.authorName || '')
      setAuthorBio(article.authorBio || '')
      setAuthorAvatar(article.authorAvatar || '')
    }
  }, [article, isNew])

  const handleSave = (status: 'draft' | 'published') => {
    if (!title.trim()) {
      toast.error('กรุณากรอกหัวข้อบทความ')
      return
    }
    if (!content.trim()) {
      toast.error('กรุณาเขียนเนื้อหาบทความ')
      return
    }

    const data = {
      title,
      slug: slug || undefined,
      excerpt,
      content,
      coverImage: coverImage || undefined,
      categoryId: categoryId || undefined,
      status,
      metaTitle: metaTitle || undefined,
      metaDescription: metaDescription || undefined,
      tags,
      isFeatured,
      authorDisplayName: authorDisplayName || undefined,
      authorBio: authorBio || undefined,
      authorAvatar: authorAvatar || undefined,
    }

    if (isNew) {
      createMutation.mutate(data, {
        onSuccess: (res) => {
          toast.success(status === 'published' ? 'เผยแพร่บทความสำเร็จ' : 'บันทึกแบบร่างสำเร็จ')
          navigate(`/articles/${res.id}/edit`, { replace: true })
        },
        onError: () => toast.error('บันทึกไม่สำเร็จ'),
      })
    } else {
      updateMutation.mutate({ id: id!, data }, {
        onSuccess: () => toast.success('บันทึกสำเร็จ'),
        onError: () => toast.error('บันทึกไม่สำเร็จ'),
      })
    }
  }

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()])
      }
      setTagInput('')
    }
  }

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  if (!isNew && isLoading) {
    return <Skeleton className="h-96 w-full" />
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/articles')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          กลับ
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleSave('draft')} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            บันทึกแบบร่าง
          </Button>
          <Button onClick={() => handleSave('published')} disabled={isSaving}>
            <Globe className="mr-2 h-4 w-4" />
            เผยแพร่
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label htmlFor="title">หัวข้อ</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="หัวข้อบทความ" className="text-lg font-semibold" />
              </div>
              <div>
                <Label>เนื้อหา</Label>
                <TipTapEditor content={content} onChange={setContent} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">ตั้งค่า</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="slug">Slug (URL)</Label>
                <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-generate จาก title" />
              </div>
              <div>
                <Label>หมวดหมู่</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกหมวดหมู่" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">ไม่ระบุ</SelectItem>
                    {categories?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="cover">รูปปก (URL)</Label>
                <Input id="cover" value={coverImage} onChange={(e) => setCoverImage(e.target.value)} placeholder="https://..." />
                {coverImage && (
                  <img src={coverImage} alt="Cover" className="mt-2 rounded-md max-h-32 object-cover w-full" />
                )}
              </div>
              <div>
                <Label>Tags</Label>
                <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleAddTag} placeholder="พิมพ์แล้ว Enter" />
                {tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        {tag}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(tag)} />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <Label>บทความแนะนำ</Label>
                <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">SEO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="excerpt">สรุปสั้นๆ (Excerpt)</Label>
                <Textarea id="excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="สรุปบทความ 1-2 ประโยค" rows={3} />
              </div>
              <div>
                <Label htmlFor="metaTitle">Meta Title</Label>
                <Input id="metaTitle" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder="ถ้าไม่กรอก ใช้หัวข้อ" />
                <p className="text-xs text-muted-foreground mt-1">{metaTitle.length}/200</p>
              </div>
              <div>
                <Label htmlFor="metaDesc">Meta Description</Label>
                <Textarea id="metaDesc" value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} placeholder="ถ้าไม่กรอก ใช้ excerpt" rows={3} />
                <p className="text-xs text-muted-foreground mt-1">{metaDescription.length}/500</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">ผู้เขียน</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="authorName">ชื่อผู้เขียน</Label>
                <Input id="authorName" value={authorDisplayName} onChange={(e) => setAuthorDisplayName(e.target.value)} placeholder="ถ้าไม่กรอก ใช้ชื่อ admin" />
              </div>
              <div>
                <Label htmlFor="authorBio">Bio</Label>
                <Textarea id="authorBio" value={authorBio} onChange={(e) => setAuthorBio(e.target.value)} placeholder="คำอธิบายสั้นๆ เกี่ยวกับผู้เขียน" rows={2} />
              </div>
              <div>
                <Label htmlFor="authorAvatar">รูปผู้เขียน (URL)</Label>
                <Input id="authorAvatar" value={authorAvatar} onChange={(e) => setAuthorAvatar(e.target.value)} placeholder="https://..." />
                {authorAvatar && (
                  <img src={authorAvatar} alt="Author" className="mt-2 w-12 h-12 rounded-full object-cover" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
