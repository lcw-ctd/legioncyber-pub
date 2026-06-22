'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { Eye, EyeOff, Shield, User, Mail, Lock, Building2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useAuth } from '@/hooks/useAuth'

const registerSchema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
  company_name: z.string().min(2, 'Company name is required'),
  agree_to_terms: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the terms of service',
  }),
})

type RegisterFormData = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false)
  const { registerMutation } = useAuth()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { agree_to_terms: false },
  })

  const password = watch('password', '')
  const agreeToTerms = watch('agree_to_terms')

  const passwordStrength = () => {
    if (!password) return 0
    let score = 0
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++
    return score
  }

  const strengthColors = ['bg-rose-500', 'bg-rose-400', 'bg-amber-400', 'bg-emerald-400', 'bg-emerald-500']
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const strength = passwordStrength()

  const onSubmit = (data: RegisterFormData) => {
    registerMutation.mutate(data)
  }

  return (
    <div className="bg-[#141929] border border-[#1e293b] rounded-2xl p-8 shadow-2xl shadow-black/50">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 bg-blue-600/20 border border-blue-500/30 rounded-xl">
          <svg width="20" height="22" viewBox="0 0 32 36" fill="none">
            <path d="M16 0L0 7V18C0 27.39 6.84 36.18 16 36C25.16 36 32 27.39 32 18V7L16 0Z" fill="url(#sg2)" />
            <path d="M16 8L8 11.5V17C8 22.19 11.42 27.09 16 28C20.58 27.09 24 22.19 24 17V11.5L16 8Z" fill="white" opacity="0.9" />
            <defs>
              <linearGradient id="sg2" x1="0" y1="0" x2="32" y2="36" gradientUnits="userSpaceOnUse">
                <stop stopColor="#2563EB" /><stop offset="1" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div>
          <div className="font-bold text-white text-lg leading-tight">LegionCyber Shield</div>
          <div className="text-xs text-slate-400">Create your account</div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">Start your free trial</h2>
        <p className="text-slate-400 text-sm mt-1">14 days free, no credit card required</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2 col-span-2">
            <Label htmlFor="full_name">Full name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input id="full_name" placeholder="John Smith" className="pl-10" {...register('full_name')} />
            </div>
            {errors.full_name && <p className="text-xs text-rose-400">{errors.full_name.message}</p>}
          </div>

          <div className="space-y-2 col-span-2">
            <Label htmlFor="company_name">Company name</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input id="company_name" placeholder="Acme Corp" className="pl-10" {...register('company_name')} />
            </div>
            {errors.company_name && <p className="text-xs text-rose-400">{errors.company_name.message}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input id="email" type="email" placeholder="you@company.com" className="pl-10" {...register('email')} />
          </div>
          {errors.email && <p className="text-xs text-rose-400">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create strong password"
              className="pl-10 pr-10"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {password && (
            <div className="space-y-1.5">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      strength >= i ? strengthColors[strength] : 'bg-[#1e293b]'
                    }`}
                  />
                ))}
              </div>
              {strength > 0 && (
                <p className={`text-xs ${strength >= 3 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {strengthLabels[strength]} password
                </p>
              )}
            </div>
          )}
          {errors.password && <p className="text-xs text-rose-400">{errors.password.message}</p>}
        </div>

        <div className="flex items-start gap-3 pt-2">
          <Checkbox
            id="terms"
            checked={agreeToTerms}
            onCheckedChange={(checked) => setValue('agree_to_terms', checked === true)}
          />
          <label htmlFor="terms" className="text-sm text-slate-400 leading-relaxed cursor-pointer">
            I agree to the{' '}
            <Link href="/terms" className="text-blue-400 hover:text-blue-300">Terms of Service</Link>
            {' '}and{' '}
            <Link href="/privacy" className="text-blue-400 hover:text-blue-300">Privacy Policy</Link>
          </label>
        </div>
        {errors.agree_to_terms && <p className="text-xs text-rose-400">{errors.agree_to_terms.message}</p>}

        <Button type="submit" className="w-full" size="lg" loading={registerMutation.isPending}>
          <Shield className="mr-2 h-4 w-4" />
          Create Account
        </Button>
      </form>

      <div className="mt-4 flex flex-col gap-2">
        {['No credit card required', 'Cancel anytime', 'SOC 2 Type II certified'].map((item) => (
          <div key={item} className="flex items-center gap-2 text-xs text-slate-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            {item}
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-[#1e293b] text-center">
        <p className="text-slate-400 text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
