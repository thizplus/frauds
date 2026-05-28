export interface FormFieldsConfig {
  lastName: boolean
  idCard: boolean
  phone: boolean
  bankAccount: boolean
  bankName: boolean
  address: boolean
  socialAccounts: boolean
  idCardImage: boolean
  selfieImage: boolean
}

export interface LenderProfile {
  id: string
  businessName: string
  inviteCode: string
  inviteUrl: string
  formFields: FormFieldsConfig
  isActive: boolean
  createdAt: string
}

export interface Debtor {
  id: string
  firstName: string
  lastName?: string
  idCard?: string
  phone?: string
  bankAccount?: string
  bankName?: string
  status: string // "active" | "flagged" | "cleared"
  checkMatches: number
  checkedAt?: string | null
  createdAt: string
}

export interface DebtorDetail extends Debtor {
  address?: string
  socialAccounts?: string[]
  idCardImage?: string
  selfieImage?: string
  note?: string
  fraudId?: string | null
  flaggedReason?: string
  flaggedAmount?: number
  flaggedDetail?: string
  flaggedAt?: string | null
  clearedNote?: string
  clearedAt?: string | null
  checkResult?: CheckResultItem[] | null
}

export interface CheckResultItem {
  source: string
  matchedBy: string
  // fraud
  name?: string
  reportCount?: number
  verified?: boolean
  createdAt?: string
  // social
  displayName?: string
  role?: string
  verificationState?: string
  confidence?: number
  permalinkUrl?: string
  sourceType?: string
  postInfo?: {
    authorName: string
    message: string
    postDate?: string
    reactionCount: number
    commentCount: number
    imageCount: number
  }
}
