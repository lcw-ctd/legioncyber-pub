'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Finding, FindingComment } from '@/types';
import { SeverityBadge } from '@/components/findings/SeverityBadge';
import { EvidenceViewer } from '@/components/findings/EvidenceViewer';
import { RemediationSteps } from '@/components/findings/RemediationSteps';
import { ComplianceImpactBadges } from '@/components/findings/ComplianceImpactBadges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  ChevronLeft, ChevronDown, ExternalLink, Copy, Shield,
  AlertTriangle, CheckCircle2, Clock, User, MessageSquare
} from 'lucide-react';
import Link from 'next/link';
import { timeAgo, formatDate } from '@/lib/utils';

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open', color: 'text-rose-400' },
  { value: 'in_progress', label: 'In Progress', color: 'text-amber-400' },
  { value: 'resolved', label: 'Resolved', color: 'text-emerald-400' },
  { value: 'accepted_risk', label: 'Accept Risk', color: 'text-slate-400' },
  { value: 'false_positive', label: 'False Positive', color: 'text-blue-400' },
];

export default function FindingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [comment, setComment] = useState('');

  const { data: finding } = useQuery<Finding>({
    queryKey: ['finding', id],
    queryFn: () => api.get(`/findings/${id}`).then(r => r.data),
  });

  const { data: commentsData } = useQuery<{ items: FindingComment[] }>({
    queryKey: ['finding-comments', id],
    queryFn: () => api.get(`/findings/${id}/comments`).then(r => r.data),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => api.put(`/findings/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finding', id] }),
  });

  const addComment = useMutation({
    mutationFn: (text: string) => api.post(`/findings/${id}/comments`, { comment: text }),
    onSuccess: () => {
      setComment('');
      qc.invalidateQueries({ queryKey: ['finding-comments', id] });
    },
  });

  const comments = commentsData?.items ?? [];
  const currentStatus = STATUS_OPTIONS.find(s => s.value === finding?.status);

  if (!finding) {
    return <div className="animate-pulse space-y-4">{Array.from({length:6}).map((_,i) => <div key={i} className="h-24 bg-slate-800 rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link href="/findings" className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 mb-2 transition-colors">
          <ChevronLeft className="h-4 w-4" /> Back to Findings
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <SeverityBadge severity={finding.severity} size="lg" />
              {finding.cvss_score && (
                <span className="text-sm font-mono text-slate-300">CVSS {finding.cvss_score.toFixed(1)}</span>
              )}
              {finding.owasp_category && (
                <Badge variant="outline" className="border-slate-600 text-slate-300 text-xs">
                  {finding.owasp_category}:2021
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-semibold text-white">{finding.title}</h1>
            <p className="text-sm text-slate-400 font-mono break-all">{finding.affected_url}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className={`border-slate-600 ${currentStatus?.color}`}>
                {currentStatus?.label}
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-slate-800 border-slate-700" align="end">
              {STATUS_OPTIONS.map(opt => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => updateStatus.mutate(opt.value)}
                  className={`cursor-pointer ${opt.color}`}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="overview">
            <TabsList className="bg-slate-900 border border-slate-700">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="evidence">Evidence</TabsTrigger>
              <TabsTrigger value="remediation">Remediation</TabsTrigger>
              <TabsTrigger value="comments">
                Comments {comments.length > 0 && `(${comments.length})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-4">
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader><CardTitle className="text-base text-slate-200">Description</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-slate-300 leading-relaxed">{finding.description}</p>
                </CardContent>
              </Card>

              {finding.business_impact && (
                <Card className="bg-amber-500/5 border-amber-500/30">
                  <CardHeader><CardTitle className="text-base text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Business Impact
                  </CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-slate-300">{finding.business_impact}</p>
                  </CardContent>
                </Card>
              )}

              <ComplianceImpactBadges cweIds={finding.cwe_ids} owaspCategory={finding.owasp_category} />
            </TabsContent>

            <TabsContent value="evidence" className="mt-4">
              <EvidenceViewer finding={finding} />
            </TabsContent>

            <TabsContent value="remediation" className="mt-4">
              <RemediationSteps finding={finding} />
            </TabsContent>

            <TabsContent value="comments" className="mt-4 space-y-4">
              <Card className="bg-slate-900 border-slate-700">
                <CardContent className="pt-4 space-y-4">
                  {comments.length === 0 && (
                    <p className="text-slate-500 text-sm text-center py-4">No comments yet</p>
                  )}
                  {comments.map((c, i) => (
                    <div key={c.id}>
                      {i > 0 && <Separator className="bg-slate-700" />}
                      <div className="flex gap-3 pt-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-blue-600 text-xs text-white">
                            {c.user_name?.charAt(0) ?? 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-slate-200">{c.user_name ?? 'User'}</span>
                            <span className="text-xs text-slate-500">{timeAgo(c.created_at)}</span>
                          </div>
                          <p className="text-sm text-slate-300">{c.comment}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-700">
                <CardContent className="pt-4">
                  <Textarea
                    placeholder="Add a comment..."
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    className="bg-slate-800 border-slate-600 resize-none"
                    rows={3}
                  />
                  <div className="flex justify-end mt-2">
                    <Button
                      size="sm"
                      onClick={() => addComment.mutate(comment)}
                      disabled={!comment.trim() || addComment.isPending}
                    >
                      <MessageSquare className="h-4 w-4 mr-1" />
                      {addComment.isPending ? 'Posting...' : 'Post Comment'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar metadata */}
        <div className="space-y-4">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader><CardTitle className="text-sm text-slate-400 uppercase tracking-wider">Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                { label: 'Template', value: finding.template_id },
                { label: 'First Seen', value: formatDate(finding.first_seen) },
                { label: 'Last Seen', value: formatDate(finding.last_seen) },
                { label: 'Parameter', value: finding.affected_parameter || '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-slate-500 text-xs mb-0.5">{label}</p>
                  <p className="text-slate-300 font-mono text-xs break-all">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {(finding.cve_ids?.length > 0 || finding.cwe_ids?.length > 0) && (
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader><CardTitle className="text-sm text-slate-400 uppercase tracking-wider">References</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {finding.cve_ids?.map(cve => (
                  <a
                    key={cve}
                    href={`https://nvd.nist.gov/vuln/detail/${cve}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
                  >
                    <ExternalLink className="h-3 w-3" /> {cve}
                  </a>
                ))}
                {finding.cwe_ids?.map(cwe => (
                  <a
                    key={cwe}
                    href={`https://cwe.mitre.org/data/definitions/${cwe}.html`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
                  >
                    <ExternalLink className="h-3 w-3" /> CWE-{cwe}
                  </a>
                ))}
                {finding.references?.map((ref, i) => (
                  <a
                    key={i}
                    href={ref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 truncate"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate">{ref}</span>
                  </a>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
