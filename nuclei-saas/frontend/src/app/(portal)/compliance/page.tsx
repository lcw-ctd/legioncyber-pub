'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ComplianceProfile } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SeverityBadge } from '@/components/findings/SeverityBadge';
import {
  Shield, CheckCircle2, XCircle, MinusCircle, Save,
  BarChart2, AlertTriangle, Info
} from 'lucide-react';

const FRAMEWORKS = [
  { id: 'pci_dss', label: 'PCI-DSS 4.0', desc: 'Payment Card Industry Data Security Standard', icon: '💳' },
  { id: 'hipaa', label: 'HIPAA', desc: 'Health Insurance Portability and Accountability Act', icon: '🏥' },
  { id: 'soc2', label: 'SOC 2', desc: 'Service Organization Control 2', icon: '🔐' },
  { id: 'iso27001', label: 'ISO 27001:2022', desc: 'Information Security Management Systems', icon: '📋' },
  { id: 'nist_csf', label: 'NIST CSF 2.0', desc: 'Cybersecurity Framework', icon: '🇺🇸' },
  { id: 'gdpr', label: 'GDPR', desc: 'General Data Protection Regulation', icon: '🇪🇺' },
  { id: 'cmmc', label: 'CMMC 2.0', desc: 'Cybersecurity Maturity Model Certification', icon: '⚔️' },
  { id: 'fedramp', label: 'FedRAMP', desc: 'Federal Risk and Authorization Management Program', icon: '🏛️' },
];

const INDUSTRY_VERTICALS = [
  'Financial Services', 'Healthcare', 'Retail / E-Commerce', 'Technology / SaaS',
  'Government / Public Sector', 'Education', 'Manufacturing', 'Energy / Utilities',
  'Legal', 'Other',
];

const RISK_TOLERANCES = [
  { value: 'low', label: 'Low — Report all findings, block on medium+' },
  { value: 'medium', label: 'Medium — Focus on high and critical' },
  { value: 'high', label: 'High — Critical findings only' },
];

function StatusIcon({ status }: { status: 'pass' | 'fail' | 'partial' | 'unknown' }) {
  if (status === 'pass') return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (status === 'fail') return <XCircle className="h-4 w-4 text-rose-400" />;
  if (status === 'partial') return <MinusCircle className="h-4 w-4 text-amber-400" />;
  return <Info className="h-4 w-4 text-slate-500" />;
}

