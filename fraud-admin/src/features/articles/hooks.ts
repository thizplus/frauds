import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { articleService } from './service'
import type { CreateArticleRequest, UpdateArticleRequest, CreateArticleCategoryRequest, UpdateArticleCategoryRequest } from './types'

export const articleKeys = {
  all: ['articles'] as const,
  list: (params?: Record<string, unknown>) => [...articleKeys.all, 'list', params] as const,
  detail: (id: string) => [...articleKeys.all, 'detail', id] as const,
  categories: ['article-categories'] as const,
}

export function useArticleList(params?: { page?: number; limit?: number; status?: string; search?: string }) {
  return useQuery({
    queryKey: articleKeys.list(params as Record<string, unknown>),
    queryFn: () => articleService.list(params),
  })
}

export function useArticleDetail(id: string) {
  return useQuery({
    queryKey: articleKeys.detail(id),
    queryFn: () => articleService.getById(id),
    enabled: !!id,
  })
}

export function useCreateArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateArticleRequest) => articleService.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: articleKeys.all }),
  })
}

export function useUpdateArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateArticleRequest }) => articleService.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: articleKeys.all }),
  })
}

export function useDeleteArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => articleService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: articleKeys.all }),
  })
}

export function usePublishArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => articleService.publish(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: articleKeys.all }),
  })
}

export function useUnpublishArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => articleService.unpublish(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: articleKeys.all }),
  })
}

// Categories
export function useArticleCategories() {
  return useQuery({
    queryKey: articleKeys.categories,
    queryFn: () => articleService.listCategories(),
  })
}

export function useCreateArticleCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateArticleCategoryRequest) => articleService.createCategory(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: articleKeys.categories }),
  })
}

export function useUpdateArticleCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateArticleCategoryRequest }) => articleService.updateCategory(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: articleKeys.categories }),
  })
}

export function useDeleteArticleCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => articleService.deleteCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: articleKeys.categories }),
  })
}
