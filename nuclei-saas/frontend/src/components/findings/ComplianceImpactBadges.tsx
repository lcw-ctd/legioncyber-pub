import type { ComplianceImpact } from '@/types'
import { getFrameworkLabel, getSeverityColor } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface ComplianceImpactBadgesProps {
  impacts: ComplianceImpact[]
}

export function ComplianceImpactBadges({ impacts }: ComplianceImpactBadgesProps) {
  if (!impacts || impacts.length === 0) {
    return <p className="text-sm text-slate-500">No compliance frameworks affected</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {impacts.map((impact) => {
        const color = getSeverityColor(impact.severity)
        return (
          <Tooltip key={impact.framework}>
            <TooltipTrigger asChild>
              <div
                className="px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-default"
                style={{
                  backgroundColor: `${color}15`,
                  borderColor: `${color}40`,
                  color: color,
                }}
              >
                {getFrameworkLabel(impact.framework)}
                <span className="ml-1.5 opacity-60">({impact.requirements.length})</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              <p className="font-semibold mb-1">{getFrameworkLabel(impact.framework)}</p>
              <p className="text-slate-400 text-xs mb-1">Affected requirements:</p>
              <ul className="text-xs space-y-0.5">
                {impact.requirements.map((r) => (
                  <li key={r} className="text-slate-300">{r}</li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
