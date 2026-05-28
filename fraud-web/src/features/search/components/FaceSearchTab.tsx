'use client'

import { useState, useRef, useCallback } from 'react'
import { Camera, Search, UserX, AlertCircle, ImageOff, ScanFace, Database, Brain, ListChecks } from 'lucide-react'
import { useAuthStore } from '@/lib/stores/auth'
import { searchService } from '../service'
import { FraudRow } from './FraudRow'
import { ScanAnimation } from '@/components/shared/ScanAnimation'
import type { ScanStep } from '@/components/shared/ScanAnimation'
import type { FaceSearchResponse, FraudResponse } from '../types'

type FaceSearchState = 'idle' | 'scanning' | 'results' | 'no_face' | 'no_match' | 'error'

const FACE_SCAN_STEPS: ScanStep[] = [
  { icon: ScanFace, label: 'ตรวจจับใบหน้า', duration: 2000, logs: ['detecting faces...', 'analyzing features...', 'face detected'] },
  { icon: Database, label: 'เปรียบเทียบกับฐานข้อมูล', duration: 2500, logs: ['loading embeddings...', 'computing similarity...', 'matching vectors...'] },
  { icon: Brain, label: 'AI ประเมินความน่าเชื่อถือ', duration: 2000, logs: ['running confidence model...', 'scoring matches...'] },
  { icon: ListChecks, label: 'สรุปผล', duration: 1000, logs: ['preparing response...', 'scan complete ✓'] },
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
        {/* Upload area */}
        <button
          className="face-search-upload"
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          {preview ? (
            <div className="face-search-preview">
              <img src={preview} alt="Preview" />
            </div>
          ) : (
            <>
              <Camera className="w-10 h-10" />
              <p className="text-sm font-medium">อัปโหลดรูปเพื่อค้นหา</p>
              <p className="text-xs" style={{ color: 'var(--text-dim)' }}>กดเพื่อเลือกรูป หรือถ่ายภาพ</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
        </button>

        {/* Actions */}
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
          <div className="card p-6 text-center">
            <ImageOff className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-base font-bold mb-1" style={{ color: 'var(--text)' }}>ไม่พบใบหน้าในรูปภาพ</p>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>กรุณาอัปโหลดรูปที่เห็นใบหน้าชัดเจน</p>
            <button className="btn btn-secondary" onClick={handleReset}>ลองใหม่</button>
          </div>
        )}

        {/* No match */}
        {state === 'no_match' && (
          <div className="card p-6 text-center">
            <UserX className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-base font-bold mb-1" style={{ color: 'var(--text)' }}>ไม่พบข้อมูลที่ตรงกัน</p>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>ไม่มีข้อมูลในระบบที่ตรงกับใบหน้าในรูปภาพ</p>
            <button className="btn btn-secondary" onClick={handleReset}>ลองใหม่</button>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="card p-6 text-center">
            <AlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--danger)' }} />
            <p className="text-base font-bold mb-1" style={{ color: 'var(--text)' }}>ระบบไม่พร้อมใช้งานชั่วคราว</p>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>กรุณาลองใหม่อีกครั้งในภายหลัง</p>
            <button className="btn btn-secondary" onClick={handleReset}>ลองใหม่</button>
          </div>
        )}

        {/* Results */}
        {state === 'results' && result && (
          <div>
            <p className="text-sm font-bold mb-3" style={{ color: 'var(--accent)' }}>
              พบ {result.count} รายการที่ตรงกัน
            </p>
            <div className="space-y-2">
              {result.matches.map((match, idx) =>
                match.fraud ? (
                  <FraudRow
                    key={match.fraud.id || idx}
                    fraud={match.fraud}
                    onClick={() => onSelectFraud(match.fraud!)}
                    isMember={isMember}
                  />
                ) : null,
              )}
            </div>
            <button className="btn btn-secondary w-full mt-4" onClick={handleReset}>ค้นหาใหม่</button>
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
