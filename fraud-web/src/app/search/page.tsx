'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchStore } from '@/lib/stores/search'
import { useAuthStore } from '@/lib/stores/auth'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { useSearch, useUnifiedSearch } from '@/features/search'
import { FraudDetailDrawer } from '@/features/fraud-detail'
import { canGuestSearch, incrementGuestSearch } from '@/lib/utils/guest-quota'
import { LoginModal } from '@/features/auth'
import { SearchBar } from '@/features/search/components/SearchBar'
import { SearchResults } from '@/features/search/components/SearchResults'
import { UnifiedResults } from '@/features/search/components/UnifiedResults'
import { ScanAnimation } from '@/components/shared/ScanAnimation'
import type { ScanStep } from '@/components/shared/ScanAnimation'
import { TextSearch, Database, Bot, Brain, ListChecks } from 'lucide-react'
import { FaceSearchDrawer } from '@/components/shared/FaceSearchDrawer'
import { TrustBadges } from '@/components/shared/TrustBadges'
import type { FraudResponse, SearchParams } from '@/features/search/types'

const TEXT_SCAN_STEPS: ScanStep[] = [
  { icon: TextSearch, label: 'วิเคราะห์รูปแบบคำค้น', duration: 1500, logs: ['parsing input...', 'detecting format...', 'pattern detected'] },
  { icon: Database, label: 'ค้นหาในฐานข้อมูลกลาง', duration: 2000, logs: ['querying PostgreSQL...', 'scanning index B-tree...', 'matching variants...'] },
  { icon: Bot, label: 'เช็คกับ Bot Collector', duration: 2200, logs: ['fetching from Bot Collector...', 'cross-ref Facebook Group #1', 'cross-ref Facebook Group #2'] },
  { icon: Brain, label: 'AI ประเมินความน่าเชื่อถือ', duration: 2200, logs: ['running confidence model...', 'analyzing report patterns...'] },
  { icon: ListChecks, label: 'จัดเรียงผลลัพธ์', duration: 1300, logs: ['sorting by relevance...', 'scan complete ✓'] },
]

