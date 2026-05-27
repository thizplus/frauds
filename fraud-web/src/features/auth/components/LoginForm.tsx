'use client'

import { LogIn } from 'lucide-react'

const LINE_CHANNEL_ID = process.env.NEXT_PUBLIC_LINE_CHANNEL_ID || '2010174410'
const LINE_CALLBACK_URL = typeof window !== 'undefined'
  ? `${window.location.origin}/auth/line/callback`
  : 'http://localhost:3001/auth/line/callback'

interface LoginFormProps {
  onSuccess?: () => void
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const handleLineLogin = () => {
    const state = Math.random().toString(36).substring(7)
    const url = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${LINE_CHANNEL_ID}&redirect_uri=${encodeURIComponent(LINE_CALLBACK_URL)}&scope=profile%20openid%20email&state=${state}`
    window.location.href = url
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center mb-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3"
          style={{ background: 'var(--accent-dim)', border: '1px solid var(--border-accent)' }}>
          <LogIn size={22} style={{ color: 'var(--accent)' }} />
        </div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
          เข้าสู่ระบบ
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          เข้าสู่ระบบเพื่อดูข้อมูลเต็มและสมัครสมาชิก
        </p>
      </div>

      <button
        type="button"
        className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold text-white text-base transition-all hover:brightness-110"
        style={{ background: '#06C755' }}
        onClick={handleLineLogin}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
          <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
        </svg>
        เข้าสู่ระบบด้วยบัญชี LINE
      </button>

      <p className="text-xs text-center" style={{ color: 'var(--text-faint)' }}>
        ไม่ต้องสมัครสมาชิก กดปุ่มเดียวเข้าใช้ได้เลย
      </p>
    </div>
  )
}
