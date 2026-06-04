'use client'

import { useEffect, useMemo } from 'react'
import { parseTOC } from '../utils'
import { TableOfContents } from './TableOfContents'

interface ArticleContentProps {
  html: string
  articleId: string
}

export function ArticleContent({ html, articleId }: ArticleContentProps) {
  // Parse TOC + inject heading IDs
  const { toc, htmlWithIds } = useMemo(() => parseTOC(html), [html])

  // Increment view count (fire-and-forget)
  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL
    if (API_URL && articleId) {
      fetch(`${API_URL}/articles/${articleId}/view`, { method: 'PATCH' }).catch(() => {})
    }
  }, [articleId])

  return (
    <div className="article-with-toc">
      <div className="article-main">
        <div
          className="article-content"
          dangerouslySetInnerHTML={{ __html: htmlWithIds }}
        />
      </div>
      {toc.length >= 2 && (
        <aside className="article-sidebar">
          <TableOfContents items={toc} />
        </aside>
      )}
    </div>
  )
}
