'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { BrainCircuit, TextSearch, Database, Bot, Brain, ListChecks, Loader2, Check, Power, Timer } from 'lucide-react'

interface ScanModalProps {
  open: boolean
  query: string
  onComplete: () => void
  onCancel: () => void
}

const steps = [
  { icon: TextSearch, label: 'วิเคราะห์รูปแบบคำค้น' },
  { icon: Database, label: 'ค้นหาในฐานข้อมูลกลาง' },
  { icon: Bot, label: 'เช็คกับ Bot Collector' },
  { icon: Brain, label: 'AI ประเมินความน่าเชื่อถือ' },
  { icon: ListChecks, label: 'จัดเรียงผลลัพธ์' },
]

const stepDurations = [1500, 2000, 2200, 2200, 1300]

const logMessages: string[][] = [
  ['parsing input...', 'detecting format...', 'pattern detected'],
  ['querying PostgreSQL...', 'scanning index B-tree...', 'matching variants...'],
  ['fetching from Bot Collector...', 'cross-ref Facebook Group #1', 'cross-ref Facebook Group #2'],
  ['running confidence model...', 'analyzing report patterns...', 'checking duplicate signals...'],
  ['sorting by relevance...', 'preparing response...', 'scan complete ✓'],
]

function detectType(q: string): string {
  const trimmed = q.replace(/[\s-]/g, '')
  if (/^\d{10,11}$/.test(trimmed)) return 'phone number'
  if (/^\d{13}$/.test(trimmed)) return 'national ID'
  if (/^\d{10,15}$/.test(trimmed)) return 'bank account'
  if (/^[ก-๿\s]+$/.test(q)) return 'Thai name'
  return 'mixed input'
}

