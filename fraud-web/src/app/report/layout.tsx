import { getPageMetadata } from '@/lib/seo/metadata'

export const metadata = getPageMetadata('report')

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return children
}
