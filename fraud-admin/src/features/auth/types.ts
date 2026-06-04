export interface User {
  id: string
  email: string
  name: string
  role: string
  avatarUrl?: string
  bio?: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: User
}
