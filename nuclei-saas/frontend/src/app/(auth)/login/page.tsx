'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { Eye, EyeOff, Shield, Lock, Mail, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/hooks/useAuth'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const { loginMutation } = useAuth()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data)
  }

  return (
    <div className="bg-[#141929] border border-[#1e293b] rounded-2xl p-8 shadow-2xl shadow-black/50">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="flex items-center justify-center w-16 h-16 bg-blue-600/20 border border-blue-500/30 rounded-2xl mb-4">
          <svg width="32" height="36" viewBox="0 0 32 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M16 0L0 7V18C0 27.39 6.84 36.18 16 36C25.16 36 32 27.39 32 18V7L16 0Z"
              fill="url(#shieldGrad)"
            />
            <path
              d="M16 8L8 11.5V17C8 22.19 11.42 27.09 16 28C20.58 27.09 24 22.19 24 17V11.5L16 8Z"
              fill="white"
              opacity="0.9"
            />
            <defs>
              <linearGradient id="shieldGrad" x1="0" y1="0" x2="32" y2="36" gradientUnits="userSpaceOnUse">
                <stop stopColor="#2563EB" />
                <stop offset="1" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white">LegionCyber Shield</h1>
        <p className="text-slate-400 text-sm mt-1">Enterprise Web Application Security</p>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">Sign in to your account</h2>
        <p className="text-slate-400 text-sm mt-1">Protecting your digital perimeter</p>
      </div>

      {loginMutation.isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Invalid email or password. Please try again.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              className="pl-10"
              {...register('email')}
            />
          </div>
          {errors.email && (
            <p className="text-xs text-rose-400">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
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
          {errors.password && (
            <p className="text-xs text-rose-400">{errors.password.message}</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          loading={loginMutation.isPending}
        >
          <Shield className="mr-2 h-4 w-4" />
          Sign In Securely
        </Button>
      </form>

      <div className="mt-6 pt-6 border-t border-[#1e293b] text-center">
        <p className="text-slate-400 text-sm">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
            Start free trial
          </Link>
        </p>
      </div>

      {/* Security indicators */}
      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          256-bit SSL
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          SOC 2 Compliant
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          MFA Ready
        </span>
      </div>
    </div>
  )
}
