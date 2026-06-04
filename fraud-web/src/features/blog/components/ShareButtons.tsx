'use client'

import { Share2 } from 'lucide-react'

interface ShareButtonsProps {
  url: string
  title: string
}

export function ShareButtons({ url, title }: ShareButtonsProps) {
  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)

  const shareLinks = [
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, color: '#1877F2' },
    { label: 'LINE', href: `https://social-plugins.line.me/lineit/share?url=${encodedUrl}`, color: '#06C755' },
    { label: 'X', href: `https://x.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`, color: '#1DA1F2' },
  ]

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch {}
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-sm text-secondary flex items-center gap-1.5">
        <Share2 className="w-4 h-4" />
        แชร์:
      </span>
      {shareLinks.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary btn-sm"
        >
          {link.label}
        </a>
      ))}
      {typeof navigator !== 'undefined' && 'share' in navigator && (
        <button onClick={handleNativeShare} className="btn btn-secondary btn-sm">
          อื่นๆ
        </button>
      )}
    </div>
  )
}
