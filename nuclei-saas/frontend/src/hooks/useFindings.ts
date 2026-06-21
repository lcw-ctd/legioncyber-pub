'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Finding, FindingStatus, PaginatedResponse } from '@/types'

interface FindingsFilters {
  page?: number
  page_size?: number
  severity?: string | string[]
  status?: string | string[]
  owasp_category?: string
  scan_id?: string
  search?: string
  date_from?: string
  date_to?: string
}

export function useFindings(filters: FindingsFilters = {}) {
  return useQuery({
    queryKey: ['findings', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach((v) => params.append(key, v))
          } else {
            params.set(key, String(value))
          }
        }
      })
      const response = await api.get<PaginatedResponse<Finding>>(`/findings?${params}`)
      return response.data
    },
    staleTime: 30 * 1000,
  })
}

export function useFinding(findingId: string) {
  return useQuery({
    queryKey: ['finding', findingId],
    queryFn: async () => {
      const response = await api.get<Finding>(`/findings/${findingId}`)
      return response.data
    },
    enabled: !!findingId,
  })
}

export function useUpdateFindingStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ findingId, status, comment }: { findingId: string; status: FindingStatus; comment?: string }) => {
      const response = await api.patch(`/findings/${findingId}/status`, { status, comment })
      return response.data
    },
    onSuccess: (_, { findingId }) => {
      queryClient.invalidateQueries({ queryKey: ['finding', findingId] })
      queryClient.invalidateQueries({ queryKey: ['findings'] })
    },
  })
}

export function useAddFindingComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ findingId, content }: { findingId: string; content: string }) => {
      const response = await api.post(`/findings/${findingId}/comments`, { content })
      return response.data
    },
    onSuccess: (_, { findingId }) => {
      queryClient.invalidateQueries({ queryKey: ['finding', findingId] })
    },
  })
}

export function useBulkUpdateFindings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ findingIds, status }: { findingIds: string[]; status: FindingStatus }) => {
      const response = await api.patch('/findings/bulk', { finding_ids: findingIds, status })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['findings'] })
    },
  })
}
