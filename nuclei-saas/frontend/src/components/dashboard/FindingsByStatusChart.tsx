'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { FindingStatus } from '@/types'
import { getStatusColor } from '@/lib/utils'

interface FindingsByStatusChartProps {
  data: Record<FindingStatus, number>
}

const STATUS_LABELS: Record<FindingStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  accepted: 'Accepted',
  false_positive: 'False Pos.',
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: { name: string } }>
}

const CustomTooltip = ({ active, payload }: TooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#141929] border border-[#1e293b] rounded-lg px-3 py-2 shadow-xl">
        <p className="text-white font-medium">{payload[0].payload.name}</p>
        <p className="text-slate-300 text-sm">{payload[0].value} findings</p>
      </div>
    )
  }
  return null
}

export function FindingsByStatusChart({ data }: FindingsByStatusChartProps) {
  const statuses: FindingStatus[] = ['open', 'in_progress', 'resolved', 'accepted', 'false_positive']

  const chartData = statuses.map((s) => ({
    name: STATUS_LABELS[s],
    value: data[s] || 0,
    color: getStatusColor(s),
    status: s,
  }))

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={28}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
