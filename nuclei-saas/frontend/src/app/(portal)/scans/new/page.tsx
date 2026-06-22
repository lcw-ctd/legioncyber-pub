'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check, ArrowLeft, ArrowRight, Zap, Globe, Settings, Calendar, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ScanPlanCard } from '@/components/scans/ScanPlanCard'
import { useCreateScan } from '@/hooks/useScans'
import { cn } from '@/lib/utils'
import type { ScanType, ScanMode } from '@/types'

const STEPS = [
  { label: 'Domain', icon: Globe },
  { label: 'Scan Type', icon: Zap },
  { label: 'Options', icon: Settings },
  { label: 'Schedule', icon: Calendar },
  { label: 'Review', icon: Eye },
]

const MOCK_DOMAINS = [
  { id: 'd1', domain: 'app.example.com', verified: true },
  { id: 'd2', domain: 'api.example.com', verified: true },
  { id: 'd3', domain: 'shop.example.com', verified: true },
  { id: 'd4', domain: 'legacy.example.com', verified: false },
]

const MOCK_CREDENTIALS = [
  { id: 'c1', name: 'App Admin Account', type: 'form_login' },
  { id: 'c2', name: 'API Bearer Token', type: 'bearer' },
  { id: 'c3', name: 'Basic Auth Staging', type: 'basic' },
]

const configSchema = z.object({
  domain_id: z.string().min(1, 'Select a domain'),
  scan_type: z.string().min(1, 'Select a scan type'),
  scan_mode: z.enum(['blackbox', 'graybox', 'whitebox']),
  rate_limit: z.number().min(1).max(1000),
  max_depth: z.number().min(1).max(20),
  credential_id: z.string().optional(),
  schedule_enabled: z.boolean(),
  schedule_cron: z.string().optional(),
})

type ConfigFormData = z.infer<typeof configSchema>

const SCAN_TYPE_LABELS: Record<string, string> = {
  owasp_top10: 'OWASP Top 10', full_scan: 'Full Scan', api_scan: 'API Scan',
  compliance: 'Compliance', custom: 'Custom',
}