export default function SearchPage() {
  const router = useRouter()
  const { query: storeQuery, type: storeType, setSearch } = useSearchStore()

  // Hydration-safe auth state
  const [mounted, setMounted] = useState(false)
  const [authState, setAuthState] = useState<{ isLoggedIn: boolean }>({ isLoggedIn: false })
  const [loginOpen, setLoginOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
    const state = useAuthStore.getState()
    setAuthState({ isLoggedIn: state.isLoggedIn })
    const unsub = useAuthStore.subscribe((s) => {
      setAuthState({ isLoggedIn: s.isLoggedIn })
    })
    return unsub
  }, [])

  const isLoggedIn = mounted ? authState.isLoggedIn : false
  const { data: subInfo } = useSubscription()
  const isMember = subInfo?.hasSubscription ?? false

  const [inputValue, setInputValue] = useState(storeQuery)
  const [searchType, setSearchType] = useState(storeType)
  const [scanning, setScanning] = useState(!!storeQuery)
  const [searchParams, setSearchParams] = useState<SearchParams | null>(null)
  const [selectedFraud, setSelectedFraud] = useState<FraudResponse | null>(null)
  const [faceSearchOpen, setFaceSearchOpen] = useState(false)

  // ใช้ unified search เมื่อ type เป็น "all", ใช้ search เดิมเมื่อเลือก type เฉพาะ
  const isUnified = !searchParams?.type || searchParams.type === 'all'
  const legacyParams = isUnified ? null : searchParams
  const unifiedQuery = isUnified && searchParams ? searchParams.q : null

  const { data, isLoading, error } = useSearch(legacyParams)
  const { data: unifiedData, isLoading: unifiedLoading, error: unifiedError } = useUnifiedSearch(unifiedQuery)

  const activeLoading = isUnified ? unifiedLoading : isLoading
  const activeError = isUnified ? unifiedError : error
  const [quotaError, setQuotaError] = useState('')

  // Handle 429 quota exceeded
  useEffect(() => {
    if (activeError) {
      const msg = (activeError as any)?.response?.data?.error?.message
      if ((activeError as any)?.response?.status === 429 || msg) {
        setQuotaError(msg || 'ค้นหาครบแล้ววันนี้ สมัคร Member เพื่อค้นหาไม่จำกัด')
      }
    } else {
      setQuotaError('')
    }
  }, [activeError])

  // ไม่มี query → กลับหน้าแรก
  useEffect(() => {
    if (!storeQuery) router.replace('/')
  }, [storeQuery, router])

  const handleScanComplete = useCallback(() => {
    setSearchParams({ q: storeQuery, type: storeType, page: 1 })
    setScanning(false)
  }, [storeQuery, storeType])

  const handleScanCancel = useCallback(() => {
    setScanning(false)
    router.push('/')
  }, [router])

  // ค้นหาใหม่จากหน้า results
  const handleSearch = () => {
    if (!inputValue.trim()) return
    if (!authState.isLoggedIn && !canGuestSearch()) {
      setLoginOpen(true)
      return
    }
    if (!authState.isLoggedIn) incrementGuestSearch()
    setSearch(inputValue.trim(), searchType)
    setSearchParams(null)
    setScanning(true)
  }

  const handlePageChange = (newPage: number) => {
    setSearchParams((prev) => (prev ? { ...prev, page: newPage } : null))
  }

  if (!storeQuery) return null

  return (
    <>
      {/* Search bar ด้านบน */}
      <section className="w-full px-4 sm:px-6 lg:px-8 pt-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-3xl mx-auto">
          <SearchBar
            value={inputValue}
            onChange={setInputValue}
            onSearch={handleSearch}
            onFaceSearch={() => {
              if (!isLoggedIn) { setLoginOpen(true); return }
              setFaceSearchOpen(true)
            }}
            loading={scanning}
          />
        </div>
      </section>

      {/* Results or Gate */}
      {!scanning && searchParams && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
          {quotaError ? (
            /* Quota exceeded */
            <div className="search-gate fade-in">
              <div className="search-gate-icon">
                <Lock className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--text)' }}>
                ค้นหาครบแล้ววันนี้
              </h2>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                {quotaError}
              </p>
              <a href="/pricing" className="btn btn-primary btn-lg">
                สมัครสมาชิก ค้นหาไม่จำกัด
              </a>
            </div>
          ) : mounted && !isLoggedIn ? (
            /* Gate card — ผู้ใช้ยังไม่ login */
            <div className="search-gate fade-in">
              <div className="search-gate-glow" />
              <div className="search-gate-icon">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--text)' }}>
                เข้าสู่ระบบเพื่อดูผลลัพธ์
              </h2>
              <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
                AI ตรวจพบข้อมูลที่ตรงกับคำค้นหาของคุณ
              </p>
              <div className="search-gate-count">
                พบ <span>{isUnified ? (unifiedData?.totalResults ?? 0) : (data?.meta?.total ?? 0)}</span> รายการ
              </div>
              <button
                className="search-gate-btn"
                onClick={() => setLoginOpen(true)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                </svg>
                เข้าสู่ระบบด้วย LINE
              </button>
              <p className="text-xs mt-4" style={{ color: 'var(--text-faint)' }}>
                ไม่ต้องสมัครสมาชิก กดปุ่มเดียวเข้าดูได้เลย
              </p>
            </div>
          ) : (
            /* ผู้ใช้ login แล้ว — แสดงผลลัพธ์ */
            <>
              {isUnified ? (
                <UnifiedResults
                  query={searchParams.q}
                  sections={unifiedData?.sections || []}
                  totalResults={unifiedData?.totalResults ?? 0}
                  onSelectFraud={setSelectedFraud}
                  loading={unifiedLoading}
                  isMember={isMember}
                />
              ) : (
                <SearchResults
                  query={searchParams.q}
                  frauds={data?.data || []}
                  meta={data?.meta || { total: 0, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false }}
                  onSelect={setSelectedFraud}
                  onPageChange={handlePageChange}
                  loading={isLoading}
                  isMember={isMember}
                />
              )}

              {!isMember && ((isUnified ? (unifiedData?.totalResults ?? 0) : (data?.data?.length ?? 0)) > 0) && (
                <div className="card p-4 mt-6 text-center">
                  <Lock className="w-5 h-5 mx-auto mb-2" style={{ color: 'var(--accent)' }} />
                  <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
                    ข้อมูลถูก mask สำหรับผู้ใช้ฟรี
                  </p>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                    สมัครสมาชิกเพื่อดูเบอร์โทร เลขบัญชี และรูปหลักฐานเต็ม
                  </p>
                  <a href="/pricing" className="btn btn-primary btn-sm">
                    สมัครสมาชิก
                  </a>
                </div>
              )}
            </>
          )}

          <div className="mt-8">
            <TrustBadges />
          </div>
        </section>
      )}

      {/* Scan Animation */}
      <ScanAnimation
        open={scanning}
        title="AI กำลังวิเคราะห์"
        subtitle={storeQuery}
        steps={TEXT_SCAN_STEPS}
        showStats
        onComplete={handleScanComplete}
        onCancel={handleScanCancel}
      />

      <FraudDetailDrawer
        fraud={selectedFraud}
        open={!!selectedFraud}
        onClose={() => setSelectedFraud(null)}
      />

      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />

      <FaceSearchDrawer
        open={faceSearchOpen}
        onClose={() => setFaceSearchOpen(false)}
        onSelectFraud={setSelectedFraud}
      />
    </>
  )
}
