import type { MetadataRoute } from 'next'

const SITE_URL = 'https://xn--12cainl6g3mua5b.com'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.xn--12cainl6g3mua5b.com/api/v1'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/search`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/blog`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/pricing`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/report`, changeFrequency: 'monthly', priority: 0.7 },
  ]

  // Blog articles
  let blogUrls: MetadataRoute.Sitemap = []
  try {
    const res = await fetch(`${API_URL}/articles/sitemap`, { next: { revalidate: 300 } })
    if (res.ok) {
      const json = await res.json()
      const articles: { slug: string; updatedAt: string }[] = json.data || []
      blogUrls = articles.map((a) => ({
        url: `${SITE_URL}/blog/${a.slug}`,
        lastModified: a.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }))
    }
  } catch {}

  return [...staticPages, ...blogUrls]
}
