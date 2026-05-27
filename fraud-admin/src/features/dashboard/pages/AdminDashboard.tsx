import { ShieldAlert, BadgeCheck, Search, FolderOpen, Users, AlertTriangle, Banknote, Crown, Clock, Bot } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboardStats, useExtendedStats } from '../hooks'

export function AdminDashboard() {
  const { data: stats, isLoading, error } = useDashboardStats()
  const { data: ext } = useExtendedStats()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">แดชบอร์ด</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader><CardContent><Skeleton className="h-8 w-16" /></CardContent></Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">แดชบอร์ด</h1>
        <Card><CardContent className="flex items-center gap-3 py-8"><AlertTriangle className="h-5 w-5 text-destructive" /><p className="text-muted-foreground">ไม่สามารถโหลดข้อมูลได้</p></CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">แดชบอร์ด</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>Admin Panel</span>
        </div>
      </div>

      {/* Revenue KPIs */}
      {ext && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="รายรับวันนี้" value={`${ext.revenueToday.toLocaleString()} ฿`} icon={Banknote} subtitle={`Plan ${ext.planRevenueToday.toLocaleString()} + Service ${ext.serviceRevenueToday.toLocaleString()}`} />
          <KPICard title="รายรับเดือนนี้" value={`${ext.revenueMonth.toLocaleString()} ฿`} icon={Banknote} subtitle={`Plan ${ext.planRevenueMonth.toLocaleString()} + Service ${ext.serviceRevenueMonth.toLocaleString()}`} />
          <KPICard title="สมาชิก Active" value={ext.activeSubscribers.toLocaleString()} icon={Crown} subtitle={`จากผู้ใช้ทั้งหมด ${ext.totalUsers.toLocaleString()} คน`} />
          <KPICard title="รอตรวจสอบ" value={(ext.pendingPayments + ext.pendingServicePayments).toLocaleString()} icon={Clock} subtitle={`Plan ${ext.pendingPayments} + Service ${ext.pendingServicePayments}`} highlight={ext.pendingPayments + ext.pendingServicePayments > 0} />
        </div>
      )}

      {/* Fraud KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="รายชื่อทั้งหมด" value={(stats?.totalFrauds || 0).toLocaleString()} icon={ShieldAlert} />
        <KPICard title="ยืนยันแล้ว" value={(stats?.totalVerified || 0).toLocaleString()} icon={BadgeCheck} />
        <KPICard title="การค้นหา" value={(stats?.totalSearches || 0).toLocaleString()} icon={Search} />
        <KPICard title="หมวดหมู่" value={String(stats?.categoryStats?.length || 0)} icon={FolderOpen} />
      </div>

      {/* Category Breakdown */}
      {stats?.categoryStats && stats.categoryStats.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">แยกตามหมวดหมู่</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.categoryStats.map((cat) => {
                const pct = stats.totalFrauds > 0 ? Math.round((cat.fraudCount / stats.totalFrauds) * 100) : 0
                return (
                  <div key={cat.categoryId} className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate">{cat.categoryName}</span>
                        <span className="text-sm text-muted-foreground">{cat.fraudCount.toLocaleString()}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className="text-sm font-mono text-muted-foreground w-10 text-right">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function KPICard({ title, value, icon: Icon, subtitle, highlight }: {
  title: string; value: string; icon: typeof Banknote; subtitle?: string; highlight?: boolean
}) {
  return (
    <Card className={highlight ? 'border-orange-500/50' : ''}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${highlight ? 'text-orange-500' : 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}
