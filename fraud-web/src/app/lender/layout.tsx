import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ระบบเก็บข้อมูล — เช็กคนโกง',
  description: 'ระบบจัดการข้อมูลสมาชิก เช็คประวัติ แจ้งโกง สำหรับผู้ประกอบการ',
}

export default function LenderLayout({ children }: { children: React.ReactNode }) {
  return children
}
