import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Database } from 'lucide-react'
import { useLenderList } from '../hooks'
import { LenderDetailSheet } from '../components/LenderDetailSheet'
import type { LenderItem } from '../types'

export function LendersPage() {
  const { data: lenders, isLoading } = useLenderList()
  const [selected, setSelected] = useState<LenderItem | null>(null)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ระบบเก็บข้อมูล</h1>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อระบบ</TableHead>
                  <TableHead>เจ้าของ</TableHead>
                  <TableHead>รหัสเชิญ</TableHead>
                  <TableHead>สมาชิก</TableHead>
                  <TableHead>โกง</TableHead>
                  <TableHead>วันที่สร้าง</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lenders?.length ? lenders.map((l) => (
                  <TableRow key={l.id} className="cursor-pointer" onClick={() => setSelected(l)}>
                    <TableCell className="font-medium">{l.businessName}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{l.userName}</div>
                        <div className="text-xs text-muted-foreground">{l.userEmail}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{l.inviteCode}</TableCell>
                    <TableCell>{l.debtorCount}</TableCell>
                    <TableCell>
                      {l.flaggedCount > 0 ? (
                        <Badge variant="destructive">{l.flaggedCount}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{new Date(l.createdAt).toLocaleDateString('th-TH')}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      ยังไม่มีระบบเก็บข้อมูล
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <LenderDetailSheet lender={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  )
}
