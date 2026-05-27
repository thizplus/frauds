'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuthStore } from '@/lib/stores/auth'
import { authService } from '@/features/auth'

interface LiffContextType {
  isInLiff: boolean
  isReady: boolean
}

const LiffContext = createContext<LiffContextType>({ isInLiff: false, isReady: false })

export function useLiff() {
  return useContext(LiffContext)
}

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || ''

export function LiffProvider({ children }: { children: ReactNode }) {
  const [isInLiff, setIsInLiff] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const { isLoggedIn, setAuth } = useAuthStore()

  useEffect(() => {
    if (!LIFF_ID) {
      setIsReady(true)
      return
    }

    let mounted = true

    async function initLiff() {
      try {
        const liff = (await import('@line/liff')).default
        await liff.init({ liffId: LIFF_ID })

        if (!mounted) return

        const inClient = liff.isInClient()
        setIsInLiff(inClient)

        // ถ้าอยู่ใน LINE + ยังไม่ได้ login → auto-login
        if (inClient && !isLoggedIn) {
          try {
            const accessToken = liff.getAccessToken()
            if (accessToken) {
              // ส่ง LIFF access token ไป Go API
              const data = await authService.liffLogin(accessToken)
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
            }
          } catch (err) {
            console.error('LIFF auto-login failed:', err)
          }
        }
      } catch (err) {
        console.error('LIFF init failed:', err)
      } finally {
        if (mounted) setIsReady(true)
      }
    }

    initLiff()
    return () => { mounted = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <LiffContext.Provider value={{ isInLiff, isReady }}>
      {children}
    </LiffContext.Provider>
  )
}
