'use client'

import { useEffect } from 'react'

interface ArticleContentProps {
  html: string
  articleId: string
}

export function ArticleContent({ html, articleId }: ArticleContentProps) {
  // Increment view count (fire-and-forget)
  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL
    if (API_URL && articleId) {
      fetch(`${API_URL}/articles/${articleId}/view`, { method: 'PATCH' }).catch(() => {})
    }
  }, [articleId])

  return (
    <div
      className="article-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
