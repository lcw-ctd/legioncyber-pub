import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Organization, AuthTokens } from '@/types'
import { setTokens, clearTokens } from '@/lib/api'

interface AuthState {
  user: User | null
  organization: Organization | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (tokens: AuthTokens, user: User, org: Organization) => void
  logout: () => void
  setOrg: (org: Organization) => void
  setUser: (user: User) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      organization: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      login: (tokens: AuthTokens, user: User, org: Organization) => {
        setTokens(tokens.access_token, tokens.refresh_token)
        if (typeof window !== 'undefined') {
          localStorage.setItem('organization_id', org.id)
        }
        set({
          user,
          organization: org,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          isAuthenticated: true,
        })
      },

      logout: () => {
        clearTokens()
        set({
          user: null,
          organization: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        })
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
      },

      setOrg: (org: Organization) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('organization_id', org.id)
        }
        set({ organization: org })
      },

      setUser: (user: User) => {
        set({ user })
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        organization: state.organization,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
