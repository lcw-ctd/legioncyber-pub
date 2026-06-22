import { cn } from '@/lib/utils'
import type { Severity } from '@/types'

interface SeverityBadgeProps {
  severity: Severity
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const severityConfig: Record<Severity, { label: string; className: string }> = {
  critical: { label: 'Critical', className: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  high: { label: 'High', className: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  medium: { label: 'Medium', className: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  low: { label: 'Low', className: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  info: { label: 'Info', className: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
}

const sizeClasses = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-0.5 text-xs',
  lg: 'px-3 py-1 text-sm',
}

export function SeverityBadge({ severity, className, size = 'md' }: SeverityBadgeProps) {
  const config = severityConfig[severity] || severityConfig.info

  return (
    <span className={cn('inline-flex items-center rounded-full border font-semibold', config.className, sizeClasses[size], className)}>
      {config.label}
    </span>
  )
}
