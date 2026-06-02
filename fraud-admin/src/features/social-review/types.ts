export interface SocialPostItem {
  postId: string
  groupId: string
  authorName: string
  message: string
  permalinkUrl: string
  creationTime: string
  reactionCount: number
  commentCount: number
  imageCount: number
  personCount: number
  reviewStatus: string
  postType: string
  postTypeConfidence: string
  postTypeReason: string
  imageUrls: string[]
  comments: SocialComment[]
  entities: SocialEntity[]
}

export interface SocialComment {
  authorName: string
  text: string
  imageUrls?: string[]
}

export interface SocialEntity {
  entityType: string
  rawValue: string
  normalizedValue?: string
  confidenceScore: number
  sourceType?: string
}
