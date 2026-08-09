import { apiGet, apiPost } from './client'

export interface User {
  id: string
  email: string
  full_name: string
  created_at: string
}

export interface RegisterPayload {
  email: string
  full_name: string
  password: string
}

export interface LoginPayload {
  email: string
  password: string
}

export function register(payload: RegisterPayload): Promise<User> {
  return apiPost<User>('/auth/register', payload)
}

export function login(payload: LoginPayload): Promise<User> {
  return apiPost<User>('/auth/login', payload)
}

export function logout(): Promise<void> {
  return apiPost<void>('/auth/logout')
}

export function fetchCurrentUser(): Promise<User> {
  return apiGet<User>('/auth/me')
}
