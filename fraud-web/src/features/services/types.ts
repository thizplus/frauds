export interface ServiceItem {
  id: string
  name: string
  description: string
  price: number
  duration?: string
  features: string[] | null
  expectedResults?: string
  notes?: string
  isActive: boolean
}
