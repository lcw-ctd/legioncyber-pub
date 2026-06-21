import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import type { Severity, FindingStatus, ComplianceFramework } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string, formatStr = 'MMM d, yyyy'): string {
  try {
    return format(parseISO(dateString), formatStr)
  } catch {
    return dateString
  }
}

export function formatDateRelative(dateString: string): string {
  try {
    return formatDistanceToNow(parseISO(dateString), { addSuffix: true })
  } catch {
    return dateString
  }
}

export function formatDateTime(dateString: string): string {
  try {
    return format(parseISO(dateString), 'MMM d, yyyy HH:mm:ss')
  } catch {
    return dateString
  }
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

export function formatSeverity(severity: Severity): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1)
}

export function getSeverityColor(severity: Severity): string {
  const colors: Record<Severity, string> = {
    critical: '#8B5CF6',
    high: '#F43F5E',
    medium: '#F59E0B',
    low: '#2563EB',
    info: '#64748B',
  }
  return colors[severity] || colors.info
}

export function getSeverityBgClass(severity: Severity): string {
  const classes: Record<Severity, string> = {
    critical: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    high: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    medium: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    low: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    info: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  }
  return classes[severity] || classes.info
}

export function getStatusColor(status: FindingStatus): string {
  const colors: Record<FindingStatus, string> = {
    open: '#F43F5E',
    in_progress: '#F59E0B',
    resolved: '#10B981',
    accepted: '#8B5CF6',
    false_positive: '#64748B',
  }
  return colors[status] || colors.open
}

export function getStatusBgClass(status: FindingStatus): string {
  const classes: Record<FindingStatus, string> = {
    open: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    in_progress: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    resolved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    accepted: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    false_positive: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  }
  return classes[status] || classes.open
}

export function getCVSSColor(score: number): string {
  if (score >= 9.0) return '#8B5CF6'
  if (score >= 7.0) return '#F43F5E'
  if (score >= 4.0) return '#F59E0B'
  if (score >= 0.1) return '#2563EB'
  return '#64748B'
}

export function getCVSSLabel(score: number): string {
  if (score >= 9.0) return 'Critical'
  if (score >= 7.0) return 'High'
  if (score >= 4.0) return 'Medium'
  if (score >= 0.1) return 'Low'
  return 'None'
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function getFrameworkLabel(framework: ComplianceFramework): string {
  const labels: Record<ComplianceFramework, string> = {
    pci_dss: 'PCI DSS',
    hipaa: 'HIPAA',
    soc2: 'SOC 2',
    iso27001: 'ISO 27001',
    nist_csf: 'NIST CSF',
    gdpr: 'GDPR',
    cmmc: 'CMMC',
    fedramp: 'FedRAMP',
  }
  return labels[framework] || framework
}

export function getScoreColor(score: number): string {
  if (score >= 80) return '#10B981'
  if (score >= 60) return '#F59E0B'
  if (score >= 40) return '#F43F5E'
  return '#8B5CF6'
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function generateVerificationToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let token = 'legioncyber-verify-'
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}
