import {
  LayoutDashboard,
  ShieldAlert,
  FolderOpen,
  CreditCard,
  Users,
  UserCog,
  Settings,
  Sparkles,
  Database,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  title: string
  url: string
  icon?: LucideIcon
  isActive?: boolean
  items?: { title: string; url: string }[]
}

export const NAV_MAIN: NavItem[] = [
  {
    title: 'แดชบอร์ด',
    url: '/dashboard',
    icon: LayoutDashboard,
    isActive: true,
  },
  {
    title: 'ผู้ใช้งาน',
    url: '/users',
    icon: UserCog,
  },
  {
    title: 'รายชื่อคนโกง',
    url: '/frauds',
    icon: ShieldAlert,
  },
  {
    title: 'หมวดหมู่',
    url: '/categories',
    icon: FolderOpen,
  },
  {
    title: 'สมาชิก',
    url: '#',
    icon: Users,
    items: [
      { title: 'รายการสมาชิก', url: '/membership' },
      { title: 'แพลน', url: '/membership/plans' },
    ],
  },
  {
    title: 'บริการ',
    url: '/services',
    icon: Sparkles,
  },
  {
    title: 'ระบบเก็บข้อมูล',
    url: '/lenders',
    icon: Database,
  },
  {
    title: 'การชำระเงิน',
    url: '#',
    icon: CreditCard,
    items: [
      { title: 'ภาพรวมธุรกรรม', url: '/transactions' },
      { title: 'สมัครสมาชิก (Plan)', url: '/payments' },
      { title: 'สั่งซื้อบริการ AI', url: '/service-payments' },
    ],
  },
  {
    title: 'ตั้งค่า',
    url: '#',
    icon: Settings,
    items: [
      { title: 'โควต้า/ลิมิต', url: '/settings/quota' },
      { title: 'การแสดงผล', url: '/settings/display' },
      { title: 'ชำระเงิน', url: '/settings/payment' },
      { title: 'Social Media', url: '/settings/social' },
      { title: 'ระบบ', url: '/settings/system' },
    ],
  },
]