export default function NewScanPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [selectedType, setSelectedType] = useState<ScanType | null>(null)
  const createScan = useCreateScan()

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ConfigFormData>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      scan_mode: 'blackbox',
      rate_limit: 150,
      max_depth: 5,
      schedule_enabled: false,
    },
  })

  const watchedValues = watch()
  const selectedDomain = MOCK_DOMAINS.find((d) => d.id === watchedValues.domain_id)
  const needsCredentials = watchedValues.scan_mode !== 'blackbox'

  const onSubmit = (data: ConfigFormData) => {
    if (!selectedType) return
    createScan.mutate({
      domain_id: data.domain_id,
      scan_type: selectedType,
      scan_mode: data.scan_mode,
      scan_config: {
        rate_limit: data.rate_limit,
        max_depth: data.max_depth,
        scan_mode: data.scan_mode,
        credential_id: data.credential_id,
        schedule: data.schedule_enabled ? { enabled: true, cron: data.schedule_cron || '0 0 * * *', timezone: 'UTC' } : undefined,
      },
    }, {
      onSuccess: (scan) => { router.push(`/scans/${scan.id}`) },
    })
  }

  const canProceed = [
    !!watchedValues.domain_id,
    !!selectedType,
    true,
    true,
    true,
  ][step]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="flex items-center flex-1">
              <div className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                i === step ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30' :
                i < step ? 'text-emerald-400' : 'text-slate-500'
              )}>
                {i < step ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                <span className="hidden sm:block">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn('flex-1 h-px mx-2', i < step ? 'bg-emerald-500/50' : 'bg-[#1e293b]')} />
              )}
            </div>
          )
        })}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Step 0: Select Domain */}
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Select Domain</CardTitle>
              <CardDescription>Choose a verified domain to scan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {MOCK_DOMAINS.map((domain) => (
                <div
                  key={domain.id}
                  onClick={() => domain.verified && setValue('domain_id', domain.id)}
                  className={cn(
                    'flex items-center gap-3 p-4 border rounded-xl transition-all',
                    !domain.verified ? 'opacity-50 cursor-not-allowed border-[#1e293b]' :
                    watchedValues.domain_id === domain.id ? 'border-blue-500 bg-blue-600/10 cursor-pointer' :
                    'border-[#1e293b] hover:border-[#2d3748] cursor-pointer'
                  )}
                >
                  <Globe className="w-5 h-5 text-slate-400 shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-white">{domain.domain}</div>
                    <div className={`text-xs ${domain.verified ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {domain.verified ? 'Verified' : 'Not verified — please verify first'}
                    </div>
                  </div>
                  {watchedValues.domain_id === domain.id && (
                    <Check className="w-5 h-5 text-blue-400" />
                  )}
                </div>
              ))}
              {errors.domain_id && <p className="text-xs text-rose-400">{errors.domain_id.message}</p>}
            </CardContent>
          </Card>
        )}

        {/* Step 1: Scan Type */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Select Scan Type</h2>
              <p className="text-slate-400 text-sm">Choose what kind of security assessment to run</p>
            </div>
            <ScanPlanCard selected={selectedType} onSelect={(t) => setSelectedType(t)} />
          </div>
        )}

        {/* Step 2: Options */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Scan Configuration</CardTitle>
              <CardDescription>Configure scan parameters and authentication mode</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rate_limit">Rate Limit (req/sec)</Label>
                  <Input
                    id="rate_limit"
                    type="number"
                    min={1} max={1000}
                    {...register('rate_limit', { valueAsNumber: true })}
                  />
                  <p className="text-xs text-slate-500">Max requests per second (default: 150)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_depth">Max Crawl Depth</Label>
                  <Input
                    id="max_depth"
                    type="number"
                    min={1} max={20}
                    {...register('max_depth', { valueAsNumber: true })}
                  />
                  <p className="text-xs text-slate-500">Link depth to follow (default: 5)</p>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Scan Mode</Label>
                <div className="grid grid-cols-3 gap-3">
                  {(['blackbox', 'graybox', 'whitebox'] as ScanMode[]).map((mode) => (
                    <div
                      key={mode}
                      onClick={() => setValue('scan_mode', mode)}
                      className={cn(
                        'p-3 border rounded-lg cursor-pointer transition-all text-center',
                        watchedValues.scan_mode === mode ? 'border-blue-500 bg-blue-600/10' : 'border-[#1e293b] hover:border-[#2d3748]'
                      )}
                    >
                      <div className="font-medium text-white capitalize">{mode}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        {mode === 'blackbox' ? 'No credentials' : mode === 'graybox' ? 'With credentials' : 'Full access'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {needsCredentials && (
                <div className="space-y-2">
                  <Label>Credentials (optional)</Label>
                  <Select value={watchedValues.credential_id} onValueChange={(v) => setValue('credential_id', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select stored credentials..." />
                    </SelectTrigger>
                    <SelectContent>
                      {MOCK_CREDENTIALS.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} <span className="text-slate-500 ml-2 capitalize">({c.type})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Schedule */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Schedule</CardTitle>
              <CardDescription>Run once now or set up recurring scans</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-[#0f1421] border border-[#1e293b] rounded-xl">
                <div>
                  <p className="font-medium text-white">Enable Recurring Scan</p>
                  <p className="text-sm text-slate-400">Automatically run this scan on a schedule</p>
                </div>
                <Switch
                  checked={watchedValues.schedule_enabled}
                  onCheckedChange={(checked) => setValue('schedule_enabled', checked)}
                />
              </div>

              {watchedValues.schedule_enabled && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Cron Schedule</Label>
                    <Input
                      placeholder="0 0 * * * (daily at midnight)"
                      {...register('schedule_cron')}
                    />
                    <p className="text-xs text-slate-500">Standard cron expression (UTC timezone)</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { label: 'Daily', cron: '0 0 * * *' },
                      { label: 'Weekly', cron: '0 0 * * 0' },
                      { label: 'Monthly', cron: '0 0 1 * *' },
                      { label: 'Hourly', cron: '0 * * * *' },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setValue('schedule_cron', preset.cron)}
                        className="p-2 border border-[#1e293b] hover:border-blue-500 rounded-lg text-xs text-slate-300 hover:text-white transition-all"
                      >
                        {preset.label}
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{preset.cron}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!watchedValues.schedule_enabled && (
                <div className="flex items-center gap-3 p-4 bg-blue-600/10 border border-blue-500/30 rounded-xl">
                  <Zap className="w-5 h-5 text-blue-400 shrink-0" />
                  <p className="text-sm text-blue-300">Scan will start immediately when you click Launch</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Review & Launch</CardTitle>
              <CardDescription>Confirm your scan configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Domain', value: selectedDomain?.domain || '—' },
                    { label: 'Scan Type', value: selectedType ? SCAN_TYPE_LABELS[selectedType] : '—' },
                    { label: 'Scan Mode', value: watchedValues.scan_mode || '—' },
                    { label: 'Rate Limit', value: `${watchedValues.rate_limit} req/s` },
                    { label: 'Max Depth', value: watchedValues.max_depth?.toString() || '—' },
                    { label: 'Schedule', value: watchedValues.schedule_enabled ? watchedValues.schedule_cron || 'Enabled' : 'Run once' },
                  ].map((item) => (
                    <div key={item.label} className="bg-[#0f1421] border border-[#1e293b] rounded-lg p-3">
                      <div className="text-xs text-slate-500 mb-1">{item.label}</div>
                      <div className="font-medium text-white capitalize">{item.value}</div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <Settings className="w-4 h-4 text-amber-400 shrink-0" />
                  <p className="text-sm text-amber-300">
                    Scanning will send real HTTP requests to the target. Ensure you have authorization to scan this domain.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => step === 0 ? router.push('/scans') : setStep(step - 1)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={() => setStep(step + 1)} disabled={!canProceed}>
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" loading={createScan.isPending} size="lg">
              <Zap className="mr-2 h-4 w-4" />
              {watchedValues.schedule_enabled ? 'Save Schedule' : 'Launch Scan'}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
