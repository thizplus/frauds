'use client'

import { useState, useEffect } from 'react'
import { LogOut } from 'lucide-react'
import { useAuthStore } from '@/lib/stores/auth'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { authService } from '@/features/auth'

export function FloatingUser() {
  const [mounted, setMounted] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [authState, setAuthState] = useState<{
    isLoggedIn: boolean
    name: string | null
    role: string | null
    avatarUrl: string | null
  }>({ isLoggedIn: false, name: null, role: null, avatarUrl: null })

  const logout = useAuthStore((s) => s.logout)

  useEffect(() => {
    setMounted(true)
    const state = useAuthStore.getState()
    setAuthState({
      isLoggedIn: state.isLoggedIn,
      name: state.user?.name || null,
      role: state.user?.role || null,
      avatarUrl: state.user?.avatarUrl || null,
    })

    // ถ้า login อยู่แต่ไม่มี avatarUrl → fetch profile จาก API
    if (state.isLoggedIn && !state.user?.avatarUrl) {
      authService.getProfile().then((profile) => {
        if (profile.avatarUrl) {
          const currentUser = useAuthStore.getState().user
          if (currentUser) {
            useAuthStore.getState().setUser({ ...currentUser, avatarUrl: profile.avatarUrl })
          }
        }
      }).catch(() => {})
    }

    const unsub = useAuthStore.subscribe((s) => {
      setAuthState({
        isLoggedIn: s.isLoggedIn,
        name: s.user?.name || null,
        role: s.user?.role || null,
        avatarUrl: s.user?.avatarUrl || null,
      })
    })
    return unsub
  }, [])

  const { data: subInfo } = useSubscription()

  if (!mounted || !authState.isLoggedIn) return null

  const roleLabel = authState.role === 'admin' ? 'Admin' : subInfo?.hasSubscription ? 'Member' : 'Free'

  return (
    <div className="floating-user">
      {expanded && (
        <div className="floating-user-panel">
          <div className="floating-user-info">
            <span className="floating-user-name">{authState.name}</span>
            <span className="floating-user-role">{roleLabel}</span>
          </div>
          <button
            className="floating-user-logout"
            onClick={() => { logout(); setExpanded(false) }}
            title="ออกจากระบบ"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}
      <button
        className="floating-user-avatar"
        onClick={() => setExpanded(!expanded)}
        title={authState.name || 'User'}
      >
        {authState.avatarUrl ? (
          <img
            src={authState.avatarUrl}
            alt={authState.name || 'Avatar'}
            className="floating-user-img"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="floating-user-initial">
            {authState.name?.charAt(0)?.toUpperCase() || 'U'}
          </span>
        )}
        <span className="floating-user-dot" />
      </button>
    </div>
  )
}
