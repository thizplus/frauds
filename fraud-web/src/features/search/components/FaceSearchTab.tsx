'use client'

import { useState, useRef, useCallback } from 'react'
import { Camera, Search, UserX, AlertCircle, ImageOff, ScanFace, Database, Brain, ListChecks, Globe, ExternalLink, Sparkles, ShieldAlert, User, Info } from 'lucide-react'
import { useAuthStore } from '@/lib/stores/auth'
import { searchService } from '../service'
import { FraudRow } from './FraudRow'
import { ScanAnimation } from '@/components/shared/ScanAnimation'
import type { ScanStep } from '@/components/shared/ScanAnimation'
import type { FaceSearchResponse, FraudResponse, FaceMatch } from '../types'

type FaceSearchState = 'idle' | 'scanning' | 'results' | 'no_face' | 'no_match' | 'error'

const FACE_SCAN_STEPS: ScanStep[] = [
  { icon: ScanFace, label: 'ตรวจจับใบหน้า', duration: 2000, logs: ['detecting faces...', 'face detected'] },
  { icon: Database, label: 'เปรียบเทียบฐานข้อมูล', duration: 2500, logs: ['computing similarity...', 'matching vectors...'] },
  { icon: Brain, label: 'ประเมินความน่าเชื่อถือ', duration: 2000, logs: ['scoring matches...'] },
  { icon: ListChecks, label: 'สรุปผล', duration: 1000, logs: ['scan complete ✓'] },
]

interface FaceSearchTabProps {
  onSelectFraud: (fraud: FraudResponse) => void
  isMember?: boolean
}

export function FaceSearchTab({ onSelectFraud, isMember = false }: FaceSearchTabProps) {
  const { isLoggedIn } = useAuthStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [state, setState] = useState<FaceSearchState>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<FaceSearchResponse | null>(null)
  const pendingSearchRef = useRef<File | null>(null)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
    setState('idle')
    setResult(null)
  }, [])

  const handleSearch = useCallback(() => {
    if (!file) return
    pendingSearchRef.current = file
    setState('scanning')
  }, [file])

  const handleScanComplete = useCallback(async () => {
    const searchFile = pendingSearchRef.current
    if (!searchFile) return

    try {
      const res = await searchService.searchByFace(searchFile)
      setResult(res)

      if (!res.faceDetected) {
        setState('no_face')
      } else if (res.count === 0 || res.matches.length === 0) {
        setState('no_match')
      } else {
        setState('results')
      }
    } catch {
      setState('error')
    }
  }, [])

  const handleReset = useCallback(() => {
    setFile(null)
    setPreview(null)
    setState('idle')
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  if (!isLoggedIn) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--accent)' }} />
        <p className="text-base font-bold mb-1" style={{ color: 'var(--text)' }}>กรุณาเข้าสู่ระบบ</p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>ฟีเจอร์ค้นหาด้วยใบหน้าต้องเข้าสู่ระบบก่อนใช้งาน</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Header: รูปเล็กซ้าย + disclaimer ขวา (แสดงตลอด) */}
        <div className="flex gap-3">
          <button
            className="shrink-0 w-20 h-20 rounded-xl overflow-hidden flex items-center justify-center"
            style={{ border: `2px dashed ${preview ? 'var(--accent)' : 'var(--border)'}`, background: preview ? 'transparent' : 'var(--bg-tertiary, rgba(255,255,255,0.03))' }}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            {preview ? (
              <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <Camera className="w-6 h-6" style={{ color: 'var(--text-dim)' }} />
            )}
          </button>
          <div className="flex-1 min-w-0">
            {state === 'results' && result ? (
              <p className="text-base font-bold" style={{ color: 'var(--accent)' }}>
                พบ {result.count} รายการที่คล้ายกัน
              </p>
            ) : (
              <p className="text-base font-bold" style={{ color: 'var(--text)' }}>
                {preview ? 'พร้อมค้นหา' : 'อัปโหลดรูปเพื่อค้นหา'}
              </p>
            )}
            <div className="flex items-start gap-1.5 mt-1.5" style={{ color: 'var(--text-muted)' }}>
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-sm leading-relaxed">
                ผลการเปรียบเทียบใบหน้าเท่านั้น กรุณาตรวจสอบโพสต์ต้นทางประกอบ
              </p>
            </div>
          </div>
        </div>

        {/* Actions: ค้นหา / เปลี่ยนรูป */}
        {file && state === 'idle' && (
          <div className="flex gap-2">
            <button className="btn btn-primary btn-lg flex-1" onClick={handleSearch}>
              <Search className="w-5 h-5" /> ค้นหาด้วยใบหน้า
            </button>
            <button className="btn btn-secondary btn-lg" onClick={handleReset}>
              เปลี่ยนรูป
            </button>
          </div>
        )}

        {/* No face */}
        {state === 'no_face' && (
          <div className="card p-5 text-center">
            <ImageOff className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>ไม่พบใบหน้าในรูปภาพ</p>
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>กรุณาอัปโหลดรูปที่เห็นใบหน้าชัดเจน</p>
            <button className="btn btn-secondary btn-sm" onClick={handleReset}>ลองใหม่</button>
          </div>
        )}

        {/* No match */}
        {state === 'no_match' && (
          <div className="card p-5 text-center">
            <UserX className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>ไม่พบข้อมูลที่ตรงกัน</p>
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>ไม่มีข้อมูลในระบบที่ตรงกับใบหน้าในรูปภาพ</p>
            <button className="btn btn-secondary btn-sm" onClick={handleReset}>ลองใหม่</button>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="card p-5 text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--danger)' }} />
            <p className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>ระบบไม่พร้อมใช้งานชั่วคราว</p>
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>กรุณาลองใหม่อีกครั้งในภายหลัง</p>
            <button className="btn btn-secondary btn-sm" onClick={handleReset}>ลองใหม่</button>
          </div>
        )}

        {/* Results */}
        {state === 'results' && result && (
          <div className="space-y-3">
            {result.matches.map((match, idx) =>
              match.fraud ? (
                <FraudRow
                  key={match.fraud.id || idx}
                  fraud={match.fraud}
                  onClick={() => onSelectFraud(match.fraud!)}
                  isMember={isMember}
                />
              ) : match.socialPost ? (
                <FaceSocialCard key={`social-${idx}`} match={match} />
              ) : null,
            )}
            <button
              className="flex items-center gap-4 w-full p-2.5 rounded-xl transition-opacity hover:opacity-85"
              style={{ background: 'var(--accent)', color: '#000' }}
              onClick={handleReset}
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(0,0,0,0.15)' }}>
                <Search className="w-7 h-7" />
              </div>
              <div className="text-left">
                <div className="text-lg font-extrabold leading-tight">ค้นหาใหม่</div>
                <div className="text-xs font-medium opacity-80">อัปโหลดรูปใหม่เพื่อค้นหา</div>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Scan Animation */}
      <ScanAnimation
        open={state === 'scanning'}
        title="AI กำลังวิเคราะห์ใบหน้า"
        subtitle="Face Recognition"
        steps={FACE_SCAN_STEPS}
        onComplete={handleScanComplete}
        onCancel={() => setState('idle')}
      />
    </>
  )
}

