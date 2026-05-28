'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { BrainCircuit, Loader2, Check, Power, Timer } from 'lucide-react'

export interface ScanStep {
  icon: typeof BrainCircuit
  label: string
  duration: number  // ms
  logs: string[]
}

interface ScanAnimationProps {
  open: boolean
  title: string
  subtitle?: string
  steps: ScanStep[]
  onComplete: () => void
  onCancel: () => void
}

export function ScanAnimation({ open, title, subtitle, steps, onComplete, onCancel }: ScanAnimationProps) {
  const [currentStep, setCurrentStep] = useState(-1)
  const [stepStates, setStepStates] = useState<('idle' | 'active' | 'done')[]>(steps.map(() => 'idle'))
  const [progress, setProgress] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [statusText, setStatusText] = useState('กำลังเชื่อมต่อระบบ')
  const [logs, setLogs] = useState<string[]>([])
  const cancelledRef = useRef(false)
  const logRef = useRef<HTMLDivElement>(null)

  const reset = useCallback(() => {
    setCurrentStep(-1)
    setStepStates(steps.map(() => 'idle'))
    setProgress(0)
    setElapsed(0)
    setStatusText('กำลังเชื่อมต่อระบบ')
    setLogs([])
    cancelledRef.current = false
  }, [steps])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!open) return
    const start = performance.now()
    const id = setInterval(() => {
      setElapsed(+((performance.now() - start) / 1000).toFixed(1))
    }, 50)
    return () => clearInterval(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    reset()

    const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
    let cancelled = false
    cancelledRef.current = false

    ;(async () => {
      await delay(300)
      if (cancelled) return
      setLogs(l => [...l, '> init AI engine... v1.0'])
      await delay(400)
      if (cancelled) return
      setLogs(l => [...l, '> connecting to fraud-api...'])
      await delay(400)
      if (cancelled) return
      setLogs(l => [...l, '> handshake complete OK'])
      await delay(500)

      for (let i = 0; i < steps.length; i++) {
        if (cancelled || cancelledRef.current) break

        setCurrentStep(i)
        setStepStates(prev => prev.map((s, idx) => idx === i ? 'active' : s))
        setStatusText(steps[i].label)
        setProgress(((i + 1) / steps.length) * 100)

        const stepLogs = steps[i].logs
        const logInterval = steps[i].duration / (stepLogs.length + 1)
        for (let j = 0; j < stepLogs.length; j++) {
          await delay(logInterval)
          if (cancelled || cancelledRef.current) break
          setLogs(l => [...l, `> ${stepLogs[j]}`])
        }

        await delay(logInterval)
        if (cancelled || cancelledRef.current) break

        setStepStates(prev => prev.map((s, idx) => idx === i ? 'done' : s))
      }

      if (!cancelled && !cancelledRef.current) {
        setStatusText('เสร็จสิ้น ✓')
        await delay(600)
      }

      if (!cancelled && !cancelledRef.current) {
        onComplete()
      }
    })()

    return () => { cancelled = true }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancel = () => {
    cancelledRef.current = true
    onCancel()
  }

  const particles = useMemo(() =>
    Array.from({ length: 14 }, () => ({
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
        <div className="particles">
          {particles.map((p, i) => (
            <span key={i} className="particle" style={{ left: p.left, bottom: '-10px', width: p.width, height: p.height, animationDuration: p.duration, animationDelay: p.delay }} />
          ))}
        </div>

        <div className="ai-brain">
          <div className="ai-brain-icon">
            <BrainCircuit className="w-6 h-6" />
          </div>
        </div>
        <div className="text-center mb-1">
          <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</div>
        </div>

        <div className="flex items-center justify-center gap-2 mb-3 text-xs">
          {subtitle && <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{subtitle}</span>}
          <span className="text-accent flex items-center gap-1 font-mono">
            <Timer className="w-3 h-3" />{elapsed}s
          </span>
        </div>

        <div className="ai-progress-track">
          <div className="ai-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <ul className="ai-steps compact">
          {steps.map((step, i) => {
            const state = stepStates[i]
            return (
              <li key={i} className={`ai-step ${state}`}>
                <div className="ai-step-icon"><step.icon className="w-3.5 h-3.5" /></div>
                <div className="ai-step-label">{step.label}</div>
                <div className="ai-step-status">
                  {state === 'active' && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--accent)' }} />}
                  {state === 'done' && <Check className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />}
                  {state === 'idle' && <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--text-faint)' }} />}
                </div>
              </li>
            )
          })}
        </ul>

        <div className="scan-modal-footer">
          <button className="btn-abort" onClick={handleCancel}>
            <span className="btn-abort-icon"><Power className="w-3 h-3" /></span>
            หยุด
          </button>
        </div>
      </div>
    </div>
  )
}