export function ScanModal({ open, query, onComplete, onCancel }: ScanModalProps) {
  const [currentStep, setCurrentStep] = useState(-1)
  const [stepStates, setStepStates] = useState<('idle' | 'active' | 'done')[]>(steps.map(() => 'idle'))
  const [progress, setProgress] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [statusText, setStatusText] = useState('กำลังเชื่อมต่อระบบ')
  const [logs, setLogs] = useState<string[]>([])
  const [stats, setStats] = useState({ records: 0, sources: 0, matches: 0 })
  const cancelledRef = useRef(false)
  const logRef = useRef<HTMLDivElement>(null)

  const reset = useCallback(() => {
    setCurrentStep(-1)
    setStepStates(steps.map(() => 'idle'))
    setProgress(0)
    setElapsed(0)
    setStatusText('กำลังเชื่อมต่อระบบ')
    setLogs([])
    setStats({ records: 0, sources: 0, matches: 0 })
    cancelledRef.current = false
  }, [])

  // Auto scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  // Lock scroll
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Timer
  useEffect(() => {
    if (!open) return
    const start = performance.now()
    const id = setInterval(() => {
      setElapsed(+((performance.now() - start) / 1000).toFixed(1))
    }, 50)
    return () => clearInterval(id)
  }, [open])

  // Run steps sequence
  useEffect(() => {
    if (!open) return
    reset()

    const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
    let cancelled = false
    cancelledRef.current = false

    ;(async () => {
      // Initial logs
      await delay(300)
      if (cancelled) return
      setLogs(l => [...l, '> init AI engine... v1.0'])
      await delay(400)
      if (cancelled) return
      setLogs(l => [...l, '> connecting to fraud-api...'])
      await delay(400)
      if (cancelled) return
      setLogs(l => [...l, '> handshake complete OK'])

      // Animate stats
      const animateStats = () => {
        let frame = 0
        const id = setInterval(() => {
          frame++
          setStats({
            records: Math.min(Math.round(frame * 20), 1247),
            sources: Math.min(Math.round(frame * 0.08), 5),
            matches: 0,
          })
          if (frame >= 65) clearInterval(id)
        }, 100)
        return id
      }
      const statsId = animateStats()

      await delay(500)

      for (let i = 0; i < steps.length; i++) {
        if (cancelled || cancelledRef.current) break

        // Set active
        setCurrentStep(i)
        setStepStates(prev => prev.map((s, idx) => idx === i ? 'active' : s))
        setStatusText(steps[i].label)
        setProgress(((i + 1) / steps.length) * 100)

        // Add logs for this step
        const stepLogs = logMessages[i]
        const logInterval = stepDurations[i] / (stepLogs.length + 1)
        for (let j = 0; j < stepLogs.length; j++) {
          await delay(logInterval)
          if (cancelled || cancelledRef.current) break
          setLogs(l => [...l, `> ${stepLogs[j]}`])
        }

        await delay(logInterval)
        if (cancelled || cancelledRef.current) break

        // Set done
        setStepStates(prev => prev.map((s, idx) => idx === i ? 'done' : s))
      }

      if (!cancelled && !cancelledRef.current) {
        setStats(s => ({ ...s, matches: 6 }))
        setStatusText('พบ 6 รายการ ✓')
        await delay(800)
      }

      clearInterval(statsId)
      if (!cancelled && !cancelledRef.current) {
        onComplete()
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancel = () => {
    cancelledRef.current = true
    onCancel()
  }

  // Generate particles once
  const particles = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => ({
      left: `${Math.random() * 100}%`,
      width: `${2 + Math.random() * 3}px`,
      height: `${2 + Math.random() * 3}px`,
      duration: `${4 + Math.random() * 4}s`,
      delay: `${Math.random() * 5}s`,
    })), [])

  if (!open) return null

  return (
    <div className="scan-modal">
      <div className="scan-modal-content fade-in">
        {/* Particles */}
        <div className="particles">
          {particles.map((p, i) => (
            <span
              key={i}
              className="particle"
              style={{
                left: p.left,
                bottom: '-10px',
                width: p.width,
                height: p.height,
                animationDuration: p.duration,
                animationDelay: p.delay,
              }}
            />
          ))}
        </div>

        {/* AI Brain + Title */}
        <div className="ai-brain">
          <div className="ai-brain-icon">
            <BrainCircuit className="w-12 h-12" />
          </div>
        </div>
        <div className="text-center mb-1">
          <div className="text-lg font-bold" style={{ color: 'var(--text)' }}>AI กำลังวิเคราะห์</div>
        </div>

        {/* Status + Timer inline */}
        <div className="flex items-center justify-center gap-2.5 mb-3 text-sm">
          <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{query}</span>
          <span className="text-accent flex items-center gap-1.5 font-mono">
            <Timer className="w-4 h-4" />
            {elapsed}s
          </span>
        </div>

        {/* Progress bar */}
        <div className="ai-progress-track">
          <div className="ai-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Steps — compact, no meta text */}
        <ul className="ai-steps compact">
          {steps.map((step, i) => {
            const state = stepStates[i]
            return (
              <li key={i} className={`ai-step ${state}`}>
                <div className="ai-step-icon">
                  <step.icon className="w-5 h-5" />
                </div>
                <div className="ai-step-label">{step.label}</div>
                <div className="ai-step-status">
                  {state === 'active' && <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent)' }} />}
                  {state === 'done' && <Check className="w-5 h-5" style={{ color: 'var(--accent)' }} />}
                  {state === 'idle' && <span className="w-2 h-2 rounded-full" style={{ background: 'var(--text-faint)' }} />}
                </div>
              </li>
            )
          })}
        </ul>

        {/* Stats */}
        <div className="ai-stats">
          <div className="ai-stat">
            <div className="ai-stat-value">{stats.records.toLocaleString()}</div>
            <div className="ai-stat-label">records</div>
          </div>
          <div className="ai-stat">
            <div className="ai-stat-value">{stats.sources}</div>
            <div className="ai-stat-label">แหล่งข้อมูล</div>
          </div>
          <div className="ai-stat">
            <div className="ai-stat-value">{stats.matches}</div>
            <div className="ai-stat-label">รายการตรง</div>
          </div>
        </div>

        {/* Cancel */}
        <div className="scan-modal-footer">
          <button className="btn-abort" onClick={handleCancel}>
            <span className="btn-abort-icon">
              <Power className="w-4 h-4" />
            </span>
            หยุด
          </button>
        </div>
      </div>
    </div>
  )
}
