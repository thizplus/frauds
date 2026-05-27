import { apiClient } from '@/lib/api/client'
import { ENDPOINTS } from '@/lib/api/endpoints'
import type { ApiResponse } from '@/lib/api/types'
import type { AuthResponse, LoginRequest, RegisterRequest, LineLoginRequest } from './types'

export const authService = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    const res = await apiClient.post<ApiResponse<AuthResponse>>(
      ENDPOINTS.AUTH_LOGIN,
      data,
    )
    return res.data.data
  },

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const res = await apiClient.post<ApiResponse<AuthResponse>>(
      ENDPOINTS.AUTH_REGISTER,
      data,
    )
    return res.data.data
  },

  async lineLogin(data: LineLoginRequest): Promise<AuthResponse> {
    const res = await apiClient.post<ApiResponse<AuthResponse>>(
      ENDPOINTS.AUTH_LINE,
      data,
    )
    return res.data.data
  },

  async liffLogin(liffAccessToken: string): Promise<AuthResponse> {
    const res = await apiClient.post<ApiResponse<AuthResponse>>(
      '/auth/liff',
      { accessToken: liffAccessToken },
    )
    return res.data.data
  },

  async getProfile(): Promise<AuthResponse['user']> {
    const res = await apiClient.get<ApiResponse<AuthResponse['user']>>(
      '/me/profile',
    )
    return res.data.data
  },
}
