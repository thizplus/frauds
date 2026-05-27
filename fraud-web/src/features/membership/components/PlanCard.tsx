'use client'

import { Check } from 'lucide-react'
import type { PlanItem } from '../types'

interface PlanCardProps {
  plan: PlanItem
  featured?: boolean
  onSelect: (plan: PlanItem) => void
}

const TYPE_LABELS: Record<string, string> = {
  subscription: 'สมัครสมาชิก',
  one_time: 'ครั้งเดียว',
}

export function PlanCard({ plan, featured, onSelect }: PlanCardProps) {
  return (
    <div className={`plan-card ${featured ? 'featured' : ''}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`plan-type-badge ${plan.type === 'subscription' ? 'subscription' : 'one-time'}`}>
          {TYPE_LABELS[plan.type]}
        </span>
      </div>

      <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text)' }}>{plan.name}</h3>
      {plan.description && (
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{plan.description}</p>
      )}

      <div className="plan-price mb-4">
        {plan.price.toLocaleString()}
        <span className="currency"> บาท</span>
        {plan.type === 'subscription' && (
          <span className="period">/{plan.durationDays === 365 ? 'ปี' : 'เดือน'}</span>
        )}
      </div>

      {plan.features && plan.features.length > 0 && (
        <div className="space-y-1 mb-4">
          {plan.features.map((feature, i) => (
            <div key={i} className="plan-feature">
              <Check className="check w-4 h-4" />
              <span>{feature}</span>
            </div>
          ))}
        </div>
      )}

      <button
        className={`btn ${featured ? 'btn-primary' : 'btn-secondary'} w-full btn-lg`}
        onClick={() => onSelect(plan)}
      >
        {plan.type === 'subscription' ? 'สมัครเลย' : 'เลือก'}
      </button>
    </div>
  )
}
