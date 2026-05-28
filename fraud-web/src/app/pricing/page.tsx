'use client'

import { useState, useEffect } from 'react'
import { Check, Crown } from 'lucide-react'
import { TrustBadges } from '@/components/shared/TrustBadges'
import { usePlans } from '@/features/membership'
import { CheckoutModal } from '@/features/membership/components/CheckoutModal'
import { LoginModal } from '@/features/auth'
import { useAuthStore } from '@/lib/stores/auth'
import { useSubscription } from '@/lib/hooks/useSubscription'
import type { PlanItem } from '@/features/membership'

const FREE_FEATURES = [
  'ค้นหา 5 ครั้ง/วัน',
  'แจ้งโกงได้ไม่จำกัด',
  'ข้อมูลถูก mask',
]

export default function PricingPage() {
  const { data: plans, isLoading } = usePlans()
  const { data: subInfo } = useSubscription()
  const [selectedPlan, setSelectedPlan] = useState<PlanItem | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const isLoggedIn = mounted ? useAuthStore.getState().isLoggedIn : false
  const currentPlanName = subInfo?.planName || null
  const isMember = subInfo?.hasSubscription ?? false

  const handleSelect = (plan: PlanItem) => {
    if (!isLoggedIn) {
      setLoginOpen(true)
    } else {
      setSelectedPlan(plan)
    }
  }

  const subscriptionPlans = plans?.filter((p) => p.type === 'subscription') || []

  return (
    <>
      <section className="px-4 sm:px-6 lg:px-8 pt-12 pb-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              เลือก<span className="gradient-text">แพลน</span>ที่เหมาะกับคุณ
            </h1>
            <p className="text-base" style={{ color: 'var(--text-muted)' }}>
              เช็กข้อมูลคนโกงก่อนเชื่อใคร ป้องกันความเสียหาย
            </p>
          </div>

          {/* Trust badges */}
          <div className="mb-10">
            <TrustBadges />
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="plan-card animate-pulse">
                  <div className="h-4 bg-slate-800 rounded w-20 mb-4" />
                  <div className="h-6 bg-slate-800 rounded w-32 mb-2" />
                  <div className="h-10 bg-slate-800 rounded w-24 mb-4" />
                  <div className="space-y-2 mb-6">
                    <div className="h-3 bg-slate-800 rounded w-full" />
                    <div className="h-3 bg-slate-800 rounded w-3/4" />
                  </div>
                  <div className="h-12 bg-slate-800 rounded" />
                </div>
              ))}
            </div>
          )}

          {/* Plans grid: Free + subscription plans */}
          {!isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              {/* Free card */}
              <div className="plan-card flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <span className="plan-type-badge one-time">ฟรี</span>
                </div>
                <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text)' }}>ฟรี</h3>
                <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>เริ่มต้นใช้งานฟรี</p>
                <div className="plan-price mb-4">0 <span className="currency">บาท</span></div>
                <div className="space-y-1 mb-4 flex-1">
                  {FREE_FEATURES.map((f, i) => (
                    <div key={i} className="plan-feature">
                      <Check className="check w-4 h-4" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-auto">
                  {!isLoggedIn ? (
                    <button className="btn btn-secondary w-full btn-lg" onClick={() => setLoginOpen(true)}>
                      เข้าสู่ระบบ
                    </button>
                  ) : !isMember ? (
                    <button className="btn btn-secondary w-full btn-lg" disabled>
                      <Check className="w-4 h-4" /> คุณใช้งานอยู่
                    </button>
                  ) : (
                    <button className="btn btn-secondary w-full btn-lg" disabled style={{ opacity: 0.5 }}>
                      แพลนฟรี
                    </button>
                  )}
                </div>
              </div>

              {/* Subscription plans */}
              {subscriptionPlans.map((plan, i) => {
                const isCurrentPlan = currentPlanName === plan.name
                return (
                  <div key={plan.id} className={`plan-card flex flex-col ${isCurrentPlan ? 'featured' : i === 0 ? 'featured' : ''}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="plan-type-badge subscription">สมัครสมาชิก</span>
                    </div>
                    <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text)' }}>{plan.name}</h3>
                    {plan.description && (
                      <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{plan.description}</p>
                    )}
                    <div className="plan-price mb-4">
                      {plan.price.toLocaleString()}
                      <span className="currency"> บาท</span>
                      <span className="period">/{plan.durationDays === 365 ? 'ปี' : 'เดือน'}</span>
                    </div>
                    <div className="space-y-1 mb-4 flex-1">
                      {plan.features && plan.features.length > 0 && plan.features.map((f, j) => (
                        <div key={j} className="plan-feature">
                          <Check className="check w-4 h-4" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-auto">
                      {isCurrentPlan ? (
                        <button className="btn btn-primary w-full btn-lg" onClick={() => handleSelect(plan)}>
                          <Crown className="w-4 h-4" /> ต่ออายุ
                        </button>
                      ) : (
                        <button className="btn btn-primary w-full btn-lg" onClick={() => handleSelect(plan)}>
                          {isMember ? 'เปลี่ยนแพลน' : 'อัปเกรด'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Current subscription info */}
          {isMember && subInfo && (
            <div className="card p-4 mt-8 text-center">
              <Crown className="w-5 h-5 mx-auto mb-2" style={{ color: 'var(--accent)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                คุณเป็นสมาชิก <span style={{ color: 'var(--accent)' }}>{subInfo.planName}</span>
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                เหลืออีก {subInfo.daysLeft} วัน
              </p>
            </div>
          )}
        </div>
      </section>

      <CheckoutModal
        plan={selectedPlan}
        open={!!selectedPlan}
        onClose={() => setSelectedPlan(null)}
      />
      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  )
}
