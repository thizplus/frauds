export interface CategoryItem {
  id: string
  name: string
  description: string
  icon?: string
  fraudCount: number
}

export interface CreateCategoryRequest {
  id: string
  name: string
  description?: string
  icon?: string
}

export interface UpdateCategoryRequest {
  name?: string
  description?: string
  icon?: string
  isActive?: boolean
}
