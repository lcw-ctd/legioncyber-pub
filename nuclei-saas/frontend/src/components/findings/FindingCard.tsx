'use client'

import { useRouter } from 'next/navigation'
import { ExternalLink, Clock, Globe } from 'lucide-react'
import type { Finding } from '@/types'
import { formatDateRelative, truncate } from '@/lib/utils'
import { SeverityBadge } from './SeverityBadge'
import { Badge } from '@/components/ui/badge'

interface FindingCardProps {
  finding: Finding
}

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  open: 'destructive',
  in_progress: 'warning',
  resolved: 'success',
  accepted: 'secondary',
  false_positive: 'secondary',
}

const statusLabel: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  accepted: 'Accepted',
  false_positive: 'False Positive',
}

export function FindingCard({ finding }: FindingCardProps) {
  const router = useRouter()

  return (
    <div
      onClick={() => router.push(`/findings/${finding.id}`)}
      className="bg-[#141929] border border-[#1e293b] rounded-xl p-4 hover:border-[#2d3748] cursor-pointer transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <SeverityBadge severity={finding.severity} />
          <Badge variant={statusVariant[finding.status] || 'secondary'} className="text-[10px]">
            {statusLabel[finding.status] || finding.status}
          </Badge>
          {finding.cvss_score && (
            <span className="text-xs text-slate-400">CVSS {finding.cvss_score.toFixed(1)}</span>
          )}
        </div>
        <ExternalLink className="h-4 w-4 text-slate-500 group-hover:text-blue-400 transition-colors shrink-0 mt-0.5" />
      </div>

      <h3 className="font-semibold text-white mb-1 group-hover:text-blue-300 transition-colors">
        {finding.name}
      </h3>

      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
        <Globe className="h-3 w-3 shrink-0" />
        <span className="truncate">{truncate(finding.affected_url, 60)}</span>
      </div>

      <p className="text-xs text-slate-400 line-clamp-2 mb-3">{finding.description}</p>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="bg-[#1e293b] px-2 py-0.5 rounded text-slate-400">{finding.owasp_category}</span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDateRelative(finding.first_seen)}
        </span>
      </div>
    </div>
  )
}
