'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useScans } from '@/hooks/useScans'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ScanStatusBadge } from '@/components/scans/ScanStatusBadge'
import { ScanProgress } from '@/components/scans/ScanProgress'
import { Plus, Search, Radar, Clock, Shield } from 'lucide-react'
import { formatDate, formatDuration } from '@/lib/utils'
import type { Scan, ScanStatus, ScanType } from '@/types'

const SCAN_TYPE_LABELS: Record<ScanType, string> = {
  owasp_top10: 'OWASP Top 10',
  full_scan: 'Full Scan',
  api_scan: 'API Scan',
  compliance: 'Compliance',
  custom: 'Custom',
}

// Mock data for demo
const MOCK_SCANS: Scan[] = [
  {
    id: '1', organization_id: 'org1', domain_id: 'd1', domain: 'app.example.com',
    status: 'running', scan_type: 'owasp_top10', scan_mode: 'blackbox', progress: 67,
    started_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 26 * 60 * 1000).toISOString(), created_by: 'user1',
    finding_counts: { critical: 2, high: 5, medium: 11, low: 8, info: 3, total: 29 },
    templates_run: 450, templates_matched: 29, scan_config: { rate_limit: 150, max_depth: 5, scan_mode: 'blackbox' },
  },
  {
    id: '2', organization_id: 'org1', domain_id: 'd2', domain: 'api.example.com',
    status: 'completed', scan_type: 'full_scan', scan_mode: 'graybox', progress: 100,
    started_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    completed_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), created_by: 'user1',
    finding_counts: { critical: 1, high: 8, medium: 22, low: 15, info: 7, total: 53 },
    templates_run: 1200, templates_matched: 53, duration_seconds: 7200,
    scan_config: { rate_limit: 100, max_depth: 8, scan_mode: 'graybox' },
  },
  {
    id: '3', organization_id: 'org1', domain_id: 'd3', domain: 'shop.example.com',
    status: 'failed', scan_type: 'api_scan', scan_mode: 'blackbox', progress: 23,
    started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), created_by: 'user2',
    finding_counts: { critical: 0, high: 2, medium: 3, low: 0, info: 1, total: 6 },
    templates_run: 200, templates_matched: 6, error_message: 'Connection timeout after 3 retries',
    scan_config: { rate_limit: 50, max_depth: 3, scan_mode: 'blackbox' },
  },
  {
    id: '4', organization_id: 'org1', domain_id: 'd1', domain: 'app.example.com',
    status: 'completed', scan_type: 'compliance', scan_mode: 'blackbox', progress: 100,
    started_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    completed_at: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), created_by: 'user1',
    finding_counts: { critical: 3, high: 11, medium: 18, low: 9, info: 4, total: 45 },
    templates_run: 800, templates_matched: 45, duration_seconds: 5400,
    scan_config: { rate_limit: 100, max_depth: 5, scan_mode: 'blackbox' },
  },
]

export default function ScansPage() {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const { data, isLoading } = useScans({ status: statusFilter !== 'all' ? statusFilter : undefined })

  const scans = data?.data || MOCK_SCANS
  const filtered = scans.filter((s) => {
    if (search && !s.domain.includes(search)) return false
    return true
  })

  const stats = {
    total: scans.length,
    running: scans.filter((s) => s.status === 'running').length,
    completed: scans.filter((s) => s.status === 'completed').length,
    failed: scans.filter((s) => s.status === 'failed').length,
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Scans', value: stats.total, color: '#2563EB', icon: Radar },
          { label: 'Running', value: stats.running, color: '#06B6D4', icon: Clock },
          { label: 'Completed', value: stats.completed, color: '#10B981', icon: Shield },
          { label: 'Failed', value: stats.failed, color: '#F43F5E', icon: Shield },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#141929] border border-[#1e293b] rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${stat.color}20`, border: `1px solid ${stat.color}40` }}>
              <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-slate-400">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters + New Scan */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-3 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by domain..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => router.push('/scans/new')}>
          <Plus className="mr-2 h-4 w-4" /> New Scan
        </Button>
      </div>

      {/* Scans table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status / Progress</TableHead>
                  <TableHead>Findings</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((scan) => (
                  <TableRow key={scan.id} className="cursor-pointer" onClick={() => router.push(`/scans/${scan.id}`)}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-white">{scan.domain}</div>
                        <div className="text-xs text-slate-500 capitalize">{scan.scan_mode} mode</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-300">{SCAN_TYPE_LABELS[scan.scan_type]}</span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1.5 min-w-[160px]">
                        <ScanStatusBadge status={scan.status} />
                        {scan.status === 'running' && (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${scan.progress}%` }} />
                            </div>
                            <span className="text-xs text-slate-400">{scan.progress}%</span>
                          </div>
                        )}
                        {scan.status === 'failed' && scan.error_message && (
                          <p className="text-xs text-rose-400 truncate max-w-[200px]">{scan.error_message}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 text-xs">
                        {scan.finding_counts.critical > 0 && <span className="text-purple-300 font-semibold">{scan.finding_counts.critical}C</span>}
                        {scan.finding_counts.high > 0 && <span className="text-rose-300 font-semibold">{scan.finding_counts.high}H</span>}
                        {scan.finding_counts.medium > 0 && <span className="text-amber-300">{scan.finding_counts.medium}M</span>}
                        {scan.finding_counts.low > 0 && <span className="text-blue-300">{scan.finding_counts.low}L</span>}
                        {scan.finding_counts.total === 0 && <span className="text-slate-500">—</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-400">
                        {scan.started_at ? formatDate(scan.started_at, 'MMM d, HH:mm') : '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-400">
                        {scan.duration_seconds ? formatDuration(scan.duration_seconds) : scan.status === 'running' ? 'In progress' : '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); router.push(`/scans/${scan.id}`) }}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500 py-12">
                      No scans found. <button onClick={() => router.push('/scans/new')} className="text-blue-400 hover:underline">Run your first scan</button>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
