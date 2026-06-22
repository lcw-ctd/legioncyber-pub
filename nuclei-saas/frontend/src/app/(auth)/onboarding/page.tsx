'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check, Shield, Globe, Zap, CreditCard, ArrowRight, ArrowLeft, Clock, Repeat } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const steps = ['Choose Plan', 'Payment', 'Add Domain', 'First Scan']

interface Plan {
  id: string
  name: string
  price: string
  billing: string
  description: string
  features: string[]
  recommended?: boolean
  type: 'one_time' | 'subscription'
}

const plans: Plan[] = [
  {
    id: 'starter_onetime',
    name: 'Starter',
    price: '$199',
    billing: 'one-time',
    type: 'one_time',
    description: 'Perfect for single projects or initial assessments',
    features: ['5 domain scans', 'OWASP Top 10 scanning', 'PDF reports', 'Email support', '30-day access'],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: '$199',
    billing: '/month',
    type: 'subscription',
    description: 'For growing security teams and continuous monitoring',
    features: ['Unlimited scans', 'All scan types', 'Compliance reporting', 'Integrations', 'Priority support', 'API access'],
    recommended: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$599',
    billing: '/month',
    type: 'subscription',
    description: 'For large organizations with complex requirements',
    features: ['Everything in Pro', 'Custom templates', 'White-label reports', 'SLA guarantee', 'Dedicated CSM', 'On-premise option'],
  },
]

const domainSchema = z.object({
  domain: z.string().regex(/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/, 'Please enter a valid domain (e.g., example.com)'),
})

