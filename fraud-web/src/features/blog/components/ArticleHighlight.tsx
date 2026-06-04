interface ArticleHighlightProps {
  excerpt: string
}

export function ArticleHighlight({ excerpt }: ArticleHighlightProps) {
  if (!excerpt) return null

  // ถ้า excerpt มี bullet points (-, •, ✓) แสดงเป็น checklist
  const lines = excerpt.split('\n').map((l) => l.trim()).filter(Boolean)
  const isList = lines.length > 1 && lines.some((l) => /^[-•✓·]/.test(l))

  return (
    <div className="article-highlight">
      <div className="article-highlight-quote">"</div>
      <div className="article-highlight-content">
        {isList ? (
          <>
            <p className="article-highlight-label">สิ่งที่คุณจะได้จากบทความนี้</p>
            <ul className="article-highlight-list">
              {lines.map((line, i) => (
                <li key={i}>{line.replace(/^[-•✓·]\s*/, '')}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="article-highlight-text">{excerpt}</p>
        )}
      </div>
      <div className="article-highlight-quote article-highlight-quote-end">"</div>
    </div>
  )
}
