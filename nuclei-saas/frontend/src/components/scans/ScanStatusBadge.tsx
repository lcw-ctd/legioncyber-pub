import { cn } from '@/lib/utils'
import type { ScanStatus } from '@/types'

interface ScanStatusBadgeProps {
  status: ScanStatus
  className?: string
}

const statusConfig: Record<ScanStatus, { label: string; className: string; dot: string }> = {
  queued: { label: 'Queued', className: 'bg-slate-500/20 text-slate-300 border-slate-500/30', dot: 'bg-slate-400' },
  running: { label: 'Running', className: 'bg-blue-500/20 text-blue-300 border-blue-500/30', dot: 'bg-blue-400 animate-pulse' },
  completed: { label: 'Completed', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400' },
  failed: { label: 'Failed', className: 'bg-rose-500/20 text-rose-300 border-rose-500/30', dot: 'bg-rose-400' },
  cancelled: { label: 'Cancelled', className: 'bg-amber-500/20 text-amber-300 border-amber-500/30', dot: 'bg-amber-400' },
}

export function ScanStatusBadge({ status, className }: ScanStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.queued

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold', config.className, className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />
      {config.label}
    </span>
  )
}
