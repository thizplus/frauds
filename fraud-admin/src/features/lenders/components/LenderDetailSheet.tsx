import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Database, User, Mail, Calendar, Users, Link2 } from 'lucide-react'
import type { LenderItem } from '../types'
import { useLenderDetail } from '../hooks'

const STATUS_LABELS: Record<string, string> = { active: 'ปกติ', flagged: 'โกง', cleared: 'ปลดแล้ว' }
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'secondary', flagged: 'destructive', cleared: 'outline',
}

interface Props {
  lender: LenderItem | null
  open: boolean
  onClose: () => void
}

export function LenderDetailSheet({ lender, open, onClose }: Props) {
  const { data: detail, isLoading } = useLenderDetail(open && lender ? lender.id : null)

  if (!lender) return null

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-lg overflow-y-auto p-6">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {lender.businessName}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <DetailRow icon={User} label="เจ้าของ" value={lender.userName} />
          <DetailRow icon={Mail} label="อีเมล" value={lender.userEmail} />
          <DetailRow icon={Link2} label="รหัสเชิญ" value={lender.inviteCode} />
          <DetailRow icon={Calendar} label="วันที่สร้าง" value={new Date(lender.createdAt).toLocaleDateString('th-TH')} />
          <DetailRow icon={Users} label="สมาชิก" value={`${lender.debtorCount} คน (โกง ${lender.flaggedCount})`} />

          <Separator />

          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            รายชื่อสมาชิก
          </p>

          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : detail?.debtors?.length ? (
            <div className="space-y-2">
              {detail.debtors.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div>
                    <span className="font-medium">{[d.firstName, d.lastName].filter(Boolean).join(' ')}</span>
                    {d.phone && <span className="text-xs text-muted-foreground ml-2 font-mono">{d.phone}</span>}
                  </div>
                  <Badge variant={STATUS_VARIANT[d.status] || 'secondary'}>
                    {STATUS_LABELS[d.status] || d.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีสมาชิก</p>
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
