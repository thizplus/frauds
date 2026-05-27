import { getPageMetadata } from '@/lib/seo/metadata'

export const metadata = getPageMetadata('dashboardReports')

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return children
}
