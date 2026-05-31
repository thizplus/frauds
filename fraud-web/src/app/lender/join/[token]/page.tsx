'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Users, Loader2, AlertTriangle, CheckCircle, ArrowLeft } from 'lucide-react'
import { useAuthStore } from '@/lib/stores/auth'
import { LoginModal } from '@/features/auth'
import { lenderService } from '@/features/lender/service'
import { useJoinLender } from '@/features/lender'
import type { JoinLenderInfo } from '@/features/lender'
import Link from 'next/link'

export default function JoinLenderPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  const [mounted, setMounted] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [info, setInfo] = useState<JoinLenderInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const joinMutation = useJoinLender()

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted || !isLoggedIn || !token) return
    setLoading(true)
    lenderService.getJoinInfo(token)
      .then(setInfo)
      .catch(() => setLoadError('ลิงก์ไม่ถูกต้องหรือถูกใช้งานแล้ว'))
      .finally(() => setLoading(false))
  }, [mounted, isLoggedIn, token])

  if (!mounted) return null

  if (!isLoggedIn) {
    return (
      <>
        <section className="flex-1 flex items-center justify-center px-4">
          <div className="card p-8 text-center max-w-sm w-full">
            <AlertTriangle className="w-10 h-10 mx-auto mb-4" style={{ color: 'var(--accent)' }} />
            <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>ต้องเข้าสู่ระบบก่อน</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>กรุณาเข้าสู่ระบบเพื่อเข้าร่วมระบบ</p>
            <button className="btn btn-primary btn-lg w-full" onClick={() => setShowLogin(true)}>เข้าสู่ระบบ</button>
          </div>
        </section>
        <LoginModal open={showLogin} onOpenChange={setShowLogin} />
      </>
    )
  }

  if (loading) {
    return <section className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} /></section>
  }

  if (loadError || !info) {
    return (
      <section className="w-full max-w-lg mx-auto px-4 py-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft className="w-4 h-4" />กลับ
        </Link>
        <div className="card p-8 text-center">
          <AlertTriangle className="w-10 h-10 mx-auto mb-4" style={{ color: 'var(--danger)' }} />
          <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>ลิงก์ไม่ถูกต้อง</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{loadError || 'ลิงก์หมดอายุหรือถูกใช้งานแล้ว'}</p>
        </div>
      </section>
    )
  }

  if (joinMutation.isSuccess) {
    return (
      <section className="w-full max-w-lg mx-auto px-4 py-8">
        <div className="card p-8 text-center">
          <CheckCircle className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--accent)' }} />
          <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>เข้าร่วมสำเร็จ!</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>คุณเป็นผู้ดูแลระบบ &quot;{info.businessName}&quot; แล้ว</p>
          <button className="btn btn-primary btn-lg w-full" onClick={() => router.push('/lender')}>
            เข้าสู่ระบบเก็บข้อมูล
          </button>
        </div>
      </section>
    )
  }

  const handleJoin = () => {
    joinMutation.mutate(token)
  }

  return (
    <section className="w-full max-w-lg mx-auto px-4 py-8">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeft className="w-4 h-4" />กลับ
      </Link>

      <div className="card p-8 text-center">
        <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--accent-dim)', border: '2px solid var(--accent)' }}>
          <Users className="w-8 h-8" style={{ color: 'var(--accent)' }} />
        </div>

        <h2 className="text-xl font-extrabold mb-1" style={{ color: 'var(--text)' }}>เข้าร่วมระบบ</h2>
        <p className="text-lg font-bold mb-1" style={{ color: 'var(--accent)' }}>{info.businessName}</p>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>เจ้าของ: {info.ownerName}</p>

        {joinMutation.error && (
          <div className="card p-3 mb-4 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>
            {(joinMutation.error as any)?.response?.data?.error?.message || 'เกิดข้อผิดพลาด'}
          </div>
        )}

        <button className="btn btn-primary btn-lg w-full flex items-center justify-center gap-2"
          onClick={handleJoin} disabled={joinMutation.isPending}>
          {joinMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Users className="w-5 h-5" />}
          {joinMutation.isPending ? 'กำลังเข้าร่วม...' : 'เข้าร่วมระบบ'}
        </button>
      </div>
    </section>
  )
}
