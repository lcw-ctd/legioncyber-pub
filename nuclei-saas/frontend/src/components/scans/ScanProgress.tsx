'use client'

import { Progress } from '@/components/ui/progress'
import { formatDuration } from '@/lib/utils'
import type { Scan } from '@/types'

interface ScanProgressProps {
  scan: Scan
}

export function ScanProgress({ scan }: ScanProgressProps) {
  const elapsed = scan.started_at
    ? Math.floor((Date.now() - new Date(scan.started_at).getTime()) / 1000)
    : 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">
          {scan.templates_matched} / {scan.templates_run} templates matched
        </span>
        <span className="font-semibold text-white">{scan.progress}%</span>
      </div>
      <Progress
        value={scan.progress}
        className="h-2"
        indicatorClassName="bg-blue-500 transition-all duration-1000"
      />
      <div className="flex justify-between text-xs text-slate-500">
        <span>
          {scan.finding_counts.total} finding{scan.finding_counts.total !== 1 ? 's' : ''} so far
        </span>
        <span>Elapsed: {formatDuration(elapsed)}</span>
      </div>
      {/* Live finding counters */}
      {scan.status === 'running' && (
        <div className="grid grid-cols-5 gap-1.5 mt-2">
          {(['critical', 'high', 'medium', 'low', 'info'] as const).map((sev) => (
            <div key={sev} className={`text-center rounded p-1.5 severity-${sev}`}>
              <div className="text-base font-bold">{scan.finding_counts[sev]}</div>
              <div className="text-[10px] capitalize opacity-80">{sev}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
