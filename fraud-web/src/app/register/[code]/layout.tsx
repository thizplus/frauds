import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ลงทะเบียนข้อมูล — เช็กคนโกง',
  description: 'ลงทะเบียนข้อมูลส่วนตัว',
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children
}
