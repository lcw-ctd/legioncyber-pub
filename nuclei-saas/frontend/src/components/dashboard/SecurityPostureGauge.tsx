'use client'

import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { getScoreColor } from '@/lib/utils'

interface SecurityPostureGaugeProps {
  score: number
  trend: number
}

export function SecurityPostureGauge({ score, trend }: SecurityPostureGaugeProps) {
  const color = getScoreColor(score)
  const data = [{ value: score, fill: color }]

  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'At Risk' : 'Critical'

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="65%"
            outerRadius="90%"
            startAngle={225}
            endAngle={-45}
            data={[{ value: 100, fill: '#1e293b' }, { value: score, fill: color }]}
          >
            <RadialBar dataKey="value" cornerRadius={8} background={false} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-white">{score}</span>
          <span className="text-xs text-slate-400 mt-0.5">/ 100</span>
          <span className="text-sm font-medium mt-1" style={{ color }}>{label}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-2">
        {trend > 0 ? (
          <TrendingUp className="h-4 w-4 text-emerald-400" />
        ) : trend < 0 ? (
          <TrendingDown className="h-4 w-4 text-rose-400" />
        ) : (
          <Minus className="h-4 w-4 text-slate-400" />
        )}
        <span className={`text-sm font-medium ${trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
          {trend > 0 ? '+' : ''}{trend} points this month
        </span>
      </div>
    </div>
  )
}
