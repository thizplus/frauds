import { getPageMetadata } from '@/lib/seo/metadata'

export const metadata = getPageMetadata('pricing')

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
