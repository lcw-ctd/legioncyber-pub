import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'
import Cookies from 'js-cookie'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: string) => void
  reject: (reason: unknown) => void
}> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token as string)
    }
  })
  failedQueue = []
}

const getAccessToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('access_token') || Cookies.get('access_token') || null
  }
  return null
}

const getRefreshToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('refresh_token') || Cookies.get('refresh_token') || null
  }
  return null
}

const getOrganizationId = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('organization_id') || Cookies.get('organization_id') || null
  }
  return null
}

export const setTokens = (accessToken: string, refreshToken: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)
    Cookies.set('access_token', accessToken, { expires: 1, secure: true, sameSite: 'strict' })
    Cookies.set('refresh_token', refreshToken, { expires: 7, secure: true, sameSite: 'strict' })
  }
}

export const clearTokens = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('organization_id')
    Cookies.remove('access_token')
    Cookies.remove('refresh_token')
    Cookies.remove('organization_id')
  }
}

const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// Request interceptor - inject auth token and org header
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken()
    const orgId = getOrganizationId()
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    if (orgId) {
      config.headers['X-Organization-Id'] = orgId
    }
    
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle 401 and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        }).catch((err) => Promise.reject(err))
      }
      
      originalRequest._retry = true
      isRefreshing = true
      
      const refreshToken = getRefreshToken()
      
      if (!refreshToken) {
        clearTokens()
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
      
      try {
        const response = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, {
          refresh_token: refreshToken,
        })
        
        const { access_token, refresh_token } = response.data
        setTokens(access_token, refresh_token)
        
        processQueue(null, access_token)
        originalRequest.headers.Authorization = `Bearer ${access_token}`
        
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        clearTokens()
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }
    
    return Promise.reject(error)
  }
)

export default api
