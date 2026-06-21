'use client'

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { DashboardSummary } from '@/types'

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await api.get<DashboardSummary>('/dashboard/summary')
      return response.data
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })
}

export function useDashboardScanActivity(days: number = 30) {
  return useQuery({
    queryKey: ['dashboard', 'scan-activity', days],
    queryFn: async () => {
      const response = await api.get(`/dashboard/scan-activity?days=${days}`)
      return response.data
    },
    staleTime: 5 * 60 * 1000,
  })
}