type DomainFormData = z.infer<typeof domainSchema>

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedPlan, setSelectedPlan] = useState<string>('professional')
  const [addedDomain, setAddedDomain] = useState<string>('')
  const [verificationMethod, setVerificationMethod] = useState<'dns' | 'http'>('dns')

  const { register, handleSubmit, formState: { errors } } = useForm<DomainFormData>({
    resolver: zodResolver(domainSchema),
  })

  const onDomainSubmit = (data: DomainFormData) => {
    setAddedDomain(data.domain)
    setCurrentStep(3)
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex flex-col">
      {/* Header */}
      <div className="border-b border-[#1e293b] px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-600/20 border border-blue-500/30 rounded-lg">
            <svg width="16" height="18" viewBox="0 0 32 36" fill="none">
              <path d="M16 0L0 7V18C0 27.39 6.84 36.18 16 36C25.16 36 32 27.39 32 18V7L16 0Z" fill="url(#sg3)" />
              <path d="M16 8L8 11.5V17C8 22.19 11.42 27.09 16 28C20.58 27.09 24 22.19 24 17V11.5L16 8Z" fill="white" opacity="0.9" />
              <defs>
                <linearGradient id="sg3" x1="0" y1="0" x2="32" y2="36" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#2563EB" /><stop offset="1" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="font-bold text-white">LegionCyber Shield</span>
        </div>
        <span className="text-slate-400 text-sm">Step {currentStep + 1} of {steps.length}</span>
      </div>

      {/* Progress */}
      <div className="px-8 py-6 max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-2 mb-8">
          {steps.map((step, index) => (
            <div key={step} className="flex items-center flex-1">
              <div className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold border-2 shrink-0',
                index < currentStep
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : index === currentStep
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-transparent border-[#1e293b] text-slate-500'
              )}>
                {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
              </div>
              <span className={cn(
                'ml-2 text-sm hidden sm:block',
                index === currentStep ? 'text-white font-medium' : 'text-slate-500'
              )}>{step}</span>
              {index < steps.length - 1 && (
                <div className={cn('flex-1 h-px mx-3', index < currentStep ? 'bg-emerald-600' : 'bg-[#1e293b]')} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Plan Selection */}
        {currentStep === 0 && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Choose your plan</h2>
            <p className="text-slate-400 mb-8">Start with a one-time scan or subscribe for continuous security monitoring</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={cn(
                    'relative bg-[#141929] border rounded-xl p-6 cursor-pointer transition-all',
                    selectedPlan === plan.id
                      ? 'border-blue-500 ring-2 ring-blue-500/20'
                      : 'border-[#1e293b] hover:border-[#2d3748]'
                  )}
                >
                  {plan.recommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">Most Popular</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-white">{plan.name}</h3>
                    <div className="flex items-center gap-1">
                      {plan.type === 'one_time' ? (
                        <Clock className="w-4 h-4 text-slate-400" />
                      ) : (
                        <Repeat className="w-4 h-4 text-blue-400" />
                      )}
                    </div>
                  </div>
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-white">{plan.price}</span>
                    <span className="text-slate-400 text-sm">{plan.billing}</span>
                  </div>
                  <p className="text-slate-400 text-sm mb-4">{plan.description}</p>
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-slate-300">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  {selectedPlan === plan.id && (
                    <div className="absolute top-4 right-4 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-8">
              <Button size="lg" onClick={() => setCurrentStep(1)} disabled={!selectedPlan}>
                Continue to Payment <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Payment */}
        {currentStep === 1 && (
          <div className="max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-white mb-2">Complete your purchase</h2>
            <p className="text-slate-400 mb-8">You&apos;ll be redirected to our secure payment processor</p>
            <div className="bg-[#141929] border border-[#1e293b] rounded-xl p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <CreditCard className="h-5 w-5 text-blue-400" />
                <h3 className="font-semibold text-white">Secure Checkout via Zoho</h3>
              </div>
              <p className="text-slate-400 text-sm mb-4">
                Your payment is processed securely through Zoho Payments. We never store your card details.
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> 256-bit SSL</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> PCI DSS Level 1</span>
              </div>
              <div className="bg-[#0f1421] border border-[#1e293b] rounded-lg p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Plan</span>
                  <span className="text-white">{plans.find(p => p.id === selectedPlan)?.name}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-slate-400">Billing</span>
                  <span className="text-white">{plans.find(p => p.id === selectedPlan)?.billing}</span>
                </div>
                <div className="border-t border-[#1e293b] mt-3 pt-3 flex justify-between">
                  <span className="font-semibold text-white">Total</span>
                  <span className="font-bold text-white">{plans.find(p => p.id === selectedPlan)?.price}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCurrentStep(0)}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
              <Button className="flex-1" size="lg" onClick={() => setCurrentStep(2)}>
                <CreditCard className="mr-2 h-4 w-4" />
                Proceed to Checkout
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Add Domain */}
        {currentStep === 2 && (
          <div className="max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-white mb-2">Add your first domain</h2>
            <p className="text-slate-400 mb-8">Tell us which domain you want to protect and verify ownership</p>
            <form onSubmit={handleSubmit(onDomainSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="domain">Domain name</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input id="domain" placeholder="example.com" className="pl-10" {...register('domain')} />
                </div>
                {errors.domain && <p className="text-xs text-rose-400">{errors.domain.message}</p>}
              </div>

              <div className="space-y-3">
                <Label>Verification method</Label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'dns', label: 'DNS TXT Record', desc: 'Add a TXT record to your DNS' },
                    { id: 'http', label: 'HTTP File', desc: 'Upload a file to your server' },
                  ].map((method) => (
                    <div
                      key={method.id}
                      onClick={() => setVerificationMethod(method.id as 'dns' | 'http')}
                      className={cn(
                        'bg-[#0f1421] border rounded-lg p-4 cursor-pointer transition-all',
                        verificationMethod === method.id ? 'border-blue-500' : 'border-[#1e293b]'
                      )}
                    >
                      <div className="font-medium text-white text-sm">{method.label}</div>
                      <div className="text-xs text-slate-400 mt-1">{method.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setCurrentStep(1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button type="submit" className="flex-1" size="lg">
                  Add Domain <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Step 4: First Scan */}
        {currentStep === 3 && (
          <div className="max-w-lg mx-auto text-center">
            <div className="flex items-center justify-center w-20 h-20 bg-emerald-600/20 border border-emerald-500/30 rounded-full mx-auto mb-6">
              <Check className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">You&apos;re all set!</h2>
            <p className="text-slate-400 mb-2">Domain <span className="text-blue-400">{addedDomain || 'example.com'}</span> added successfully.</p>
            <p className="text-slate-400 mb-8">Ready to run your first security scan?</p>
            <div className="bg-[#141929] border border-[#1e293b] rounded-xl p-6 text-left mb-6">
              <h3 className="font-semibold text-white mb-3">Recommended first scan: OWASP Top 10</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Tests for the 10 most critical web security risks</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Typical duration: 15-45 minutes</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Detailed remediation guidance included</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => window.location.href = '/dashboard'}>
                Go to Dashboard
              </Button>
              <Button className="flex-1" size="lg" onClick={() => window.location.href = '/scans/new'}>
                <Zap className="mr-2 h-4 w-4" />
                Run First Scan
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
