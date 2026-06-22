'use client'

import { useDashboard } from '@/hooks/useDashboard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { SecurityPostureGauge } from '@/components/dashboard/SecurityPostureGauge'
import { FindingsBySeverityChart } from '@/components/dashboard/FindingsBySeverityChart'
import { FindingsByStatusChart } from '@/components/dashboard/FindingsByStatusChart'
import { OWASPCoverageChart } from '@/components/dashboard/OWASPCoverageChart'
import { ScanActivityChart } from '@/components/dashboard/ScanActivityChart'
import { BusinessImpactMatrix } from '@/components/dashboard/BusinessImpactMatrix'
import { ComplianceOverviewCards } from '@/components/dashboard/ComplianceOverviewCards'
import { RecentFindingsTable } from '@/components/dashboard/RecentFindingsTable'
import { TopVulnerableAssets } from '@/components/dashboard/TopVulnerableAssets'
import { RemediationProgress } from '@/components/dashboard/RemediationProgress'
import { AlertTriangle, Radar, Globe, ShieldCheck } from 'lucide-react'
import type { DashboardSummary, Severity, FindingStatus } from '@/types'

const MOCK_DATA: DashboardSummary = {
  security_posture_score: 68,
  security_posture_trend: 5,
  total_findings: 142,
  findings_by_severity: { critical: 8, high: 24, medium: 57, low: 38, info: 15 },
  findings_by_status: { open: 67, in_progress: 18, resolved: 45, accepted: 7, false_positive: 5 },
  active_scans: 2,
  total_scans: 48,
  domains_count: 6,
  verified_domains: 5,
  owasp_coverage: [
    { category: 'A01', label: 'A01: Broken Access Control', count: 18, severity: 'critical' },
    { category: 'A02', label: 'A02: Cryptographic Failures', count: 12, severity: 'high' },
    { category: 'A03', label: 'A03: Injection', count: 9, severity: 'high' },
    { category: 'A05', label: 'A05: Security Misconfiguration', count: 23, severity: 'medium' },
    { category: 'A06', label: 'A06: Vulnerable Components', count: 31, severity: 'medium' },
  ],
  recent_findings: [],
  top_vulnerable_assets: [
    { domain: 'api.example.com', url: 'api.example.com/graphql', finding_count: 18, highest_severity: 'critical', risk_score: 9.2 },
    { domain: 'app.example.com', url: 'app.example.com/admin', finding_count: 12, highest_severity: 'high', risk_score: 7.8 },
    { domain: 'legacy.example.com', url: 'legacy.example.com', finding_count: 9, highest_severity: 'high', risk_score: 7.1 },
    { domain: 'shop.example.com', url: 'shop.example.com/checkout', finding_count: 7, highest_severity: 'medium', risk_score: 5.4 },
    { domain: 'cdn.example.com', url: 'cdn.example.com', finding_count: 3, highest_severity: 'low', risk_score: 2.1 },
  ],
  remediation_progress: {
    total: 142,
    resolved: 45,
    by_severity: {
      critical: { total: 8, resolved: 1 },
      high: { total: 24, resolved: 6 },
      medium: { total: 57, resolved: 22 },
      low: { total: 38, resolved: 16 },
      info: { total: 15, resolved: 0 },
    },
  },
  scan_activity: Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    return {
      date: d.toISOString(),
      scans: Math.floor(Math.random() * 4) + 1,
      findings_discovered: Math.floor(Math.random() * 15),
      findings_resolved: Math.floor(Math.random() * 8),
    }
  }),
  compliance_overview: [
    { framework: 'pci_dss', score: 72, passing: 36, total: 50 },
    { framework: 'soc2', score: 81, passing: 65, total: 80 },
    { framework: 'hipaa', score: 64, passing: 45, total: 70 },
    { framework: 'nist_csf', score: 58, passing: 58, total: 100 },
  ],
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-[#141929] border border-[#1e293b] rounded-xl p-4 flex items-center gap-4">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg" style={{ backgroundColor: `${color}20`, border: `1px solid ${color}40` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-slate-400">{label}</p>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { data, isLoading } = useDashboard()
  const dashboard = data || MOCK_DATA

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <div className="grid grid-cols-12 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="col-span-4 h-64" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Findings" value={dashboard.total_findings} icon={AlertTriangle} color="#F43F5E" />
        <StatCard label="Active Scans" value={dashboard.active_scans} icon={Radar} color="#2563EB" />
        <StatCard label="Verified Domains" value={`${dashboard.verified_domains}/${dashboard.domains_count}`} icon={Globe} color="#10B981" />
        <StatCard label="Critical Issues" value={dashboard.findings_by_severity.critical} icon={ShieldCheck} color="#8B5CF6" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Security Posture Score */}
        <Card className="col-span-12 lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Security Posture Score</CardTitle>
            <CardDescription>Overall security health rating</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <SecurityPostureGauge
              score={dashboard.security_posture_score}
              trend={dashboard.security_posture_trend}
            />
          </CardContent>
        </Card>

        {/* Findings by Severity */}
        <Card className="col-span-12 sm:col-span-6 lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Findings by Severity</CardTitle>
            <CardDescription>Distribution of all open findings</CardDescription>
          </CardHeader>
          <CardContent>
            <FindingsBySeverityChart data={dashboard.findings_by_severity} />
          </CardContent>
        </Card>

        {/* Findings by Status */}
        <Card className="col-span-12 sm:col-span-6 lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Findings by Status</CardTitle>
            <CardDescription>Remediation workflow status</CardDescription>
          </CardHeader>
          <CardContent>
            <FindingsByStatusChart data={dashboard.findings_by_status} />
          </CardContent>
        </Card>

        {/* Scan Activity */}
        <Card className="col-span-12 lg:col-span-8">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Scan Activity (14 days)</CardTitle>
            <CardDescription>Scans run and findings discovered over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ScanActivityChart data={dashboard.scan_activity} />
          </CardContent>
        </Card>

        {/* OWASP Coverage */}
        <Card className="col-span-12 lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">OWASP Top 10 Coverage</CardTitle>
            <CardDescription>Findings by OWASP category</CardDescription>
          </CardHeader>
          <CardContent>
            <OWASPCoverageChart data={dashboard.owasp_coverage} />
          </CardContent>
        </Card>

        {/* Business Impact Matrix */}
        <Card className="col-span-12 sm:col-span-6 lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Business Impact Matrix</CardTitle>
            <CardDescription>Likelihood vs. impact risk plot</CardDescription>
          </CardHeader>
          <CardContent>
            <BusinessImpactMatrix findings={dashboard.recent_findings} />
          </CardContent>
        </Card>

        {/* Compliance Overview */}
        <Card className="col-span-12 sm:col-span-6 lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Compliance Overview</CardTitle>
            <CardDescription>Active framework compliance scores</CardDescription>
          </CardHeader>
          <CardContent>
            <ComplianceOverviewCards data={dashboard.compliance_overview} />
          </CardContent>
        </Card>

        {/* Remediation Progress */}
        <Card className="col-span-12 sm:col-span-6 lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Remediation Progress</CardTitle>
            <CardDescription>Resolution rate by severity</CardDescription>
          </CardHeader>
          <CardContent>
            <RemediationProgress data={dashboard.remediation_progress} />
          </CardContent>
        </Card>

        {/* Recent Findings */}
        <Card className="col-span-12 lg:col-span-8">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Critical & High Findings</CardTitle>
            <CardDescription>Latest findings requiring immediate attention</CardDescription>
          </CardHeader>
          <CardContent>
            <RecentFindingsTable findings={dashboard.recent_findings} />
          </CardContent>
        </Card>

        {/* Top Vulnerable Assets */}
        <Card className="col-span-12 sm:col-span-6 lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Vulnerable Assets</CardTitle>
            <CardDescription>Assets with the most findings</CardDescription>
          </CardHeader>
          <CardContent>
            <TopVulnerableAssets assets={dashboard.top_vulnerable_assets} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
