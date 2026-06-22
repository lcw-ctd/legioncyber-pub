'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { Report, Scan } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  FileText, Download, Plus, RefreshCw, Clock, CheckCircle2, AlertCircle
} from 'lucide-react';
import { formatDate, timeAgo } from '@/lib/utils';

function ReportStatusBadge({ status }: { status: string }) {
  if (status === 'ready') return (
    <span className="flex items-center gap-1.5 text-xs text-emerald-400">
      <CheckCircle2 className="h-3.5 w-3.5" /> Ready
    </span>
  );
  if (status === 'generating') return (
    <span className="flex items-center gap-1.5 text-xs text-amber-400">
      <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Generating
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 text-xs text-rose-400">
      <AlertCircle className="h-3.5 w-3.5" /> Failed
    </span>
  );
}

const REPORT_TYPES = [
  { value: 'executive', label: 'Executive Summary', desc: 'High-level overview for leadership' },
  { value: 'technical', label: 'Technical Report', desc: 'Full findings with evidence and remediation' },
  { value: 'compliance', label: 'Compliance Report', desc: 'Mapped to regulatory frameworks' },
  { value: 'remediation', label: 'Remediation Plan', desc: 'Prioritized action roadmap' },
];

export default function ReportsPage() {
  const qc = useQueryClient();
  const [genOpen, setGenOpen] = useState(false);
  const [selectedScan, setSelectedScan] = useState('');
  const [reportType, setReportType] = useState('executive');
  const [format, setFormat] = useState('pdf');

  const { data: reportsData, isLoading } = useQuery<{ items: Report[] }>({
    queryKey: ['reports'],
    queryFn: () => api.get('/reports').then(r => r.data),
    refetchInterval: (query) => {
      const hasGenerating = query.state.data?.items.some(r => r.status === 'generating');
      return hasGenerating ? 5000 : false;
    },
  });

  const { data: scansData } = useQuery<{ items: Scan[] }>({
    queryKey: ['scans-completed'],
    queryFn: () => api.get('/scans', { params: { status: 'completed', limit: 50 } }).then(r => r.data),
    enabled: genOpen,
  });

  const generateReport = useMutation({
    mutationFn: () => api.post('/reports', {
      scan_id: selectedScan || undefined,
      report_type: reportType,
      format,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] });
      setGenOpen(false);
    },
  });

  async function downloadReport(report: Report) {
    const response = await api.get(`/reports/${report.id}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.name}.${report.format}`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  const reports = reportsData?.items ?? [];
  const scans = scansData?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Reports</h1>
          <p className="text-slate-400 text-sm mt-0.5">Generate and download security assessment reports</p>
        </div>
        <Dialog open={genOpen} onOpenChange={setGenOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Generate Report</Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">Generate Report</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-slate-300 mb-2 block">Report Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {REPORT_TYPES.map(rt => (
                    <button
                      key={rt.value}
                      onClick={() => setReportType(rt.value)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        reportType === rt.value
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-slate-600 hover:border-slate-500'
                      }`}
                    >
                      <p className="text-sm font-medium text-slate-200">{rt.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{rt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-slate-300 mb-1 block">Scan (optional)</Label>
                <Select value={selectedScan} onValueChange={setSelectedScan}>
                  <SelectTrigger className="bg-slate-800 border-slate-600">
                    <SelectValue placeholder="All scans (org-wide)" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="">All scans (org-wide)</SelectItem>
                    {scans.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-slate-300 mb-2 block">Format</Label>
                <div className="flex gap-2">
                  {['pdf', 'html', 'json'].map(f => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={`px-3 py-1.5 rounded text-sm uppercase font-mono border transition-all ${
                        format === f
                          ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                          : 'border-slate-600 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => generateReport.mutate()}
                disabled={generateReport.isPending}
              >
                {generateReport.isPending ? 'Queuing...' : 'Generate Report'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-slate-900 border-slate-700">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700 hover:bg-transparent">
              <TableHead className="text-slate-400">Report</TableHead>
              <TableHead className="text-slate-400 w-28">Type</TableHead>
              <TableHead className="text-slate-400 w-16">Format</TableHead>
              <TableHead className="text-slate-400 w-24">Status</TableHead>
              <TableHead className="text-slate-400 w-32">Generated</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i} className="border-slate-700">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 bg-slate-800 rounded animate-pulse" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : reports.length === 0 ? (
              <TableRow className="border-slate-700">
                <TableCell colSpan={6} className="text-center py-12">
                  <FileText className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-500">No reports generated yet</p>
                </TableCell>
              </TableRow>
            ) : (
              reports.map(report => (
                <TableRow key={report.id} className="border-slate-700 hover:bg-slate-800/50">
                  <TableCell className="text-white font-medium">{report.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-slate-600 text-slate-300 capitalize text-xs">
                      {report.report_type.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-mono text-slate-400 uppercase">{report.format}</span>
                  </TableCell>
                  <TableCell>
                    <ReportStatusBadge status={report.status} />
                  </TableCell>
                  <TableCell className="text-slate-400 text-xs">
                    {report.generated_at ? timeAgo(report.generated_at) : '—'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadReport(report)}
                      disabled={report.status !== 'ready'}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
