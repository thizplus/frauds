import { apiClient, type PaginationMeta } from '@/lib/api-client'
import { PAYMENT_ROUTES, SERVICE_PAYMENT_ROUTES } from '@/constants/api-routes'
import type { TransactionItem } from './types'

export const transactionsService = {
  async list(params?: { status?: string; page?: number; limit?: number }): Promise<{ data: TransactionItem[]; meta: PaginationMeta }> {
    // ดึงทั้ง plan + service payments แล้วรวมกัน sort by date
    const [plans, services] = await Promise.all([
      apiClient.getPaginated<any>(PAYMENT_ROUTES.LIST, { params: { ...params, limit: 100 } }),
      apiClient.getPaginated<any>(SERVICE_PAYMENT_ROUTES.LIST, { params: { ...params, limit: 100 } }),
    ])

    const items: TransactionItem[] = [
      ...(plans.data || []).map((p: any) => ({
        id: p.id,
        type: 'plan' as const,
        userName: p.userName,
        userEmail: p.userEmail,
        detail: p.planName,
        amount: p.amount,
        status: p.status,
        createdAt: p.createdAt,
      })),
      ...(services.data || []).map((s: any) => ({
        id: s.id,
        type: 'service' as const,
        refCode: s.refCode,
        userName: s.userName,
        userEmail: s.userEmail,
        detail: s.serviceName,
        amount: s.amount,
        status: s.status,
        createdAt: s.createdAt,
      })),
    ]

    // Sort by date desc
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Manual pagination
    const page = params?.page || 1
    const limit = params?.limit || 20
    const start = (page - 1) * limit
    const paged = items.slice(start, start + limit)
    const total = items.length

    return {
      data: paged,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: start + limit < total,
        hasPrev: page > 1,
      },
    }
  },
}
