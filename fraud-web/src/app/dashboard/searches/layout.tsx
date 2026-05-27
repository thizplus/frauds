import { getPageMetadata } from '@/lib/seo/metadata'

export const metadata = getPageMetadata('dashboard')

export default function SearchesLayout({ children }: { children: React.ReactNode }) {
  return children
}
