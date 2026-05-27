const STORAGE_KEY = 'guest-search'
const QUOTA_CACHE_KEY = 'guest-search-quota'
const DEFAULT_LIMIT = 3

interface GuestSearch {
  date: string
  count: number
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function getLimit(): number {
  try {
    const cached = localStorage.getItem(QUOTA_CACHE_KEY)
    if (cached) {
      const { value, exp } = JSON.parse(cached)
      if (Date.now() < exp) return value
    }
  } catch {}
  return DEFAULT_LIMIT
}

function getState(): GuestSearch {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { date: getToday(), count: 0 }
    const state: GuestSearch = JSON.parse(raw)
    if (state.date !== getToday()) return { date: getToday(), count: 0 }
    return state
  } catch {
    return { date: getToday(), count: 0 }
  }
}

export function getGuestSearchRemaining(): number {
  const state = getState()
  return Math.max(0, getLimit() - state.count)
}

export function canGuestSearch(): boolean {
  return getGuestSearchRemaining() > 0
}

export function incrementGuestSearch(): void {
  const state = getState()
  state.count += 1
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

// เรียกตอน app load — fetch quota จาก API แล้ว cache 10 นาที
export async function fetchGuestQuota(apiUrl: string): Promise<void> {
  try {
    const res = await fetch(`${apiUrl}/settings/public`)
    const data = await res.json()
    if (data.success && data.data?.['quota.guest_search_limit'] != null) {
      const value = Number(data.data['quota.guest_search_limit'])
      localStorage.setItem(QUOTA_CACHE_KEY, JSON.stringify({
        value,
        exp: Date.now() + 10 * 60 * 1000,
      }))
    }
  } catch {}
}
