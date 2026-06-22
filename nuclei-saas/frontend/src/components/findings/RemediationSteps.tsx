'use client'

import { CheckCircle2, Circle } from 'lucide-react'
import { useState } from 'react'

interface RemediationStepsProps {
  steps: string[]
}

export function RemediationSteps({ steps }: RemediationStepsProps) {
  const [completed, setCompleted] = useState<Set<number>>(new Set())

  const toggleStep = (index: number) => {
    setCompleted((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  if (!steps || steps.length === 0) {
    return <p className="text-sm text-slate-400">No remediation steps available.</p>
  }

  return (
    <div className="space-y-3">
      {steps.map((step, index) => (
        <div
          key={index}
          className="flex items-start gap-3 group cursor-pointer"
          onClick={() => toggleStep(index)}
        >
          <div className="mt-0.5 shrink-0">
            {completed.has(index) ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : (
              <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-[#1e293b] bg-[#0f1421] text-xs font-bold text-slate-400 group-hover:border-blue-500 transition-colors">
                {index + 1}
              </div>
            )}
          </div>
          <p className={`text-sm leading-relaxed ${completed.has(index) ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
            {step}
          </p>
        </div>
      ))}
      {completed.size > 0 && (
        <p className="text-xs text-slate-500 mt-2">
          {completed.size} of {steps.length} steps completed
        </p>
      )}
    </div>
  )
}
