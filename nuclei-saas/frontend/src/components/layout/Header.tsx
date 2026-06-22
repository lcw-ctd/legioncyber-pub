'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Bell, Zap, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/store/ui'
import { useAuthStore } from '@/store/auth'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/scans': 'Scans',
  '/scans/new': 'New Scan',
  '/findings': 'Findings',
  '/domains': 'Domains',
  '/reports': 'Reports',
  '/compliance': 'Compliance Center',
  '/integrations': 'Integrations',
  '/billing': 'Billing',
  '/settings': 'Settings',
}

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const { unreadCount, notifications, markAllNotificationsRead } = useUIStore()
  const { user, logout } = useAuthStore()

  const pageTitle = pageTitles[pathname] || pageTitles[Object.keys(pageTitles).find(k => pathname.startsWith(k + '/')) || ''] || 'Shield'

  const breadcrumbs = pathname
    .split('/')
    .filter(Boolean)
    .map((segment, index, arr) => ({
      label: pageTitles['/' + arr.slice(0, index + 1).join('/')] || segment,
      href: '/' + arr.slice(0, index + 1).join('/'),
      isLast: index === arr.length - 1,
    }))

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'LC'

  return (
    <header className="h-16 border-b border-[#1e293b] bg-[#0d1220] flex items-center px-6 gap-4 shrink-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {breadcrumbs.map((crumb, i) => (
          <div key={crumb.href} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />}
            {crumb.isLast ? (
              <h1 className="font-semibold text-white text-base truncate">{crumb.label}</h1>
            ) : (
              <button
                onClick={() => router.push(crumb.href)}
                className="text-slate-400 hover:text-white text-sm transition-colors truncate"
              >
                {crumb.label}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Button
          onClick={() => router.push('/scans/new')}
          size="sm"
          className="hidden sm:flex"
        >
          <Zap className="mr-1.5 h-3.5 w-3.5" />
          Quick Scan
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notifications</span>
              {unreadCount > 0 && (
                <button onClick={markAllNotificationsRead} className="text-xs text-blue-400 hover:text-blue-300 normal-case font-normal">
                  Mark all read
                </button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="px-3 py-6 text-center text-slate-400 text-sm">No notifications</div>
            ) : (
              notifications.slice(0, 5).map((notif) => (
                <DropdownMenuItem key={notif.id} className={`flex flex-col items-start gap-1 py-3 ${!notif.read ? 'bg-blue-600/5' : ''}`}>
                  <div className="flex items-center gap-2 w-full">
                    {!notif.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                    <span className="font-medium text-white text-sm">{notif.title}</span>
                  </div>
                  <span className="text-xs text-slate-400 pl-3.5">{notif.message}</span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="text-sm text-slate-300 hidden md:block">{user?.full_name?.split(' ')[0]}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>
              <div className="font-medium text-white">{user?.full_name}</div>
              <div className="text-xs text-slate-400 font-normal capitalize">{user?.role}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings')}>Settings</DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/billing')}>Billing</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-rose-400 focus:text-rose-400">
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
