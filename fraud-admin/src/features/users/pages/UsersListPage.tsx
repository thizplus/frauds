import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Search, ChevronLeft, ChevronRight, Users, Mail, MessageCircle } from 'lucide-react'
import { useUserList } from '../hooks'
import type { UserListParams } from '../service'
import { UserDetailSheet } from '../components/UserDetailSheet'
import type { UserItem } from '../types'

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const AVATAR_COLORS = [
  'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500',
  'bg-orange-500', 'bg-pink-500', 'bg-teal-500', 'bg-indigo-500',
]

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function UsersListPage() {
  const [params, setParams] = useState<UserListParams>({ page: 1, limit: 20 })
  const [searchInput, setSearchInput] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null)
  const { data, isLoading } = useUserList(params)

  const handleSearch = () => {
    setParams((p) => ({ ...p, q: searchInput || undefined, page: 1 }))
  }

  const handleFilter = (key: string, value: string) => {
    setParams((p) => ({ ...p, [key]: value === 'all' ? undefined : value, page: 1 }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ผู้ใช้งาน</h1>
        <Badge variant="outline" className="gap-1">
          <Users className="h-3 w-3" />
          {data?.meta?.total || 0} คน
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex gap-2 flex-1 min-w-[200px]">
              <Input
                placeholder="ค้นหาชื่อ / อีเมล"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} size="icon" variant="outline">
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <Select
              value={params.role || 'all'}
              onValueChange={(v) => handleFilter('role', v)}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="บทบาท" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="admin">แอดมิน</SelectItem>
                <SelectItem value="member">สมาชิก</SelectItem>
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
                  <TableHead>ผู้ใช้</TableHead>
                  <TableHead>อีเมล</TableHead>
                  <TableHead>บทบาท</TableHead>
                  <TableHead>ล็อกอิน</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>วันที่สมัคร</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.length ? data.data.map((user) => (
                  <TableRow
                    key={user.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedUser(user)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          {user.avatarUrl ? (
                            <AvatarImage src={user.avatarUrl} alt={user.name} />
                          ) : null}
                          <AvatarFallback className={`${getAvatarColor(user.name)} text-white text-xs`}>
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{user.email}</TableCell>
                    <TableCell>
                      {user.role === 'admin'
                        ? <Badge variant="destructive">แอดมิน</Badge>
                        : <Badge variant="secondary">สมาชิก</Badge>
                      }
                    </TableCell>
                    <TableCell>
                      {user.lineUserId
                        ? <MessageCircle className="h-4 w-4 text-green-500" />
                        : <Mail className="h-4 w-4 text-muted-foreground" />
                      }
                    </TableCell>
                    <TableCell>
                      {user.isActive
                        ? <Badge variant="default">ใช้งาน</Badge>
                        : <Badge variant="secondary">ปิดใช้งาน</Badge>
                      }
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString('th-TH')}
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      ไม่พบข้อมูล
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* Pagination */}
        {data?.meta && data.meta.totalPages > 1 && (
          <CardContent className="border-t flex items-center justify-between py-3">
            <p className="text-sm text-muted-foreground">
              หน้า {data.meta.page} / {data.meta.totalPages} ({data.meta.total} คน)
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline" size="icon"
                disabled={!data.meta.hasPrev}
                onClick={() => setParams((p) => ({ ...p, page: (p.page || 1) - 1 }))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline" size="icon"
                disabled={!data.meta.hasNext}
                onClick={() => setParams((p) => ({ ...p, page: (p.page || 1) + 1 }))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Detail Sheet */}
      <UserDetailSheet
        user={selectedUser}
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
      />
    </div>
  )
}
