// Organization types
export interface Organization {
  id: string
  name: string
  slug: string
  plan: BillingPlan
  industry: string
  created_at: string
  updated_at: string
  scan_credits_remaining: number
  max_domains: number
  max_users: number
  features: string[]
}

// User types
export interface User {
  id: string
  email: string
  full_name: string
  role: 'owner' | 'admin' | 'analyst' | 'viewer'
  organization_id: string
  created_at: string
  last_login: string
  avatar_url?: string
  mfa_enabled: boolean
}

// Auth types
export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

// Domain types
export interface Domain {
  id: string
  organization_id: string
  domain: string
  verified: boolean
  verification_method: 'dns_txt' | 'http_file'
  verification_token: string
  verification_status: 'pending' | 'verified' | 'failed'
  created_at: string
  updated_at: string
  last_scanned?: string
  scan_count: number
  finding_count: number
  credentials?: Credential[]
}

export interface Credential {
  id: string
  domain_id: string
  name: string
  type: 'basic' | 'bearer' | 'cookie' | 'api_key' | 'form_login'
  created_at: string
}

// Scan types
export type ScanStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
export type ScanType = 'owasp_top10' | 'full_scan' | 'api_scan' | 'compliance' | 'custom'
export type ScanMode = 'blackbox' | 'graybox' | 'whitebox'

export interface Scan {
  id: string
  organization_id: string
  domain_id: string
  domain: string
  status: ScanStatus
  scan_type: ScanType
  scan_mode: ScanMode
  progress: number
  started_at?: string
  completed_at?: string
  created_at: string
  created_by: string
  finding_counts: {
    critical: number
    high: number
    medium: number
    low: number
    info: number
    total: number
  }
  duration_seconds?: number
  templates_run: number
  templates_matched: number
  scan_config: ScanConfig
  error_message?: string
}

export interface ScanConfig {
  rate_limit: number
  max_depth: number
  scan_mode: ScanMode
  credential_id?: string
  schedule?: ScanSchedule
  selected_templates?: string[]
  owasp_categories?: string[]
}

export interface ScanSchedule {
  enabled: boolean
  cron: string
  timezone: string
  next_run?: string
}

// Finding types
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type FindingStatus = 'open' | 'in_progress' | 'resolved' | 'accepted' | 'false_positive'

export interface Finding {
  id: string
  scan_id: string
  organization_id: string
  template_id: string
  template_name: string
  severity: Severity
  status: FindingStatus
  name: string
  description: string
  affected_url: string
  affected_parameter?: string
  owasp_category: string
  cwe_id?: string
  cve_id?: string
  cvss_score?: number
  cvss_vector?: string
  business_impact: string
  remediation: string[]
  evidence: FindingEvidence
  compliance_impact: ComplianceImpact[]
  first_seen: string
  last_seen: string
  resolved_at?: string
  assigned_to?: string
  tags: string[]
  false_positive_reason?: string
  risk_accepted_reason?: string
  comments?: FindingComment[]
}

export interface FindingEvidence {
  request?: string
  response?: string
  curl_command?: string
  matched_at?: string
  extracted_results?: string[]
  ip?: string
  timestamp: string
}

export interface FindingComment {
  id: string
  finding_id: string
  user_id: string
  user_name: string
  content: string
  created_at: string
}

export interface ComplianceImpact {
  framework: ComplianceFramework
  requirements: string[]
  severity: 'critical' | 'high' | 'medium' | 'low'
}

// Report types
export type ReportFormat = 'pdf' | 'html' | 'json' | 'csv' | 'docx'
export type ReportStatus = 'generating' | 'ready' | 'failed'

export interface Report {
  id: string
  organization_id: string
  scan_id?: string
  name: string
  format: ReportFormat
  status: ReportStatus
  created_at: string
  completed_at?: string
  download_url?: string
  finding_count: number
  report_type: 'scan' | 'executive' | 'compliance' | 'remediation'
}

// Compliance types
export type ComplianceFramework = 'pci_dss' | 'hipaa' | 'soc2' | 'iso27001' | 'nist_csf' | 'gdpr' | 'cmmc' | 'fedramp'

export interface ComplianceProfile {
  id: string
  organization_id: string
  framework: ComplianceFramework
  enabled: boolean
  score: number
  last_assessed: string
  requirements: ComplianceRequirement[]
  industry_vertical: string
  risk_tolerance: 'low' | 'medium' | 'high'
}

export interface ComplianceRequirement {
  id: string
  requirement_id: string
  title: string
  description: string
  status: 'pass' | 'fail' | 'partial' | 'not_applicable'
  failing_findings: string[]
  evidence?: string
}

// Integration types
export type IntegrationType = 'vanta' | 'cloudflare' | 'akamai' | 'imperva' | 'slack' | 'jira' | 'pagerduty' | 'webhook'

export interface Integration {
  id: string
  organization_id: string
  type: IntegrationType
  name: string
  enabled: boolean
  connected: boolean
  config: Record<string, string>
  created_at: string
  last_sync?: string
}

// Billing types
export type BillingPlan = 'starter' | 'professional' | 'enterprise' | 'custom'
export type BillingCycle = 'monthly' | 'annual' | 'one_time'

export interface Subscription {
  id: string
  organization_id: string
  plan: BillingPlan
  billing_cycle: BillingCycle
  status: 'active' | 'past_due' | 'cancelled' | 'trialing'
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  amount: number
  currency: string
}

export interface Invoice {
  id: string
  organization_id: string
  amount: number
  currency: string
  status: 'paid' | 'pending' | 'failed'
  created_at: string
  paid_at?: string
  pdf_url?: string
  description: string
}

// Dashboard types
export interface DashboardSummary {
  security_posture_score: number
  security_posture_trend: number
  total_findings: number
  findings_by_severity: Record<Severity, number>
  findings_by_status: Record<FindingStatus, number>
  active_scans: number
  total_scans: number
  domains_count: number
  verified_domains: number
  owasp_coverage: OWASPCoverage[]
  recent_findings: Finding[]
  top_vulnerable_assets: VulnerableAsset[]
  remediation_progress: RemediationProgress
  scan_activity: ScanActivity[]
  compliance_overview: ComplianceOverview[]
}

export interface OWASPCoverage {
  category: string
  label: string
  count: number
  severity: Severity
}

export interface VulnerableAsset {
  domain: string
  url: string
  finding_count: number
  highest_severity: Severity
  risk_score: number
}

export interface RemediationProgress {
  total: number
  resolved: number
  by_severity: Record<Severity, { total: number; resolved: number }>
}

export interface ScanActivity {
  date: string
  scans: number
  findings_discovered: number
  findings_resolved: number
}

export interface ComplianceOverview {
  framework: ComplianceFramework
  score: number
  passing: number
  total: number
}

// API Response types
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ApiError {
  message: string
  code: string
  details?: Record<string, string[]>
}

// Chart data types
export interface ChartDataPoint {
  name: string
  value: number
  color?: string
}

export interface TimeSeriesDataPoint {
  date: string
  [key: string]: string | number
}
