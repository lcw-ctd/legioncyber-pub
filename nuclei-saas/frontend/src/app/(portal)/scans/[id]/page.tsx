'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDate, timeAgo } from '@/lib/utils';
import { ScanStatusBadge } from '@/components/scans/ScanStatusBadge';
import { ScanProgress } from '@/components/scans/ScanProgress';
import { SeverityBadge } from '@/components/findings/SeverityBadge';
import { FindingCard } from '@/components/findings/FindingCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Shield, Clock, Globe, AlertTriangle, CheckCircle2,
  XCircle, RefreshCw, Download, StopCircle, ChevronLeft
} from 'lucide-react';
import Link from 'next/link';
import { Scan, Finding } from '@/types';

export default function ScanDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: scan, refetch } = useQuery<Scan>({
    queryKey: ['scan', id],
    queryFn: () => api.get(`/scans/${id}`).then(r => r.data),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'running' || status === 'queued' ? 3000 : false;
    },
  });

  const { data: findingsData } = useQuery<{ items: Finding[]; total: number }>({
    queryKey: ['scan-findings', id],
    queryFn: () => api.get(`/scans/${id}/findings`, { params: { limit: 100 } }).then(r => r.data),
    refetchInterval: scan?.status === 'running' ? 5000 : false,
    enabled: !!scan,
  });

  const findings = findingsData?.items ?? [];

  const counts = findings.reduce(
    (acc, f) => { acc[f.severity] = (acc[f.severity] ?? 0) + 1; return acc; },
    {} as Record<string, number>
  );

  const canCancel = scan?.status === 'running' || scan?.status === 'queued';

  async function cancelScan() {
    await api.post(`/scans/${id}/cancel`);
    refetch();
  }

  if (!scan) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link
            href="/scans"
            className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Back to Scans
          </Link>
          <h1 className="text-2xl font-semibold text-white">{scan.name}</h1>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <Globe className="h-4 w-4" />
            <span>{scan.target_urls?.[0]}</span>
            <span>·</span>
            <span>Started {scan.started_at ? timeAgo(scan.started_at) : 'queued'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canCancel && (
            <Button variant="outline" size="sm" onClick={cancelScan} className="text-rose-400 border-rose-400/30">
              <StopCircle className="h-4 w-4 mr-1" /> Cancel
            </Button>
          )}
          {scan.status === 'completed' && (
            <Button size="sm" asChild>
              <Link href={`/reports?scan=${id}`}>
                <Download className="h-4 w-4 mr-1" /> Export Report
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Status + progress */}
      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Status</p>
              <ScanStatusBadge status={scan.status} />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Mode</p>
              <Badge variant="outline" className="capitalize">{scan.scan_mode}</Badge>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Duration</p>
              <p className="text-white font-medium">
                {scan.completed_at && scan.started_at
                  ? `${Math.round((new Date(scan.completed_at).getTime() - new Date(scan.started_at).getTime()) / 60000)}m`
                  : scan.started_at ? timeAgo(scan.started_at) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Findings</p>
              <p className="text-white font-medium">{findings.length}</p>
            </div>
          </div>

          {(scan.status === 'running' || scan.status === 'queued') && (
            <div className="mt-4">
              <ScanProgress status={scan.status} startedAt={scan.started_at} />
            </div>
          )}

          {scan.error_message && (
            <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
              {scan.error_message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Severity summary */}
      {findings.length > 0 && (
        <div className="grid grid-cols-5 gap-3">
          {(['critical', 'high', 'medium', 'low', 'info'] as const).map(sev => (
            <Card key={sev} className="bg-slate-900 border-slate-700">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-2xl font-bold text-white">{counts[sev] ?? 0}</p>
                <SeverityBadge severity={sev} className="mt-1" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Findings tabs */}
      <Tabs defaultValue="all">
        <TabsList className="bg-slate-900 border border-slate-700">
          <TabsTrigger value="all">All ({findings.length})</TabsTrigger>
          {(['critical', 'high', 'medium', 'low'] as const).map(sev => (
            counts[sev] ? (
              <TabsTrigger key={sev} value={sev} className="capitalize">
                {sev} ({counts[sev]})
              </TabsTrigger>
            ) : null
          ))}
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-3">
          {findings.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              {scan.status === 'running' ? (
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
                  <p>Scan in progress — findings will appear here as they are discovered</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  <p>No findings — target passed all checks</p>
                </div>
              )}
            </div>
          ) : (
            findings.map(f => <FindingCard key={f.id} finding={f} />)
          )}
        </TabsContent>

        {(['critical', 'high', 'medium', 'low'] as const).map(sev => (
          <TabsContent key={sev} value={sev} className="mt-4 space-y-3">
            {findings.filter(f => f.severity === sev).map(f => (
              <FindingCard key={f.id} finding={f} />
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
