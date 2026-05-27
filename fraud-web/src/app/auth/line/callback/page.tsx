'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/auth'
import { authService } from '@/features/auth'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'

function LineCallbackContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      // ถ้าไม่มี code อาจเป็นเพราะ redirect กลับมาหลัง login สำเร็จแล้ว
      if (useAuthStore.getState().isLoggedIn) {
        setStatus('success')
        setTimeout(() => router.push('/'), 500)
      } else {
        setStatus('error')
        setErrorMsg('ไม่พบ authorization code')
      }
      return
    }

    // ลบ code ออกจาก URL ทันที — ป้องกัน double call จาก StrictMode
    window.history.replaceState({}, '', window.location.pathname)

    const redirectUri = `${window.location.origin}/auth/line/callback`

    authService.lineLogin({ code, redirectUri })
      .then((data) => {
        setAuth({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            role: data.user.role,
            isActive: true,
            avatarUrl: data.user.avatarUrl,
          },
        })
        setStatus('success')
        setTimeout(() => router.push('/'), 3000)
      })
      .catch((err) => {
        setStatus('error')
        setErrorMsg(err?.response?.data?.error?.message || 'LINE Login ไม่สำเร็จ')
      })
  }, [searchParams, setAuth, router])

  return (
    <section className="flex-1 flex items-center justify-center px-4">
      <div className="card p-8 text-center max-w-sm w-full">
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 mx-auto mb-4 animate-spin" style={{ color: 'var(--accent)' }} />
            <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>กำลังเข้าสู่ระบบ...</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>กรุณารอสักครู่</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-10 h-10 mx-auto mb-4" style={{ color: 'var(--accent)' }} />
            <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>เข้าสู่ระบบสำเร็จ!</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>กำลังพาไปหน้าหลัก...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle className="w-10 h-10 mx-auto mb-4" style={{ color: 'var(--danger)' }} />
            <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>เข้าสู่ระบบไม่สำเร็จ</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{errorMsg}</p>
            <a href="/" className="btn btn-primary">กลับหน้าหลัก</a>
          </>
        )}
      </div>
    </section>
  )
}

export default function LineCallbackPage() {
  return (
    <Suspense fallback={
      <section className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} />
      </section>
    }>
      <LineCallbackContent />
    </Suspense>
  )
}
