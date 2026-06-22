'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, Radar, AlertTriangle, Globe, FileText,
  Shield, Plug, CreditCard, Settings, LogOut, ChevronLeft,
  ChevronRight, Building2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui'
import { useAuthStore } from '@/store/auth'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/scans', icon: Radar, label: 'Scans' },
  { href: '/findings', icon: AlertTriangle, label: 'Findings' },
  { href: '/domains', icon: Globe, label: 'Domains' },
  { href: '/reports', icon: FileText, label: 'Reports' },
  { href: '/compliance', icon: Shield, label: 'Compliance' },
  { href: '/integrations', icon: Plug, label: 'Integrations' },
  { href: '/billing', icon: CreditCard, label: 'Billing' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const { user, organization, logout } = useAuthStore()

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'LC'

  return (
    <aside
      className={cn(
        'flex flex-col bg-[#0d1220] border-r border-[#1e293b] transition-all duration-300 shrink-0',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className={cn('flex items-center h-16 px-4 border-b border-[#1e293b]', sidebarCollapsed ? 'justify-center' : 'gap-3')}>
        <div className="flex items-center justify-center w-8 h-8 bg-blue-600/20 border border-blue-500/30 rounded-lg shrink-0">
          <svg width="16" height="18" viewBox="0 0 32 36" fill="none">
            <path d="M16 0L0 7V18C0 27.39 6.84 36.18 16 36C25.16 36 32 27.39 32 18V7L16 0Z" fill="url(#sgNav)" />
            <path d="M16 8L8 11.5V17C8 22.19 11.42 27.09 16 28C20.58 27.09 24 22.19 24 17V11.5L16 8Z" fill="white" opacity="0.9" />
            <defs>
              <linearGradient id="sgNav" x1="0" y1="0" x2="32" y2="36" gradientUnits="userSpaceOnUse">
                <stop stopColor="#2563EB" /><stop offset="1" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <div className="font-bold text-white text-sm leading-tight truncate">LegionCyber Shield</div>
            <div className="text-xs text-slate-500 truncate">{organization?.name || 'Security Platform'}</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon

          if (sidebarCollapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center justify-center h-9 w-9 rounded-lg mx-auto transition-all duration-200',
                      isActive
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200',
                isActive
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 font-medium'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Organization switcher */}
      {!sidebarCollapsed && organization && (
        <div className="px-2 py-2 border-t border-[#1e293b]">
          <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left">
            <div className="flex items-center justify-center w-6 h-6 rounded bg-blue-600/30 shrink-0">
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-white truncate">{organization.name}</div>
              <div className="text-xs text-slate-500 capitalize">{organization.plan} Plan</div>
            </div>
          </button>
        </div>
      )}

      {/* User section */}
      <div className={cn('px-2 py-3 border-t border-[#1e293b]', sidebarCollapsed ? 'flex flex-col items-center gap-2' : '')}>
        {!sidebarCollapsed ? (
          <div className="flex items-center gap-2 px-2 py-2">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-white truncate">{user?.full_name || 'User'}</div>
              <div className="text-xs text-slate-500 truncate">{user?.email}</div>
            </div>
            <button
              onClick={logout}
              className="p-1 rounded text-slate-400 hover:text-rose-400 transition-colors"
              title="Logout"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="h-7 w-7 cursor-pointer">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="right">{user?.full_name}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={logout} className="p-1.5 rounded text-slate-400 hover:text-rose-400 transition-colors">
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Logout</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center h-8 border-t border-[#1e293b] text-slate-500 hover:text-white hover:bg-white/5 transition-all"
      >
        {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  )
}
