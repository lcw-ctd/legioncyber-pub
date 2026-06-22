'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import type { Severity } from '@/types'
import { getSeverityColor, formatSeverity } from '@/lib/utils'

interface FindingsBySeverityChartProps {
  data: Record<Severity, number>
}

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info']

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: { color: string } }>
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#141929] border border-[#1e293b] rounded-lg px-3 py-2 shadow-xl">
        <p className="text-white font-medium">{payload[0].name}</p>
        <p className="text-slate-300 text-sm">{payload[0].value} findings</p>
      </div>
    )
  }
  return null
}

export function FindingsBySeverityChart({ data }: FindingsBySeverityChartProps) {
  const chartData = SEVERITIES.map((s) => ({
    name: formatSeverity(s),
    value: data[s] || 0,
    color: getSeverityColor(s),
  })).filter((d) => d.value > 0)

  const total = Object.values(data).reduce((a, b) => a + b, 0)

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
        No findings to display
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-white">{total}</span>
          <span className="text-xs text-slate-400">Total</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-2 w-full">
        {SEVERITIES.map((s) => (
          <div key={s} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getSeverityColor(s) }} />
            <span className="text-xs text-slate-400 capitalize">{s}</span>
            <span className="text-xs font-semibold text-white ml-auto">{data[s] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
