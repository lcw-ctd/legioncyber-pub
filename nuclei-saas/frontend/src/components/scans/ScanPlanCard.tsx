'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ScanType } from '@/types'

interface ScanPlan {
  type: ScanType
  label: string
  description: string
  features: string[]
  duration: string
  icon: string
  recommended?: boolean
}

const SCAN_PLANS: ScanPlan[] = [
  {
    type: 'owasp_top10',
    label: 'OWASP Top 10',
    description: 'Test against the 10 most critical web security risks',
    features: ['Injection flaws', 'Auth weaknesses', 'XSS vulnerabilities', 'Security misconfigs'],
    duration: '15-45 min',
    icon: '🔟',
    recommended: true,
  },
  {
    type: 'full_scan',
    label: 'Full Scan',
    description: 'Comprehensive scan using all available templates',
    features: ['All OWASP categories', 'CVE detection', 'Tech fingerprinting', 'Custom templates'],
    duration: '1-4 hours',
    icon: '🔍',
  },
  {
    type: 'api_scan',
    label: 'API Scan',
    description: 'Specialized scan for REST and GraphQL APIs',
    features: ['Auth bypass testing', 'IDOR detection', 'Rate limit testing', 'Schema analysis'],
    duration: '30-90 min',
    icon: '⚡',
  },
  {
    type: 'compliance',
    label: 'Compliance Scan',
    description: 'Scan mapped to compliance framework requirements',
    features: ['PCI DSS checks', 'HIPAA controls', 'SOC 2 evidence', 'Gap analysis'],
    duration: '45-120 min',
    icon: '📋',
  },
  {
    type: 'custom',
    label: 'Custom Scan',
    description: 'Select specific templates and categories',
    features: ['Template picker', 'Category filters', 'Severity filters', 'Tag-based selection'],
    duration: 'Varies',
    icon: '⚙️',
  },
]

interface ScanPlanCardProps {
  selected: ScanType | null
  onSelect: (type: ScanType) => void
}

export function ScanPlanCard({ selected, onSelect }: ScanPlanCardProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {SCAN_PLANS.map((plan) => (
        <div
          key={plan.type}
          onClick={() => onSelect(plan.type)}
          className={cn(
            'relative bg-[#141929] border rounded-xl p-5 cursor-pointer transition-all hover:border-[#2d3748]',
            selected === plan.type
              ? 'border-blue-500 ring-2 ring-blue-500/20'
              : 'border-[#1e293b]'
          )}
        >
          {plan.recommended && (
            <span className="absolute -top-2.5 left-4 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Recommended
            </span>
          )}
          <div className="flex items-start justify-between mb-3">
            <div>
              <span className="text-2xl">{plan.icon}</span>
              <h3 className="font-semibold text-white mt-1">{plan.label}</h3>
            </div>
            {selected === plan.type && (
              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
          <p className="text-sm text-slate-400 mb-3">{plan.description}</p>
          <ul className="space-y-1 mb-3">
            {plan.features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-xs text-slate-300">
                <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <div className="text-xs text-slate-500 border-t border-[#1e293b] pt-2 mt-2">
            Est. duration: <span className="text-slate-300">{plan.duration}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
