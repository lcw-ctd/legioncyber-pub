import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  created_at: string
  link?: string
}

interface UIState {
  sidebarCollapsed: boolean
  activeOrgId: string | null
  notifications: Notification[]
  unreadCount: number
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setActiveOrg: (orgId: string) => void
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'created_at'>) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  clearNotifications: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      activeOrgId: null,
      notifications: [],
      unreadCount: 0,

      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
      },

      setSidebarCollapsed: (collapsed: boolean) => {
        set({ sidebarCollapsed: collapsed })
      },

      setActiveOrg: (orgId: string) => {
        set({ activeOrgId: orgId })
      },

      addNotification: (notification) => {
        const newNotif: Notification = {
          ...notification,
          id: crypto.randomUUID(),
          read: false,
          created_at: new Date().toISOString(),
        }
        set((state) => ({
          notifications: [newNotif, ...state.notifications].slice(0, 50),
          unreadCount: state.unreadCount + 1,
        }))
      },

      markNotificationRead: (id: string) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        }))
      },

      markAllNotificationsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        }))
      },

      clearNotifications: () => {
        set({ notifications: [], unreadCount: 0 })
      },
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        activeOrgId: state.activeOrgId,
      }),
    }
  )
)
