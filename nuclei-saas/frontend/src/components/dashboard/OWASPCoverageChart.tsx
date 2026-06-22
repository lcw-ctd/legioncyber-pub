'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { OWASPCoverage } from '@/types'
import { getSeverityColor } from '@/lib/utils'

interface OWASPCoverageChartProps {
  data: OWASPCoverage[]
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: OWASPCoverage }>
}

const CustomTooltip = ({ active, payload }: TooltipProps) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload
    return (
      <div className="bg-[#141929] border border-[#1e293b] rounded-lg px-3 py-2 shadow-xl">
        <p className="text-white font-medium text-sm">{d.label}</p>
        <p className="text-slate-300 text-xs">{d.count} findings</p>
        <p className="text-xs capitalize mt-0.5" style={{ color: getSeverityColor(d.severity) }}>
          Highest: {d.severity}
        </p>
      </div>
    )
  }
  return null
}

const DEFAULT_OWASP: OWASPCoverage[] = [
  { category: 'A01', label: 'A01: Broken Access Control', count: 0, severity: 'info' },
  { category: 'A02', label: 'A02: Cryptographic Failures', count: 0, severity: 'info' },
  { category: 'A03', label: 'A03: Injection', count: 0, severity: 'info' },
  { category: 'A04', label: 'A04: Insecure Design', count: 0, severity: 'info' },
  { category: 'A05', label: 'A05: Security Misconfiguration', count: 0, severity: 'info' },
  { category: 'A06', label: 'A06: Vulnerable Components', count: 0, severity: 'info' },
  { category: 'A07', label: 'A07: Auth Failures', count: 0, severity: 'info' },
  { category: 'A08', label: 'A08: Data Integrity Failures', count: 0, severity: 'info' },
  { category: 'A09', label: 'A09: Logging Failures', count: 0, severity: 'info' },
  { category: 'A10', label: 'A10: SSRF', count: 0, severity: 'info' },
]

export function OWASPCoverageChart({ data }: OWASPCoverageChartProps) {
  const mergedData = DEFAULT_OWASP.map((d) => {
    const found = data.find((item) => item.category === d.category)
    return found || d
  })

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={mergedData}
        layout="vertical"
        margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
        barSize={12}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
        <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="category"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={30}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {mergedData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.count > 0 ? getSeverityColor(entry.severity) : '#1e293b'}
              fillOpacity={entry.count > 0 ? 0.85 : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
