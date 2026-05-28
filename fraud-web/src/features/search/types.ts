export interface FraudResponse {
  id: string
  categoryId: string
  categoryName: string
  fraudType?: string
  name?: string
  phone?: string
  bankAccount?: string
  bankName?: string
  idCard?: string
  description?: string
  amount?: number
  extraData?: Record<string, unknown>
  reportCount: number
  verified: boolean
  status?: 'pending' | 'verified' | 'settled'
  createdAt: string
}

export interface CategoryResponse {
  id: string
  name: string
  description: string
  icon?: string
  fraudCount: number
}

export interface SearchParams {
  q: string
  type?: string
  category?: string
  page?: number
  limit?: number
}

export interface StatsResponse {
  totalFrauds: number
  totalVerified: number
  totalSearches: number
  categoryStats: {
    categoryId: string
    categoryName: string
    fraudCount: number
  }[]
}

export interface UnifiedSearchResponse {
  query: string
  sections: UnifiedSection[]
  totalResults: number
}

export interface UnifiedSection {
  source: string  // "frauds" | "social"
  label: string
  count: number
  results: FraudResponse[] | SocialResult[]
}

export interface SocialResult {
  matchedValue: string
  displayName?: string
  entityType: string
  verificationState: string
  confidence: number
  similarity?: number
  permalinkUrl?: string
  role?: string
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

export interface FaceSearchResponse {
  faceDetected: boolean
  matches: FaceMatch[]
  count: number
  message?: string
}

export interface FaceMatch {
  evidenceStrength: string
  sourceType: string
  similarity: number
  fraud?: FraudResponse
  socialPost?: {
    postId: string
    displayName?: string
    permalinkUrl?: string
    groupId?: string
  }
}
