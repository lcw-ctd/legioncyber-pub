'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Finding } from '@/types';
import { SeverityBadge } from '@/components/findings/SeverityBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Search, Filter, ChevronDown, ExternalLink, CheckCircle2,
  AlertOctagon, MoreHorizontal, RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { formatDate, timeAgo } from '@/lib/utils';

const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;
const STATUSES = ['open', 'in_progress', 'resolved', 'accepted_risk', 'false_positive'] as const;
const OWASP_CATS = ['A01','A02','A03','A04','A05','A06','A07','A08','A09','A10'];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    in_progress: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    resolved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    accepted_risk: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    false_positive: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  };
  const label = status.replace('_', ' ');
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs border capitalize font-medium ${map[status] ?? ''}`}>
      {label}
    </span>
  );
}

export default function FindingsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [owaspFilter, setOwaspFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const params = {
    search: search || undefined,
    severity: severityFilter.length ? severityFilter.join(',') : undefined,
    status: statusFilter.length ? statusFilter.join(',') : undefined,
    owasp_category: owaspFilter || undefined,
    skip: (page - 1) * pageSize,
    limit: pageSize,
  };

  const { data, isLoading } = useQuery<{ items: Finding[]; total: number }>({
    queryKey: ['findings', params],
    queryFn: () => api.get('/findings', { params }).then(r => r.data),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.put(`/findings/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['findings'] }),
  });

  const findings = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  function toggleSeverity(sev: string) {
    setSeverityFilter(prev =>
      prev.includes(sev) ? prev.filter(s => s !== sev) : [...prev, sev]
    );
    setPage(1);
  }

  function toggleStatus(st: string) {
    setStatusFilter(prev =>
      prev.includes(st) ? prev.filter(s => s !== st) : [...prev, st]
    );
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Findings</h1>
          <p className="text-slate-400 text-sm mt-0.5">{total.toLocaleString()} total findings across all scans</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search findings..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 bg-slate-800 border-slate-600"
              />
            </div>

            {/* Severity chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {SEVERITIES.map(sev => (
                <button
                  key={sev}
                  onClick={() => toggleSeverity(sev)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border capitalize transition-all ${
                    severityFilter.includes(sev)
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-400'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>

            {/* Status filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="border-slate-600 text-slate-300">
                  <Filter className="h-4 w-4 mr-1" />
                  Status {statusFilter.length > 0 && `(${statusFilter.length})`}
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-slate-800 border-slate-700">
                {STATUSES.map(st => (
                  <DropdownMenuItem
                    key={st}
                    onClick={() => toggleStatus(st)}
                    className={`capitalize cursor-pointer ${statusFilter.includes(st) ? 'text-blue-400' : 'text-slate-300'}`}
                  >
                    {statusFilter.includes(st) && <CheckCircle2 className="h-3.5 w-3.5 mr-2" />}
                    {st.replace('_', ' ')}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* OWASP filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="border-slate-600 text-slate-300">
                  OWASP {owaspFilter && `· ${owaspFilter}`}
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-slate-800 border-slate-700">
                <DropdownMenuItem
                  onClick={() => { setOwaspFilter(''); setPage(1); }}
                  className="text-slate-300 cursor-pointer"
                >
                  All categories
                </DropdownMenuItem>
                {OWASP_CATS.map(cat => (
                  <DropdownMenuItem
                    key={cat}
                    onClick={() => { setOwaspFilter(cat); setPage(1); }}
                    className={`cursor-pointer ${owaspFilter === cat ? 'text-blue-400' : 'text-slate-300'}`}
                  >
                    {cat}:2021
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-slate-900 border-slate-700">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700 hover:bg-transparent">
              <TableHead className="text-slate-400">Finding</TableHead>
              <TableHead className="text-slate-400 w-24">Severity</TableHead>
              <TableHead className="text-slate-400">Affected URL</TableHead>
              <TableHead className="text-slate-400 w-20">OWASP</TableHead>
              <TableHead className="text-slate-400 w-32">Status</TableHead>
              <TableHead className="text-slate-400 w-28">First Seen</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i} className="border-slate-700">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 bg-slate-800 rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : findings.length === 0 ? (
              <TableRow className="border-slate-700">
                <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                  No findings match your filters
                </TableCell>
              </TableRow>
            ) : (
              findings.map(finding => (
                <TableRow key={finding.id} className="border-slate-700 hover:bg-slate-800/50">
                  <TableCell>
                    <Link
                      href={`/findings/${finding.id}`}
                      className="text-white font-medium hover:text-blue-400 transition-colors line-clamp-1"
                    >
                      {finding.title}
                    </Link>
                    {finding.cve_ids?.length > 0 && (
                      <span className="ml-2 text-xs text-amber-400">{finding.cve_ids[0]}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <SeverityBadge severity={finding.severity} />
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <span className="text-slate-400 text-xs truncate block font-mono">
                      {finding.affected_url}
                    </span>
                  </TableCell>
                  <TableCell>
                    {finding.owasp_category && (
                      <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">
                        {finding.owasp_category}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={finding.status} />
                  </TableCell>
                  <TableCell className="text-slate-400 text-xs">
                    {timeAgo(finding.first_seen)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-slate-800 border-slate-700" align="end">
                        <DropdownMenuItem asChild className="text-slate-300 cursor-pointer">
                          <Link href={`/findings/${finding.id}`}>
                            <ExternalLink className="h-3.5 w-3.5 mr-2" /> View Details
                          </Link>
                        </DropdownMenuItem>
                        {finding.status !== 'resolved' && (
                          <DropdownMenuItem
                            onClick={() => updateStatus.mutate({ id: finding.id, status: 'resolved' })}
                            className="text-emerald-400 cursor-pointer"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Mark Resolved
                          </DropdownMenuItem>
                        )}
                        {finding.status !== 'false_positive' && (
                          <DropdownMenuItem
                            onClick={() => updateStatus.mutate({ id: finding.id, status: 'false_positive' })}
                            className="text-slate-400 cursor-pointer"
                          >
                            <AlertOctagon className="h-3.5 w-3.5 mr-2" /> False Positive
                          </DropdownMenuItem>
                        )}
                        {finding.status !== 'accepted_risk' && (
                          <DropdownMenuItem
                            onClick={() => updateStatus.mutate({ id: finding.id, status: 'accepted_risk' })}
                            className="text-slate-400 cursor-pointer"
                          >
                            Accept Risk
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
            <p className="text-sm text-slate-400">
              Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm"
                onClick={() => setPage(p => p - 1)}
                disabled={page === 1}
                className="border-slate-600"
              >
                Previous
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={page === totalPages}
                className="border-slate-600"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
