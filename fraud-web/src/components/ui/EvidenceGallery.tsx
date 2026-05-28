'use client'

import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, ImageOff, Lock } from 'lucide-react'

interface EvidenceGalleryProps {
  urls: string[]
  isMember?: boolean
}

export function EvidenceGallery({ urls, isMember = false }: EvidenceGalleryProps) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set())

  if (!urls || urls.length === 0) return null

  const validUrls = urls.filter((u) => !failedUrls.has(u))

  const handleError = (url: string) => {
    setFailedUrls((prev) => new Set(prev).add(url))
  }

  // Non-member: blur + lock
  if (!isMember) {
    return (
      <div className="mt-4">
        <div className="text-xs uppercase tracking-wider mb-2 px-1 font-mono" style={{ color: 'var(--text-dim)' }}>
          หลักฐาน ({urls.length} รูป)
        </div>
        <div className="relative rounded-xl overflow-hidden" style={{ background: 'var(--bg-input)' }}>
          <div className="grid grid-cols-3 gap-1 p-1 blur-sm opacity-40">
            {urls.slice(0, 6).map((url, i) => (
              <div key={i} className="aspect-square rounded-lg" style={{ background: 'var(--bg-elevated)' }} />
            ))}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Lock className="w-6 h-6" style={{ color: 'var(--accent)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              สมัครสมาชิกเพื่อดูรูปหลักฐาน
            </p>
            <a href="/pricing" className="btn btn-primary btn-sm mt-1">สมัครเลย</a>
          </div>
        </div>
      </div>
    )
  }

  if (validUrls.length === 0) return null

  return (
    <div className="mt-4">
      <div className="text-xs uppercase tracking-wider mb-2 px-1 font-mono" style={{ color: 'var(--text-dim)' }}>
        หลักฐาน ({validUrls.length} รูป)
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {validUrls.map((url, i) => (
          <button
            key={url}
            onClick={() => setLightboxIdx(i)}
            className="aspect-square rounded-lg overflow-hidden transition-opacity hover:opacity-80"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          >
            <img
              src={url}
              alt={`หลักฐาน ${i + 1}`}
              loading="lazy"
              className="w-full h-full object-cover"
              onError={() => handleError(url)}
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,.92)' }}
          onClick={() => setLightboxIdx(null)}
        >
          {/* Close */}
          <button
            className="absolute top-4 right-4 p-2 rounded-full transition-opacity hover:opacity-70"
            style={{ background: 'rgba(255,255,255,.1)', color: '#fff' }}
            onClick={() => setLightboxIdx(null)}
          >
            <X className="w-6 h-6" />
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-4 text-sm font-mono" style={{ color: 'rgba(255,255,255,.6)' }}>
            {lightboxIdx + 1} / {validUrls.length}
          </div>

          {/* Prev */}
          {lightboxIdx > 0 && (
            <button
              className="absolute left-3 p-2 rounded-full transition-opacity hover:opacity-70"
              style={{ background: 'rgba(255,255,255,.1)', color: '#fff' }}
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1) }}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Next */}
          {lightboxIdx < validUrls.length - 1 && (
            <button
              className="absolute right-3 p-2 rounded-full transition-opacity hover:opacity-70"
              style={{ background: 'rgba(255,255,255,.1)', color: '#fff' }}
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1) }}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Image */}
          <img
            src={validUrls[lightboxIdx]}
            alt={`หลักฐาน ${lightboxIdx + 1}`}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
            onError={() => handleError(validUrls[lightboxIdx])}
          />
        </div>
      )}
    </div>
  )
}
