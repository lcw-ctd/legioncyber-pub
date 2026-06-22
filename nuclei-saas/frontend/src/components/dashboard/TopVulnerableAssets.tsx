'use client'

import { Globe, AlertTriangle } from 'lucide-react'
import type { VulnerableAsset } from '@/types'
import { getSeverityColor, truncate } from '@/lib/utils'

interface TopVulnerableAssetsProps {
  assets: VulnerableAsset[]
}

export function TopVulnerableAssets({ assets }: TopVulnerableAssetsProps) {
  if (!assets || assets.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-slate-500 text-sm">
        No vulnerable assets found
      </div>
    )
  }

  const maxCount = Math.max(...assets.map((a) => a.finding_count), 1)

  return (
    <div className="space-y-3">
      {assets.slice(0, 5).map((asset, index) => {
        const color = getSeverityColor(asset.highest_severity)
        const barWidth = Math.max((asset.finding_count / maxCount) * 100, 4)

        return (
          <div key={`${asset.domain}-${index}`} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Globe className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="text-sm text-slate-300 truncate">{truncate(asset.url || asset.domain, 45)}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-xs font-semibold text-white">{asset.finding_count}</span>
                <AlertTriangle className="h-3.5 w-3.5" style={{ color }} />
              </div>
            </div>
            <div className="w-full h-1.5 bg-[#1e293b] rounded-full">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${barWidth}%`, backgroundColor: color, opacity: 0.8 }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
