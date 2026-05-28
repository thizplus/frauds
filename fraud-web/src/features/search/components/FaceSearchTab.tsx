'use client'

import { useState, useRef, useCallback } from 'react'
import { Camera, Search, Loader2, UserX, AlertCircle, ImageOff } from 'lucide-react'
import { useAuthStore } from '@/lib/stores/auth'
import { searchService } from '../service'
import { FraudRow } from './FraudRow'
import type { FaceSearchResponse, FraudResponse } from '../types'

type FaceSearchState = 'idle' | 'loading' | 'results' | 'no_face' | 'no_match' | 'error'

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

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
    setState('idle')
    setResult(null)
  }, [])

  const handleSearch = useCallback(async () => {
    if (!file) return

    setState('loading')
    try {
      const res = await searchService.searchByFace(file)
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
  }, [file])

  const handleReset = useCallback(() => {
    setFile(null)
    setPreview(null)
    setState('idle')
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  // ต้อง login ก่อน
  if (!isLoggedIn) {
    return (
      <div className="face-search-message">
        <AlertCircle className="w-10 h-10" style={{ color: 'var(--accent)' }} />
        <p className="face-search-message-title">กรุณาเข้าสู่ระบบ</p>
        <p className="face-search-message-desc">ฟีเจอร์ค้นหาด้วยใบหน้าต้องเข้าสู่ระบบก่อนใช้งาน</p>
      </div>
    )
  }

  return (
    <div className="face-search-container">
      {/* Upload area */}
      <div
        className="face-search-upload"
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
      >
        {preview ? (
          <img src={preview} alt="Preview" className="face-search-preview" />
        ) : (
          <>
            <Camera className="w-10 h-10" style={{ color: 'var(--text-secondary)' }} />
            <p className="face-search-upload-title">อัปโหลดรูปเพื่อค้นหา</p>
            <p className="face-search-upload-hint">กดเพื่อเลือกรูป หรือถ่ายภาพ</p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Actions */}
      {file && state !== 'loading' && (
        <div className="face-search-actions">
          <button className="face-search-btn-primary" onClick={handleSearch}>
            <Search className="w-4 h-4" />
            ค้นหาด้วยใบหน้า
          </button>
          <button className="face-search-btn-secondary" onClick={handleReset}>
            เปลี่ยนรูป
          </button>
        </div>
      )}

      {/* Loading */}
      {state === 'loading' && (
        <div className="face-search-message">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} />
          <p className="face-search-message-title">กำลังค้นหา...</p>
          <p className="face-search-message-desc">ระบบกำลังเปรียบเทียบใบหน้ากับฐานข้อมูล</p>
        </div>
      )}

      {/* No face detected */}
      {state === 'no_face' && (
        <div className="face-search-message">
          <ImageOff className="w-10 h-10" style={{ color: 'var(--text-secondary)' }} />
          <p className="face-search-message-title">ไม่พบใบหน้าในรูปภาพ</p>
          <p className="face-search-message-desc">กรุณาอัปโหลดรูปที่เห็นใบหน้าชัดเจน</p>
        </div>
      )}

      {/* No match */}
      {state === 'no_match' && (
        <div className="face-search-message">
          <UserX className="w-10 h-10" style={{ color: 'var(--text-secondary)' }} />
          <p className="face-search-message-title">ไม่พบข้อมูลที่ตรงกัน</p>
          <p className="face-search-message-desc">ไม่มีข้อมูลในระบบที่ตรงกับใบหน้าในรูปภาพ</p>
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <div className="face-search-message">
          <AlertCircle className="w-10 h-10" style={{ color: 'var(--danger)' }} />
          <p className="face-search-message-title">ระบบค้นหาด้วยใบหน้าไม่พร้อมใช้งานชั่วคราว</p>
          <p className="face-search-message-desc">กรุณาลองใหม่อีกครั้งในภายหลัง</p>
        </div>
      )}

      {/* Results */}
      {state === 'results' && result && (
        <div className="face-search-results">
          <p className="face-search-results-count">
            พบ {result.count} รายการที่ตรงกัน
          </p>
          <div className="face-search-results-list">
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
        </div>
      )}
    </div>
  )
}