function FaceSocialCard({ match }: { match: FaceMatch }) {
  const social = match.socialPost!
  const similarityPct = Math.round(match.similarity * 100)
  const strengthLabel = match.evidenceStrength === 'high' ? 'สูง' : match.evidenceStrength === 'medium' ? 'กลาง' : 'ต่ำ'
  const strengthColor = match.evidenceStrength === 'high' ? 'var(--danger, #ef4444)' : match.evidenceStrength === 'medium' ? 'var(--warning, #f59e0b)' : 'var(--text-muted)'

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '.75rem' }}>
      {/* Row 1: icon + ผู้โพส + similarity + badge */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--accent-dim)' }}
        >
          <Globe className="w-4.5 h-4.5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <User className="w-4 h-4 shrink-0" style={{ color: 'var(--text-dim)' }} />
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>ผู้โพส</span>
            <span className="text-base font-bold truncate" style={{ color: 'var(--text)' }}>
              {social.displayName || 'ไม่ทราบชื่อ'}
            </span>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
              style={{ background: `color-mix(in srgb, ${strengthColor} 15%, transparent)`, color: strengthColor }}
            >
              {strengthLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Sparkles className="w-4 h-4 shrink-0" style={{ color: 'var(--text-dim)' }} />
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>ใบหน้าตรงกัน</span>
            <span className="text-sm font-bold" style={{ color: similarityPct >= 70 ? 'var(--accent)' : 'var(--text-dim)' }}>{similarityPct}%</span>
            <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--bg-tertiary, rgba(255,255,255,0.05))' }}>
              <div className="h-2 rounded-full" style={{ width: `${similarityPct}%`, background: similarityPct >= 70 ? 'var(--accent)' : 'var(--text-dim)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: ปุ่มดูต้นทาง */}
      {social.permalinkUrl && (
        <a
          href={social.permalinkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-bold mt-2.5 transition-opacity hover:opacity-80"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          ดูโพสต้นทาง
        </a>
      )}
    </div>
  )
}
