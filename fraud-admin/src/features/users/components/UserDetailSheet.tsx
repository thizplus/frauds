import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { User, Mail, Shield, Calendar, MessageCircle, Activity, Crown, FileText, CreditCard, Bot, Search } from 'lucide-react'
import type { UserItem } from '../types'
import { useUserDetail } from '../hooks'

interface UserDetailSheetProps {
  user: UserItem | null
  open: boolean
  onClose: () => void
}

export function UserDetailSheet({ user, open, onClose }: UserDetailSheetProps) {
  const { data: detail, isLoading } = useUserDetail(open && user ? user.id : null)

  if (!user) return null

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const sub = detail?.subscription

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-lg overflow-y-auto p-6">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                {user.name}
                {user.role === 'admin'
                  ? <Badge variant="destructive">แอดมิน</Badge>
                  : <Badge variant="secondary">สมาชิก</Badge>
                }
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <DetailRow icon={User} label="ชื่อ" value={user.name} />
          <DetailRow icon={Mail} label="อีเมล" value={user.email} />
          <DetailRow icon={Shield} label="บทบาท" value={user.role === 'admin' ? 'แอดมิน' : 'สมาชิก'} />
          <DetailRow icon={MessageCircle} label="ล็อกอิน" value={user.lineUserId ? 'LINE' : 'อีเมล'} />
          <DetailRow icon={Activity} label="สถานะ" value={user.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'} />
          <DetailRow icon={Calendar} label="วันที่สมัคร" value={new Date(user.createdAt).toLocaleDateString('th-TH')} />

          {/* Subscription */}
          <Separator />
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : sub ? (
            <div className="rounded-lg border p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">{sub.planName}</span>
                <Badge variant="default">{sub.status}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                เหลือ {sub.daysLeft} วัน (ถึง {new Date(sub.endDate).toLocaleDateString('th-TH')})
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Crown className="h-4 w-4" />
              <span>Free (ไม่มี subscription)</span>
            </div>
          )}

          {/* Activity counts */}
          {!isLoading && detail && (
            <>
              <Separator />
              <p className="text-xs font-semibold text-muted-foreground">กิจกรรม</p>
              <div className="grid grid-cols-2 gap-2">
                <StatCard icon={FileText} label="รายงาน" value={detail.reportCount} />
                <StatCard icon={Search} label="ค้นหา" value={detail.searchCount} />
                <StatCard icon={CreditCard} label="ชำระ Plan" value={detail.paymentCount} />
                <StatCard icon={Bot} label="สั่งซื้อ AI" value={detail.servicePaymentCount} />
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: number }) {
  return (
    <div className="rounded-lg border p-2.5 flex items-center gap-2.5">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div>
        <p className="text-lg font-bold leading-none">{value}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}
