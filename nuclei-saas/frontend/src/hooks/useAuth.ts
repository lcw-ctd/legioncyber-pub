'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import type { AuthTokens, User, Organization } from '@/types'

interface LoginCredentials {
  email: string
  password: string
}

interface LoginResponse {
  tokens: AuthTokens
  user: User
  organization: Organization
}

interface RegisterData {
  full_name: string
  email: string
  password: string
  company_name: string
  agree_to_terms: boolean
}

export function useAuth() {
  const router = useRouter()
  const { user, organization, isAuthenticated, login, logout } = useAuthStore()

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials): Promise<LoginResponse> => {
      const response = await api.post<LoginResponse>('/auth/login', credentials)
      return response.data
    },
    onSuccess: (data) => {
      login(data.tokens, data.user, data.organization)
      router.push('/dashboard')
    },
  })

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const response = await api.post('/auth/register', data)
      return response.data
    },
    onSuccess: () => {
      router.push('/onboarding')
    },
  })

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout')
    },
    onSettled: () => {
      logout()
    },
  })

  const forgotPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await api.post('/auth/forgot-password', { email })
      return response.data
    },
  })

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const response = await api.get<User>('/auth/me')
      return response.data
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  })

  return {
    user: currentUser || user,
    organization,
    isAuthenticated,
    loginMutation,
    registerMutation,
    logoutMutation,
    forgotPasswordMutation,
  }
}
