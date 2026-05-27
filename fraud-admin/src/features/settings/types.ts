export interface Setting {
  key: string
  value: unknown
  description: string
  category: string
  updatedAt: string
}

export interface UpdateSettingRequest {
  value: unknown
  description?: string
}

// ค่า setting แต่ละ category
export interface PricingSettings {
  'pricing.report_fee': number
  'pricing.membership_monthly': number
  'pricing.membership_yearly': number
  'pricing.free_search_limit': number
}

export interface DisplaySettings {
  'display.mask_phone': boolean
  'display.mask_bank': boolean
  'display.show_evidence': string
  'display.max_results_free': number
  'display.max_results_member': number
}

export interface SystemSettings {
  'system.maintenance_mode': boolean
  'system.registration_open': boolean
  'system.require_evidence': boolean
  'system.auto_verify_threshold': number
}
