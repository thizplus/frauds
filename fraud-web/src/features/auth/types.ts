export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  name: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: UserResponse
}

export interface LineLoginRequest {
  code: string
  redirectUri: string
}

export interface UserResponse {
  id: string
  email: string
  name: string
  role: string
  avatarUrl?: string
}
