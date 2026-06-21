'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Scan, ScanConfig, PaginatedResponse } from '@/types'

interface ScansFilters {
  page?: number
  page_size?: number
  status?: string
  domain_id?: string
  scan_type?: string
}

export function useScans(filters: ScansFilters = {}) {
  return useQuery({
    queryKey: ['scans', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.set(key, String(value))
      })
      const response = await api.get<PaginatedResponse<Scan>>(`/scans?${params}`)
      return response.data
    },
    staleTime: 30 * 1000,
  })
}

export function useScan(scanId: string) {
  return useQuery({
    queryKey: ['scan', scanId],
    queryFn: async () => {
      const response = await api.get<Scan>(`/scans/${scanId}`)
      return response.data
    },
    enabled: !!scanId,
    refetchInterval: (data) => {
      if (data && (data.status === 'running' || data.status === 'queued')) {
        return 5000
      }
      return false
    },
  })
}

export function useCreateScan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (config: { domain_id: string; scan_config: ScanConfig; scan_type: string; scan_mode: string }) => {
      const response = await api.post<Scan>('/scans', config)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scans'] })
    },
  })
}

export function useCancelScan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (scanId: string) => {
      const response = await api.post(`/scans/${scanId}/cancel`)
      return response.data
    },
    onSuccess: (_, scanId) => {
      queryClient.invalidateQueries({ queryKey: ['scan', scanId] })
      queryClient.invalidateQueries({ queryKey: ['scans'] })
    },
  })
}
