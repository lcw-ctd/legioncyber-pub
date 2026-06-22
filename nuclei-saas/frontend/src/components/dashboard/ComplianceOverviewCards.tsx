'use client'

import type { ComplianceOverview } from '@/types'
import { getFrameworkLabel, getScoreColor } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface ComplianceOverviewCardsProps {
  data: ComplianceOverview[]
}

export function ComplianceOverviewCards({ data }: ComplianceOverviewCardsProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-slate-500 text-sm">
        No compliance frameworks configured
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {data.map((item) => {
        const color = getScoreColor(item.score)
        const pct = Math.round((item.passing / item.total) * 100) || item.score

        return (
          <div key={item.framework} className="bg-[#0f1421] border border-[#1e293b] rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300">{getFrameworkLabel(item.framework)}</span>
              <span className="text-sm font-bold" style={{ color }}>{item.score}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 mt-1.5">
              <span>{item.passing} passing</span>
              <span>{item.total - item.passing} failing</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
