import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Camera, Loader2, Save } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { AUTH_ROUTES } from '@/constants/api-routes'
import { useAuthStore } from '../store/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { User } from '../types'

export function ProfilePage() {
  const qc = useQueryClient()
  const setUser = useAuthStore((s) => s.setUser)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.get<User>(AUTH_ROUTES.PROFILE),
  })

  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [password, setPassword] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (profile) {
      setName(profile.name)
      setAvatarUrl(profile.avatarUrl || '')
    }
  }, [profile])

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; avatarUrl?: string; password?: string }) =>
      apiClient.patch<User>(AUTH_ROUTES.UPDATE_PROFILE, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['profile'] })
      setUser(updated)
      toast.success('บันทึกโปรไฟล์สำเร็จ')
      setPassword('')
    },
    onError: () => toast.error('บันทึกไม่สำเร็จ'),
  })

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await apiClient.post<{ url: string }>(AUTH_ROUTES.UPLOAD, formData)
      setAvatarUrl(res.url)
      toast.success('อัปโหลดรูปสำเร็จ')
    } catch {
      toast.error('อัปโหลดรูปไม่สำเร็จ')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = () => {
    const data: { name?: string; avatarUrl?: string; password?: string } = {}
    if (name !== profile?.name) data.name = name
    if (avatarUrl !== (profile?.avatarUrl || '')) data.avatarUrl = avatarUrl
    if (password) data.password = password

    if (Object.keys(data).length === 0) {
      toast.info('ไม่มีข้อมูลที่เปลี่ยนแปลง')
      return
    }

    updateMutation.mutate(data)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">กำลังโหลด...</CardContent>
      </Card>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>โปรไฟล์</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-muted overflow-hidden flex items-center justify-center text-2xl font-bold text-muted-foreground">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span>{name?.charAt(0)?.toUpperCase() || 'A'}</span>
                )}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:opacity-80 transition-opacity"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUploadAvatar} />
            </div>
            <div>
              <p className="font-semibold">{profile?.name}</p>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
              <p className="text-xs text-muted-foreground capitalize">{profile?.role}</p>
            </div>
          </div>

          <Separator />

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">ชื่อ</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อที่แสดง" />
          </div>

          {/* Avatar URL (manual) */}
          <div className="space-y-2">
            <Label htmlFor="avatar">URL รูปโปรไฟล์</Label>
            <Input id="avatar" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
          </div>

          <Separator />

          {/* Change password */}
          <div className="space-y-2">
            <Label htmlFor="password">เปลี่ยนรหัสผ่าน</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)" />
          </div>

          <Button onClick={handleSave} disabled={updateMutation.isPending} className="w-full">
            {updateMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> กำลังบันทึก...</>
            ) : (
              <><Save className="mr-2 h-4 w-4" /> บันทึก</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
