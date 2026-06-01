import { useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface ImageLightboxProps {
  urls: string[]
  columns?: 2 | 3
}

export function ImageLightbox({ urls, columns = 2 }: ImageLightboxProps) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set())

  if (!urls || urls.length === 0) return null

  const validUrls = urls.filter((u) => !failedUrls.has(u))
  if (validUrls.length === 0) return null

  const handleError = (url: string) => {
    setFailedUrls((prev) => new Set(prev).add(url))
  }

  return (
    <>
      {/* Grid */}
      <div className={`grid gap-0.5 ${
        validUrls.length === 1 ? 'grid-cols-1' : `grid-cols-${columns}`
      }`}>
        {validUrls.slice(0, 4).map((url, i) => (
          <button
            key={url}
            onClick={() => setLightboxIdx(i)}
            className="relative overflow-hidden bg-muted hover:opacity-90 transition-opacity"
            style={{ maxHeight: validUrls.length === 1 ? '384px' : '200px' }}
          >
            <img
              src={url}
              alt={`รูปที่ ${i + 1}`}
              loading="lazy"
              className="w-full h-full object-cover"
              onError={() => handleError(url)}
            />
            {i === 3 && validUrls.length > 4 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xl font-bold">
                +{validUrls.length - 4}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setLightboxIdx(null)}
        >
          {/* Close */}
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
            onClick={() => setLightboxIdx(null)}
          >
            <X className="w-6 h-6" />
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-4 text-sm font-mono text-white/60">
            {lightboxIdx + 1} / {validUrls.length}
          </div>

          {/* Prev */}
          {lightboxIdx > 0 && (
            <button
              className="absolute left-3 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1) }}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Next */}
          {lightboxIdx < validUrls.length - 1 && (
            <button
              className="absolute right-3 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1) }}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Image */}
          <img
            src={validUrls[lightboxIdx]}
            alt={`รูปที่ ${lightboxIdx + 1}`}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
            onError={() => handleError(validUrls[lightboxIdx])}
          />
        </div>
      )}
    </>
  )
}
