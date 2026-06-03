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

export interface PostTypeCount {
  postType: string
  count: number
}

export interface PostTypeCountsResponse {
  counts: PostTypeCount[]
  total: number
}

export interface BatchJobProgress {
  jobId: string
  status: 'running' | 'completed' | 'failed'
  totalFound: number
  approved: number
  failed: number
  faceIngested: number
  batchesTotal: number
  batchesDone: number
  startedAt: string
  finishedAt?: string
}
