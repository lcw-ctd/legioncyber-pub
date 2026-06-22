'use client'

import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from 'recharts'
import type { Finding } from '@/types'
import { getSeverityColor } from '@/lib/utils'

interface BusinessImpactMatrixProps {
  findings: Finding[]
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: { name: string; severity: string; x: number; y: number } }>
}

const CustomTooltip = ({ active, payload }: TooltipProps) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload
    return (
      <div className="bg-[#141929] border border-[#1e293b] rounded-lg px-3 py-2 shadow-xl max-w-48">
        <p className="text-white text-sm font-medium truncate">{d.name}</p>
        <p className="text-xs capitalize mt-0.5" style={{ color: getSeverityColor(d.severity as 'critical' | 'high' | 'medium' | 'low' | 'info') }}>
          {d.severity}
        </p>
        <div className="text-xs text-slate-400 mt-1">
          <span>Likelihood: {d.x}/10</span> · <span>Impact: {d.y}/10</span>
        </div>
      </div>
    )
  }
  return null
}

export function BusinessImpactMatrix({ findings }: BusinessImpactMatrixProps) {
  const severityToLikelihood: Record<string, number> = {
    critical: 9, high: 7, medium: 5, low: 3, info: 1,
  }
  const severityToImpact: Record<string, number> = {
    critical: 9, high: 7, medium: 5, low: 3, info: 1,
  }

  const scatterData = findings.slice(0, 30).map((f) => ({
    x: severityToLikelihood[f.severity] + Math.random() * 1.5 - 0.75,
    y: severityToImpact[f.severity] + Math.random() * 1.5 - 0.75,
    name: f.name,
    severity: f.severity,
    z: 80,
    fill: getSeverityColor(f.severity),
  }))

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={200}>
        <ScatterChart margin={{ top: 4, right: 4, bottom: 4, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, 10]}
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            label={{ value: 'Likelihood', position: 'insideBottom', offset: -2, style: { fill: '#64748b', fontSize: 10 } }}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[0, 10]}
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            label={{ value: 'Impact', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 10 } }}
          />
          <ZAxis dataKey="z" range={[40, 80]} />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#1e293b' }} />
          <Scatter data={scatterData} shape={(props: { cx?: number; cy?: number; payload?: { fill: string } }) => {
            const { cx = 0, cy = 0, payload } = props
            return <circle cx={cx} cy={cy} r={5} fill={payload?.fill || '#64748b'} fillOpacity={0.8} stroke="transparent" />
          }} />
        </ScatterChart>
      </ResponsiveContainer>
      {/* Quadrant labels */}
      <div className="absolute top-2 right-6 text-[10px] text-rose-400 font-medium">Critical Zone</div>
      <div className="absolute top-2 left-6 text-[10px] text-amber-400 font-medium">Monitor</div>
    </div>
  )
}
