'use client'

import { useRef } from 'react'
import { Camera, ImagePlus, X } from 'lucide-react'

interface ImageUploadProps {
  label?: string
  file: { file: File; preview: string } | null
  onChange: (file: { file: File; preview: string } | null) => void
  /** "environment" = กล้องหลัง (บัตร), "user" = กล้องหน้า (selfie), undefined = เลือกจาก gallery */
  capture?: 'environment' | 'user'
  /** icon แสดงตอนยังไม่เลือก */
  icon?: 'camera' | 'image'
  placeholder?: string
  className?: string
}

export function ImageUpload({
  label,
  file,
  onChange,
  capture,
  icon = 'camera',
  placeholder = 'ถ่ายรูปหรือเลือกรูป',
  className,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) onChange({ file: f, preview: URL.createObjectURL(f) })
  }

  const handleRemove = () => {
    if (file) URL.revokeObjectURL(file.preview)
    onChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const IconComp = icon === 'camera' ? Camera : ImagePlus

  return (
    <div className={className}>
      {label && <label className="report-label">{label}</label>}
      {file ? (
        <div className="relative rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <img src={file.preview} alt="" className="w-full h-40 object-cover" />
          <button
            type="button"
            className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
            onClick={handleRemove}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label
          className="flex flex-col items-center gap-2 p-6 rounded-xl cursor-pointer"
          style={{ border: '2px dashed var(--border-strong)', color: 'var(--text-dim)' }}
        >
          <IconComp className="w-8 h-8" />
          <span className="text-sm">{placeholder}</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            {...(capture ? { capture } : {})}
            hidden
            onChange={handleSelect}
          />
        </label>
      )}
    </div>
  )
}
