'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { ToastProvider, ToastViewport } from '@/components/ui/toast'
import { TooltipProvider } from '@/components/ui/tooltip'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: (failureCount, error: unknown) => {
              const err = error as { response?: { status: number } }
              if (err?.response?.status === 401 || err?.response?.status === 403) return false
              return failureCount < 3
            },
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <ToastProvider>
          {children}
          <ToastViewport />
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}
