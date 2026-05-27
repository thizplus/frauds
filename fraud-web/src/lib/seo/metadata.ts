import type { Metadata } from 'next'
import seoConfig from './seo-config.json'

type PageKey = keyof typeof seoConfig.pages

export function getPageMetadata(page: PageKey): Metadata {
  const pageData = seoConfig.pages[page]
  const { siteName, siteUrl, themeColor } = seoConfig

  return {
    title: pageData.title,
    description: pageData.description,
    keywords: 'keywords' in pageData ? (pageData as any).keywords : undefined,
    openGraph: {
      title: pageData.title,
      description: pageData.description,
      siteName,
      url: siteUrl,
      locale: 'th_TH',
      type: 'website',
      images: [{ url: `${siteUrl}/og-image.png`, width: 1200, height: 630, alt: siteName }],
    },
    twitter: {
      card: 'summary_large_image',
      title: pageData.title,
      description: pageData.description,
      images: [`${siteUrl}/og-image.png`],
    },
    alternates: {
      canonical: siteUrl,
    },
    other: {
      'theme-color': themeColor,
    },
  }
}
