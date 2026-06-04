const CONSENT_KEY = 'cookie-consent'

export interface ConsentState {
  analytics: boolean
  marketing: boolean
  timestamp: string
}

export function getConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ConsentState
  } catch {
    return null
  }
}

export function setConsent(consent: ConsentState): void {
  localStorage.setItem(CONSENT_KEY, JSON.stringify(consent))
}

export function hasConsented(): boolean {
  return getConsent() !== null
}

export function acceptAll(): ConsentState {
  const consent: ConsentState = {
    analytics: true,
    marketing: true,
    timestamp: new Date().toISOString(),
  }
  setConsent(consent)
  return consent
}

export function rejectAll(): ConsentState {
  const consent: ConsentState = {
    analytics: false,
    marketing: false,
    timestamp: new Date().toISOString(),
  }
  setConsent(consent)
  return consent
}
