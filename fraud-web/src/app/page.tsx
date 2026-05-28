'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchStore } from '@/lib/stores/search'
import { useAuthStore } from '@/lib/stores/auth'
import { SearchBar } from '@/features/search/components/SearchBar'
import { LiveTicker } from '@/features/search/components/LiveTicker'
import { FraudDetailDrawer } from '@/features/fraud-detail'
import { FaceSearchDrawer } from '@/components/shared/FaceSearchDrawer'
import { LoginModal } from '@/features/auth'
import type { FraudResponse } from '@/features/search/types'
import { canGuestSearch, incrementGuestSearch, getGuestSearchRemaining, fetchGuestQuota } from '@/lib/utils/guest-quota'

export default function HomePage() {
  const router = useRouter()
  const setSearch = useSearchStore((s) => s.setSearch)
  const [inputValue, setInputValue] = useState('')
  const [loginOpen, setLoginOpen] = useState(false)
  const [quotaMsg, setQuotaMsg] = useState('')
  const [mounted, setMounted] = useState(false)
  const [faceSearchOpen, setFaceSearchOpen] = useState(false)
  const [selectedFraud, setSelectedFraud] = useState<FraudResponse | null>(null)

  useEffect(() => {
    setMounted(true)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'
    fetchGuestQuota(apiUrl)
  }, [])

  const handleSearch = () => {
    if (!inputValue.trim()) return

    const isLoggedIn = useAuthStore.getState().isLoggedIn
    if (!isLoggedIn) {
      if (!canGuestSearch()) {
        setQuotaMsg('วันนี้ค้นหาครบ 3 ครั้งแล้ว เข้าสู่ระบบเพื่อค้นหาเพิ่ม')
        return
      }
      incrementGuestSearch()
    }

    setSearch(inputValue.trim(), 'all')
    router.push('/search')
  }

  return (
    <>
      <LiveTicker />

      <section className="relative w-full px-4 sm:px-6 lg:px-8 pb-6 flex-1 flex flex-col items-center justify-center">
        <div className="max-w-3xl mx-auto text-center fade-in relative">
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            เช็คก่อน <span className="gradient-text">เชื่อใคร</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg" style={{ color: 'var(--text-muted)' }}>
            AI ตรวจสอบข้อมูลคนโกงจากฐานข้อมูล{' '}
            <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
              กว่าแสนรายชื่อ
            </span>{' '}
            ในไม่กี่วินาที
          </p>
        </div>

        <div className="max-w-3xl w-full mx-auto mt-8 fade-in">
          <SearchBar
            value={inputValue}
            onChange={setInputValue}
            onSearch={handleSearch}
            onFaceSearch={() => {
              if (!useAuthStore.getState().isLoggedIn) { setLoginOpen(true); return }
              setFaceSearchOpen(true)
            }}
            loading={false}
          />
          {quotaMsg && (
            <div className="mt-3 text-center fade-in">
              <p className="text-sm mb-2" style={{ color: 'var(--danger)' }}>{quotaMsg}</p>
              <button className="btn btn-primary btn-sm" onClick={() => { setQuotaMsg(''); setLoginOpen(true) }}>
                เข้าสู่ระบบ
              </button>
            </div>
          )}
          {mounted && !useAuthStore.getState().isLoggedIn && (
            <p className="text-center text-xs mt-3" style={{ color: 'var(--text-faint)' }}>
              ค้นหาฟรี {getGuestSearchRemaining()} ครั้งวันนี้
            </p>
          )}
        </div>
      </section>
      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />

      <FaceSearchDrawer
        open={faceSearchOpen}
        onClose={() => setFaceSearchOpen(false)}
        onSelectFraud={setSelectedFraud}
      />

      <FraudDetailDrawer
        fraud={selectedFraud}
        open={!!selectedFraud}
        onClose={() => setSelectedFraud(null)}
      />
    </>
  )
}
