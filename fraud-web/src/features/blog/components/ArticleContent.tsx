'use client'

import { useEffect, useMemo } from 'react'
import { parseTOC } from '../utils'
import { TableOfContents } from './TableOfContents'
import { ArticleCTA } from './ArticleCTA'

interface ArticleContentProps {
  html: string
  articleId: string
  categorySlug?: string
}

// แทรก mid CTA หลัง H2 ที่ 3
function injectMidCTA(html: string): { before: string; after: string } | null {
  let count = 0
  const regex = /<h2[\s>]/gi
  let lastIndex = 0
  let splitIndex = -1

  regex.lastIndex = 0
  let match
  while ((match = regex.exec(html)) !== null) {
    count++
    if (count === 4) {
      splitIndex = match.index
      break
    }
    lastIndex = match.index
  }

  // ถ้ามี H2 >= 4 ตัว แทรกก่อน H2 ที่ 4, ถ้า 3 ตัว แทรกหลัง H2 ที่ 3
  if (count >= 4 && splitIndex > 0) {
    return { before: html.slice(0, splitIndex), after: html.slice(splitIndex) }
  }
  if (count >= 3) {
    // หา closing tag ของ section หลัง H2 ที่ 3
    const afterH3 = html.indexOf('<h2', lastIndex + 4)
    if (afterH3 > 0) {
      return { before: html.slice(0, afterH3), after: html.slice(afterH3) }
    }
  }

  return null
}

export function ArticleContent({ html, articleId, categorySlug }: ArticleContentProps) {
  const { toc, htmlWithIds } = useMemo(() => parseTOC(html), [html])
  const split = useMemo(() => injectMidCTA(htmlWithIds), [htmlWithIds])

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL
    if (API_URL && articleId) {
      fetch(`${API_URL}/articles/${articleId}/view`, { method: 'PATCH' }).catch(() => {})
    }
  }, [articleId])

  return (
    <div className="article-with-toc">
      <div className="article-main">
        {split ? (
          <>
            <div className="article-content" dangerouslySetInnerHTML={{ __html: split.before }} />
            <ArticleCTA variant="mid" categorySlug={categorySlug} />
            <div className="article-content" dangerouslySetInnerHTML={{ __html: split.after }} />
          </>
        ) : (
          <div className="article-content" dangerouslySetInnerHTML={{ __html: htmlWithIds }} />
        )}
      </div>
      {toc.length >= 2 && (
        <aside className="article-sidebar">
          <TableOfContents items={toc} />
        </aside>
      )}
    </div>
  )
}
