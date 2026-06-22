'use client'

import { useRouter } from 'next/navigation'
import { ExternalLink, Clock } from 'lucide-react'
import type { Finding } from '@/types'
import { formatDateRelative, truncate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface RecentFindingsTableProps {
  findings: Finding[]
}

const severityVariant: Record<string, 'critical' | 'high' | 'medium' | 'low' | 'info'> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
  info: 'info',
}

export function RecentFindingsTable({ findings }: RecentFindingsTableProps) {
  const router = useRouter()

  if (!findings || findings.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-slate-500 text-sm">
        No recent findings
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {findings.slice(0, 5).map((finding) => (
        <div
          key={finding.id}
          onClick={() => router.push(`/findings/${finding.id}`)}
          className="flex items-start gap-3 p-3 bg-[#0f1421] border border-[#1e293b] rounded-lg hover:border-[#2d3748] cursor-pointer transition-all group"
        >
          <Badge variant={severityVariant[finding.severity] || 'info'} className="shrink-0 mt-0.5">
            {finding.severity.toUpperCase()}
          </Badge>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate group-hover:text-blue-300 transition-colors">
              {finding.name}
            </p>
            <p className="text-xs text-slate-500 truncate">{truncate(finding.affected_url, 60)}</p>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500 shrink-0">
            <Clock className="h-3 w-3" />
            <span>{formatDateRelative(finding.first_seen)}</span>
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-slate-500 group-hover:text-blue-400 transition-colors shrink-0" />
        </div>
      ))}
    </div>
  )
}
