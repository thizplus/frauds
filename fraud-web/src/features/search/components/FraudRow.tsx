'use client'

import { User, Phone, CreditCard, BadgeCheck, Clock, ChevronRight, Sparkles, AlertOctagon, AlertTriangle, Circle } from 'lucide-react'
import type { FraudResponse } from '../types'

function maskPhone(phone: string): string {
  if (phone.length < 7) return phone
  return phone.slice(0, 3) + '-xxx-' + phone.slice(-4)
}

function maskBank(account: string): string {
  if (account.length < 4) return account
  return 'xxx-x-xxxxx-' + account.slice(-1)
}

// คำนวณ AI match score จาก reportCount (mock - อนาคตมาจาก API)
function getAiScore(fraud: FraudResponse): number {
  const base = Math.min(fraud.reportCount * 15, 80)
  const verified = fraud.verified ? 15 : 0
  return Math.min(base + verified + Math.floor(Math.random() * 10), 99)
}

function getRisk(score: number): { label: string; className: string; icon: typeof AlertOctagon } {
  if (score >= 80) return { label: 'HIGH', className: 'risk-high', icon: AlertOctagon }
  if (score >= 60) return { label: 'MED', className: 'risk-med', icon: AlertTriangle }
  return { label: 'LOW', className: 'risk-low', icon: Circle }
}

interface FraudRowProps {
  fraud: FraudResponse
  onClick: () => void
  isMember?: boolean
}

export function FraudRow({ fraud, onClick, isMember = false }: FraudRowProps) {
  const score = getAiScore(fraud)
  const risk = getRisk(score)
  const RiskIcon = risk.icon

  return (
    <button onClick={onClick} className="row-ai w-full text-left">
      <div className="row-ai-avatar">
        <User className="w-5 h-5" />
      </div>
      <div className="row-ai-info">
        <div className="row-ai-name">
          {fraud.name || 'ไม่ทราบชื่อ'}
          {fraud.verified ? (
            <BadgeCheck className="w-4 h-4 text-accent" />
          ) : (
            <Clock className="w-4 h-4 text-slate-500" />
          )}
        </div>
        <div className="row-ai-meta">
          {fraud.phone && (
            <span className="row-ai-meta-item">
              <Phone className="w-3.5 h-3.5" />
              {isMember ? fraud.phone : maskPhone(fraud.phone)}
            </span>
          )}
          {fraud.bankAccount && (
            <span className="row-ai-meta-item">
              <CreditCard className="w-3.5 h-3.5" />
              {isMember ? fraud.bankAccount : maskBank(fraud.bankAccount)}
            </span>
          )}
        </div>
      </div>
      <div className="row-ai-score">
        <div className="row-ai-score-label">
          <Sparkles className="w-3 h-3" />
          AI MATCH
        </div>
        <div className="row-ai-score-value">{score}%</div>
      </div>
      <div className="row-ai-risk">
        <div className="row-ai-risk-label">RISK</div>
        <div className={`row-ai-risk-value ${risk.className}`}>
          <RiskIcon className="w-3.5 h-3.5" />
          {risk.label}
        </div>
      </div>
      <ChevronRight className="row-ai-action w-5 h-5" />
    </button>
  )
}
