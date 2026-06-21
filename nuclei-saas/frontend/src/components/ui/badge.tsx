import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-blue-600 text-white',
        secondary: 'border-transparent bg-[#1e293b] text-slate-300',
        outline: 'border-[#1e293b] text-slate-300',
        critical: 'border-purple-500/30 bg-purple-500/20 text-purple-300',
        high: 'border-rose-500/30 bg-rose-500/20 text-rose-300',
        medium: 'border-amber-500/30 bg-amber-500/20 text-amber-300',
        low: 'border-blue-500/30 bg-blue-500/20 text-blue-300',
        info: 'border-slate-500/30 bg-slate-500/20 text-slate-300',
        success: 'border-emerald-500/30 bg-emerald-500/20 text-emerald-300',
        destructive: 'border-rose-500/30 bg-rose-500/20 text-rose-300',
        warning: 'border-amber-500/30 bg-amber-500/20 text-amber-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