export default function CompliancePage() {
  const qc = useQueryClient();
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>([]);
  const [industry, setIndustry] = useState('');
  const [riskTolerance, setRiskTolerance] = useState('medium');
  const [activeFramework, setActiveFramework] = useState('');
  const [saved, setSaved] = useState(false);

  const { data: profile } = useQuery<ComplianceProfile>({
    queryKey: ['compliance-profile'],
    queryFn: () => api.get('/compliance/profile').then(r => r.data),
    onSuccess: (data) => {
      if (data) {
        setSelectedFrameworks(data.frameworks ?? []);
        setIndustry(data.industry_vertical ?? '');
        setRiskTolerance(data.risk_tolerance ?? 'medium');
        if (!activeFramework && data.frameworks?.length) {
          setActiveFramework(data.frameworks[0]);
        }
      }
    },
  });

  const { data: gapsData } = useQuery<{ gaps: any[]; score: number }>({
    queryKey: ['compliance-gaps', activeFramework],
    queryFn: () => api.get('/compliance/gaps', { params: { framework: activeFramework } }).then(r => r.data),
    enabled: !!activeFramework,
  });

  const saveProfile = useMutation({
    mutationFn: () => api.put('/compliance/profile', {
      frameworks: selectedFrameworks,
      industry_vertical: industry,
      risk_tolerance: riskTolerance,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compliance-profile'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  function toggleFramework(id: string) {
    setSelectedFrameworks(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  }

  const gaps = gapsData?.gaps ?? [];
  const score = gapsData?.score ?? 0;
  const passing = gaps.filter(g => g.status === 'pass').length;
  const failing = gaps.filter(g => g.status === 'fail').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Compliance Center</h1>
          <p className="text-slate-400 text-sm mt-0.5">Map your security posture to regulatory frameworks</p>
        </div>
        <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
          <Save className="h-4 w-4 mr-1" />
          {saved ? 'Saved!' : saveProfile.isPending ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings panel */}
        <div className="space-y-5">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader><CardTitle className="text-base text-slate-200">Active Frameworks</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {FRAMEWORKS.map(fw => (
                <div key={fw.id} className="flex items-start gap-3">
                  <Checkbox
                    id={fw.id}
                    checked={selectedFrameworks.includes(fw.id)}
                    onCheckedChange={() => toggleFramework(fw.id)}
                    className="mt-0.5"
                  />
                  <Label htmlFor={fw.id} className="cursor-pointer flex-1">
                    <div className="flex items-center gap-2">
                      <span>{fw.icon}</span>
                      <span className="text-sm text-slate-200 font-medium">{fw.label}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{fw.desc}</p>
                  </Label>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardHeader><CardTitle className="text-base text-slate-200">Organization Profile</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-slate-400 text-xs mb-1 block">Industry Vertical</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger className="bg-slate-800 border-slate-600">
                    <SelectValue placeholder="Select industry..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {INDUSTRY_VERTICALS.map(v => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-400 text-xs mb-1 block">Risk Tolerance</Label>
                <div className="space-y-2">
                  {RISK_TOLERANCES.map(rt => (
                    <label
                      key={rt.value}
                      className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                        riskTolerance === rt.value
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <input
                        type="radio"
                        value={rt.value}
                        checked={riskTolerance === rt.value}
                        onChange={() => setRiskTolerance(rt.value)}
                        className="sr-only"
                      />
                      <div>
                        <p className="text-xs font-medium text-slate-200 capitalize">{rt.value}</p>
                        <p className="text-xs text-slate-500">{rt.label.split('—')[1]}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gap analysis */}
        <div className="lg:col-span-2 space-y-4">
          {selectedFrameworks.length === 0 ? (
            <Card className="bg-slate-900 border-slate-700 border-dashed">
              <CardContent className="flex flex-col items-center py-16 gap-3">
                <Shield className="h-10 w-10 text-slate-600" />
                <p className="text-slate-400 text-center">Select frameworks on the left to see your compliance posture</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Framework scores overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {selectedFrameworks.map(fwId => {
                  const fw = FRAMEWORKS.find(f => f.id === fwId);
                  const isActive = activeFramework === fwId;
                  return (
                    <button
                      key={fwId}
                      onClick={() => setActiveFramework(fwId)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        isActive
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      <p className="text-xs text-slate-400 mb-1">{fw?.icon} {fw?.label}</p>
                      <p className={`text-2xl font-bold ${
                        isActive && gapsData ? (score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-rose-400') : 'text-slate-300'
                      }`}>
                        {isActive && gapsData ? `${score}%` : '—'}
                      </p>
                    </button>
                  );
                })}
              </div>

              {activeFramework && gapsData && (
                <Card className="bg-slate-900 border-slate-700">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base text-slate-200">
                        {FRAMEWORKS.find(f => f.id === activeFramework)?.label} Gap Analysis
                      </CardTitle>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {passing} passing
                        </span>
                        <span className="text-rose-400 flex items-center gap-1">
                          <XCircle className="h-3.5 w-3.5" /> {failing} failing
                        </span>
                      </div>
                    </div>
                    <Progress value={score} className="h-2 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {gaps.map((gap: any) => (
                        <div
                          key={gap.requirement_id}
                          className={`p-3 rounded-lg border transition-all ${
                            gap.status === 'pass'
                              ? 'border-emerald-500/20 bg-emerald-500/5'
                              : gap.status === 'fail'
                              ? 'border-rose-500/20 bg-rose-500/5'
                              : 'border-slate-700 bg-slate-800/50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <StatusIcon status={gap.status} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-slate-400">{gap.requirement_id}</span>
                                <span className="text-sm font-medium text-slate-200 truncate">{gap.requirement_name}</span>
                              </div>
                              {gap.failing_findings?.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  {gap.failing_findings.slice(0, 3).map((f: any, i: number) => (
                                    <span key={i} className="text-xs text-slate-400 bg-slate-700 px-1.5 py-0.5 rounded">
                                      {f.title}
                                    </span>
                                  ))}
                                  {gap.failing_findings.length > 3 && (
                                    <span className="text-xs text-slate-500">+{gap.failing_findings.length - 3} more</span>
                                  )}
                                </div>
                              )}
                            </div>
                            {gap.status === 'fail' && gap.severity && (
                              <SeverityBadge severity={gap.severity} />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
