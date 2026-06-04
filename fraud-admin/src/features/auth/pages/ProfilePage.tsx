import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { AUTH_ROUTES } from '@/constants/api-routes'
import { useAuthStore } from '../store/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ImageUpload } from '@/components/ui/image-upload'
import type { User } from '../types'

export function ProfilePage() {
  const qc = useQueryClient()
  const setUser = useAuthStore((s) => s.setUser)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.get<User>(AUTH_ROUTES.PROFILE),
  })

  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (profile) {
      setName(profile.name)
      setBio(profile.bio || '')
      setAvatarUrl(profile.avatarUrl || '')
    }
  }, [profile])

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; bio?: string; avatarUrl?: string; password?: string }) =>
      apiClient.patch<User>(AUTH_ROUTES.UPDATE_PROFILE, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['profile'] })
      setUser(updated)
      toast.success('บันทึกโปรไฟล์สำเร็จ')
      setPassword('')
    },
    onError: () => toast.error('บันทึกไม่สำเร็จ'),
  })

  const handleSave = () => {
    const data: { name?: string; bio?: string; avatarUrl?: string; password?: string } = {}
    if (name !== profile?.name) data.name = name
    if (bio !== (profile?.bio || '')) data.bio = bio
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
            <ImageUpload value={avatarUrl} onChange={setAvatarUrl} folder="avatars" variant="avatar" />
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

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="แนะนำตัวสั้นๆ เช่น นักเขียนด้านความปลอดภัยออนไลน์" rows={3} />
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
