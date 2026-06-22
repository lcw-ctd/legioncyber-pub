'use client'

import type { RemediationProgress as RemediationProgressType } from '@/types'
import { getSeverityColor } from '@/lib/utils'
import type { Severity } from '@/types'

interface RemediationProgressProps {
  data: RemediationProgressType
}

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low']

export function RemediationProgress({ data }: RemediationProgressProps) {
  const overallPct = data.total > 0 ? Math.round((data.resolved / data.total) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Overall */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-white">Overall Progress</span>
          <span className="text-sm font-bold text-emerald-400">{overallPct}%</span>
        </div>
        <div className="w-full h-2.5 bg-[#1e293b] rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-700"
            style={{ width: `${overallPct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>{data.resolved} resolved</span>
          <span>{data.total - data.resolved} remaining</span>
        </div>
      </div>

      {/* By severity */}
      <div className="space-y-2.5">
        {SEVERITIES.map((severity) => {
          const sData = data.by_severity[severity] || { total: 0, resolved: 0 }
          const pct = sData.total > 0 ? Math.round((sData.resolved / sData.total) * 100) : 0
          const color = getSeverityColor(severity)

          return (
            <div key={severity}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-400 capitalize">{severity}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{sData.resolved}/{sData.total}</span>
                  <span className="text-xs font-semibold" style={{ color }}>{pct}%</span>
                </div>
              </div>
              <div className="w-full h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.8 }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
