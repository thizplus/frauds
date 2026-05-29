'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, Shield, Plus, Menu, X, LogIn, LogOut, Bot, LayoutDashboard, AlertTriangle, Database } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/stores/auth'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { LoginModal } from '@/features/auth'

/**
 * Navbar มี 2 แบบ:
 * - minimal: หน้าค้นหา (/) = โลโก้ + live pill
 * - full: หน้าอื่น = โลโก้ + menu + CTA + login
 */
export function Navbar() {
  const pathname = usePathname()
  return <FullNavbar pathname={pathname} />
}

function MinimalNavbar() {
  return (
    <nav className="navbar">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <Bot className="w-6 h-6 text-accent" />
            <span className="text-xl font-extrabold tracking-tight">
              เช็กคน<span className="gradient-text">โกง</span>
            </span>
          </Link>
          <span className="live-pill">
            <span className="live-dot" />
            <span className="hidden sm:inline">AI · ONLINE · 24/7</span>
            <span className="sm:hidden">AI ONLINE</span>
          </span>
        </div>
      </div>
    </nav>
  )
}

function FullNavbar({ pathname }: { pathname: string }) {
  const [mounted, setMounted] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [authState, setAuthState] = useState<{ isLoggedIn: boolean; name: string | null; avatarUrl: string | null; role: string | null }>({ isLoggedIn: false, name: null, avatarUrl: null, role: null })

  const logout = useAuthStore((s) => s.logout)
  const { data: subInfo } = useSubscription()

  useEffect(() => {
    setMounted(true)
    const state = useAuthStore.getState()
    setAuthState({ isLoggedIn: state.isLoggedIn, name: state.user?.name || null, avatarUrl: state.user?.avatarUrl || null, role: state.user?.role || null })
    const unsub = useAuthStore.subscribe((s) => {
      setAuthState({ isLoggedIn: s.isLoggedIn, name: s.user?.name || null, avatarUrl: s.user?.avatarUrl || null, role: s.user?.role || null })
    })
    return unsub
  }, [])

  const navLinks = [
    { href: '/', label: 'ค้นหา', icon: Search },
    ...(authState.isLoggedIn ? [
      { href: '/dashboard', label: 'แดชบอร์ด', icon: LayoutDashboard },
      { href: '/lender', label: 'ระบบเก็บข้อมูล', icon: Database },
    ] : []),
    { href: '/pricing', label: 'สมัครสมาชิก', icon: Shield },
  ]

  return (
    <>
      <nav className="navbar">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2.5">
              <Bot className="w-6 h-6 text-accent" />
              <span className="text-xl font-extrabold tracking-tight">
                เช็กคน<span className="gradient-text">โกง</span>
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nav-link ${pathname === link.href ? 'nav-link-active' : ''}`}
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </Link>
              ))}
              {/* Auth — render เฉพาะ client */}
              <div id="nav-auth" className="flex items-center" suppressHydrationWarning>
                {mounted && (
                  authState.isLoggedIn ? (
                    <>
                      <div className="w-px h-5 bg-slate-700 mx-2" />
                      <Link href="/report" className="btn btn-primary btn-sm">
                        <Plus className="w-4 h-4" />
                        แจ้งข้อมูล
                      </Link>
                    </>
                  ) : (
                    <>
                      <div className="w-px h-5 bg-slate-700 mx-2" />
                      <button className="btn btn-secondary btn-sm" onClick={() => setLoginOpen(true)}>
                        <LogIn className="w-4 h-4" />
                        เข้าสู่ระบบ
                      </button>
                    </>
                  )
                )}
              </div>
            </div>

            <div className="mobile-only">
              <button
                className="btn-ghost btn-icon"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

      </nav>

      {/* Mobile menu — always rendered, toggle .open class for CSS transition */}
      <div
        className={`mobile-menu-backdrop ${mobileOpen ? 'open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />
      <aside className={`mobile-menu ${mobileOpen ? 'open' : ''}`}>
        <div className="mobile-menu-header">
          <Link href="/" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
            <Bot className="w-6 h-6 text-accent" />
            <span className="text-xl font-extrabold tracking-tight">
              เช็กคน<span className="gradient-text">โกง</span>
            </span>
          </Link>
          <button className="btn-ghost btn-icon" onClick={() => setMobileOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User profile + CTA */}
        {authState.isLoggedIn && (
          <>
            <div className="mobile-menu-user">
              <div className="mobile-menu-avatar">
                {authState.avatarUrl ? (
                  <img src={authState.avatarUrl} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <span>{authState.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                )}
              </div>
              <div className="mobile-menu-user-info">
                <div className="mobile-menu-user-name">{authState.name}</div>
                <div className="mobile-menu-user-role">{authState.role === 'admin' ? 'Admin' : subInfo?.hasSubscription ? 'Member' : 'Free'}</div>
              </div>
            </div>
            <Link
              href="/report"
              className="flex items-center gap-4 mx-4 p-2 rounded-xl mt-4"
              style={{ background: 'var(--accent)', color: '#000' }}
              onClick={() => setMobileOpen(false)}
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,0,0,0.15)' }}>
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <div className="text-lg font-extrabold leading-tight">แจ้งข้อมูล</div>
                <div className="text-xs font-medium opacity-80">อย่าปล่อยให้คนโกงลอยนวล</div>
              </div>
            </Link>
          </>
        )}

        <div className="mobile-menu-body">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link ${pathname === link.href ? 'nav-link-active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <link.icon className="w-5 h-5" />
              {link.label}
            </Link>
          ))}

          {authState.isLoggedIn ? (
            <button
              className="nav-link"
              style={{ cursor: 'pointer', border: 'none', background: 'transparent', width: '100%', textAlign: 'left' }}
              onClick={() => { logout(); setMobileOpen(false) }}
            >
              <LogOut className="w-5 h-5" />
              ออกจากระบบ
            </button>
          ) : (
            <button
              className="nav-link"
              style={{ cursor: 'pointer', border: 'none', background: 'transparent', width: '100%', textAlign: 'left' }}
              onClick={() => { setLoginOpen(true); setMobileOpen(false) }}
            >
              <LogIn className="w-5 h-5" />
              เข้าสู่ระบบ
            </button>
          )}
        </div>
      </aside>

      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  )
}
