'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import type { ScanActivity } from '@/types'
import { format, parseISO } from 'date-fns'

interface ScanActivityChartProps {
  data: ScanActivity[]
}

interface TooltipProps {
  active?: boolean
  label?: string
  payload?: Array<{ name: string; value: number; color: string }>
}

const CustomTooltip = ({ active, label, payload }: TooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#141929] border border-[#1e293b] rounded-lg px-3 py-2 shadow-xl">
        <p className="text-slate-400 text-xs mb-2">{label}</p>
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-slate-300">{p.name}:</span>
            <span className="text-white font-medium">{p.value}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export function ScanActivityChart({ data }: ScanActivityChartProps) {
  const formattedData = data.map((d) => ({
    ...d,
    date: (() => {
      try { return format(parseISO(d.date), 'MMM d') } catch { return d.date }
    })(),
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={formattedData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="scansGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="discoveredGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="resolvedGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }}
          iconType="circle"
          iconSize={8}
        />
        <Area
          type="monotone"
          dataKey="scans"
          name="Scans"
          stroke="#2563EB"
          strokeWidth={2}
          fill="url(#scansGrad)"
        />
        <Area
          type="monotone"
          dataKey="findings_discovered"
          name="Discovered"
          stroke="#F43F5E"
          strokeWidth={2}
          fill="url(#discoveredGrad)"
        />
        <Area
          type="monotone"
          dataKey="findings_resolved"
          name="Resolved"
          stroke="#10B981"
          strokeWidth={2}
          fill="url(#resolvedGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
