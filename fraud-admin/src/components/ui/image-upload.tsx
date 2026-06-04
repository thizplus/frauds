import { useState, useRef } from 'react'
import { Camera, Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { Button } from './button'

interface ImageUploadProps {
  value: string
  onChange: (url: string) => void
  folder?: string
  /** วงกลม (avatar) หรือ สี่เหลี่ยม (cover) */
  variant?: 'avatar' | 'cover'
  placeholder?: string
}

export function ImageUpload({ value, onChange, folder = 'uploads', variant = 'cover', placeholder }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('ไฟล์มีขนาดเกิน 5MB')
      return
    }

    if (!file.type.startsWith('image/')) {
      toast.error('รองรับเฉพาะไฟล์รูปภาพ')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await apiClient.post<{ url: string }>(`/uploads?folder=${folder}`, formData)
      onChange(res.url)
      toast.success('อัปโหลดสำเร็จ')
    } catch {
      toast.error('อัปโหลดไม่สำเร็จ')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleRemove = () => {
    onChange('')
  }

  if (variant === 'avatar') {
    return (
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-muted overflow-hidden flex items-center justify-center">
            {value ? (
              <img src={value} alt="" className="w-full h-full object-cover" />
            ) : (
              <Camera className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          {uploading && (
            <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-white" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            {value ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={handleRemove} className="text-destructive">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              ลบรูป
            </Button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      </div>
    )
  }

  // Cover variant
  return (
    <div>
      {value ? (
        <div className="relative group">
          <img src={value} alt="" className="w-full h-40 object-cover rounded-md border border-input" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors rounded-md flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Camera className="w-4 h-4 mr-1.5" />
              เปลี่ยน
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={handleRemove}>
              <Trash2 className="w-4 h-4 mr-1.5" />
              ลบ
            </Button>
          </div>
          {uploading && (
            <div className="absolute inset-0 bg-black/50 rounded-md flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-white" />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full h-32 border-2 border-dashed border-input rounded-md flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer"
        >
          {uploading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              <Upload className="w-6 h-6" />
              <span className="text-sm">{placeholder || 'อัปโหลดรูปภาพ'}</span>
            </>
          )}
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
    </div>
  )
}
