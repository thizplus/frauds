'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { ArticleCategory } from '@/features/blog'

interface Props {
  categories: ArticleCategory[]
  current: string
}

export function BlogCategoryFilter({ categories, current }: Props) {
  const router = useRouter()

  const handleChange = (slug: string) => {
    if (slug) {
      router.push(`/blog?category=${slug}`)
    } else {
      router.push('/blog')
    }
  }

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <button
        onClick={() => handleChange('')}
        className={`btn btn-sm ${!current ? 'btn-primary' : 'btn-secondary'}`}
      >
        ทั้งหมด
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => handleChange(cat.slug)}
          className={`btn btn-sm ${current === cat.slug ? 'btn-primary' : 'btn-secondary'}`}
        >
          {cat.name}
          {cat.articleCount > 0 && (
            <span className="ml-1 opacity-60">({cat.articleCount})</span>
          )}
        </button>
      ))}
    </div>
  )
}
