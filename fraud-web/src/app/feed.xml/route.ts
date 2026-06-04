const SITE_URL = 'https://xn--12cainl6g3mua5b.com'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.xn--12cainl6g3mua5b.com/api/v1'

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  let items = ''

  try {
    const res = await fetch(`${API_URL}/articles?limit=20`, { next: { revalidate: 300 } })
    if (res.ok) {
      const json = await res.json()
      const articles: { title: string; slug: string; excerpt: string; publishedAt: string }[] = json.data || []

      items = articles
        .map(
          (a) => `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${SITE_URL}/blog/${a.slug}</link>
      <description>${escapeXml(a.excerpt || '')}</description>
      <pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate>
      <guid isPermaLink="true">${SITE_URL}/blog/${a.slug}</guid>
    </item>`
        )
        .join('\n')
    }
  } catch {}

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>เช็กคนโกง — บทความ</title>
    <link>${SITE_URL}/blog</link>
    <description>บทความเกี่ยวกับการป้องกันโกงออนไลน์ ข่าวสารคนโกง วิธีตรวจสอบ</description>
    <language>th</language>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
