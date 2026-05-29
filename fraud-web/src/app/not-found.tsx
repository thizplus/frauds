import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="text-6xl font-bold text-muted-foreground">404</div>
      <h1 className="text-2xl font-semibold">ไม่พบหน้าที่ค้นหา</h1>
      <p className="text-muted-foreground">หน้านี้อาจถูกย้าย ลบ หรือ URL ไม่ถูกต้อง</p>
      <Link
        href="/"
        className="mt-4 rounded-lg bg-primary px-6 py-2 text-primary-foreground hover:bg-primary/90"
      >
        กลับหน้าแรก
      </Link>
    </div>
  )
}
