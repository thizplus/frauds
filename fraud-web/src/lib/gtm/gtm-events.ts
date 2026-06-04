// Push events to GTM dataLayer
export function pushEvent(event: string, data?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  const w = window as typeof window & { dataLayer?: Record<string, unknown>[] }
  w.dataLayer = w.dataLayer || []
  w.dataLayer.push({ event, ...data })
}

// Common events
export function trackSearch(query: string, type: string, resultsCount: number) {
  pushEvent('search', { query, search_type: type, results_count: resultsCount })
}

export function trackBlogView(slug: string, category: string, title: string) {
  pushEvent('blog_view', { slug, category, title })
}

export function trackPlanView(planName: string, price: number) {
  pushEvent('plan_view', { plan_name: planName, price })
}

export function trackLogin(method: string) {
  pushEvent('login', { method })
}

export function trackReportSubmit(category: string) {
  pushEvent('report_submit', { category })
}
