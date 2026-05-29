'use client'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="text-6xl font-bold text-muted-foreground">500</div>
      <h1 className="text-2xl font-semibold">เกิดข้อผิดพลาด</h1>
      <p className="text-muted-foreground">ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง</p>
      <button
        onClick={reset}
        className="mt-4 rounded-lg bg-primary px-6 py-2 text-primary-foreground hover:bg-primary/90"
      >
        ลองใหม่
      </button>
    </div>
  )
}
