import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Search, BadgeCheck, Clock, ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react'
import { useFraudList, type FraudListParams } from '../hooks'
import { FraudDetailSheet } from '../components/FraudDetailSheet'
import type { FraudItem } from '../types'

function displayName(fraud: FraudItem): string {
  if (fraud.firstName || fraud.lastName) {
    return [fraud.firstName, fraud.lastName].filter(Boolean).join(' ')
  }
  return fraud.name || '-'
}

export function FraudListPage() {
  const [params, setParams] = useState<FraudListParams>({ page: 1, limit: 20 })
  const [searchInput, setSearchInput] = useState('')
  const [selectedFraud, setSelectedFraud] = useState<FraudItem | null>(null)
  const { data, isLoading } = useFraudList(params)

  const handleSearch = () => {
    setParams((p: FraudListParams) => ({ ...p, q: searchInput || undefined, page: 1 }))
  }

  const handleFilter = (key: string, value: string) => {
    setParams((p: FraudListParams) => ({ ...p, [key]: value === 'all' ? undefined : value, page: 1 }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">รายชื่อคนโกง</h1>
        <Badge variant="outline" className="gap-1">
          <ShieldAlert className="h-3 w-3" />
          {data?.meta?.total || 0} รายการ
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex gap-2 flex-1 min-w-[200px]">
              <Input
                placeholder="ค้นหาชื่อ / เบอร์ / บัญชี / บัตร ปชช."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} size="icon" variant="outline">
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <Select
              value={params.verified || 'all'}
              onValueChange={(v) => handleFilter('verified', v)}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="true">ยืนยันแล้ว</SelectItem>
                <SelectItem value="false">รอตรวจสอบ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อ-นามสกุล</TableHead>
                  <TableHead>เบอร์โทร</TableHead>
                  <TableHead>บัญชี</TableHead>
                  <TableHead>บัตร ปชช.</TableHead>
                  <TableHead>หมวดหมู่</TableHead>
                  <TableHead>รายงาน</TableHead>
                  <TableHead>สถานะ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.length ? data.data.map((fraud) => (
                  <TableRow
                    key={fraud.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedFraud(fraud)}
                  >
                    <TableCell>
                      <div className="font-medium">{displayName(fraud)}</div>
                      {fraud.socialAccounts && fraud.socialAccounts.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {fraud.socialAccounts.join(', ')}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{fraud.phone || '-'}</TableCell>
                    <TableCell>
                      <div className="font-mono text-sm">{fraud.bankAccount || '-'}</div>
                      {fraud.bankName && <div className="text-xs text-muted-foreground">{fraud.bankName}</div>}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{fraud.idCard || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{fraud.categoryName}</Badge>
                    </TableCell>
                    <TableCell>{fraud.reportCount}</TableCell>
                    <TableCell>
                      {fraud.verified
                        ? <Badge variant="default" className="gap-1"><BadgeCheck className="h-3 w-3" />ยืนยัน</Badge>
                        : <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />รอ</Badge>
                      }
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      ไม่พบข้อมูล
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* Pagination — แสดงเสมอ */}
        {data?.meta && (
          <CardContent className="border-t flex items-center justify-between py-3">
            <p className="text-sm text-muted-foreground">
              หน้า {data.meta.page} / {Math.max(data.meta.totalPages, 1)} ({data.meta.total} รายการ)
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline" size="icon"
                disabled={!data.meta.hasPrev}
                onClick={() => setParams((p: FraudListParams) => ({ ...p, page: (p.page || 1) - 1 }))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline" size="icon"
                disabled={!data.meta.hasNext}
                onClick={() => setParams((p: FraudListParams) => ({ ...p, page: (p.page || 1) + 1 }))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Detail Sheet */}
      <FraudDetailSheet
        fraud={selectedFraud}
        open={!!selectedFraud}
        onClose={() => setSelectedFraud(null)}
      />
    </div>
  )
}
