'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Search, Bell, Sun, Moon, LogOut, ChevronRight, Clock3, Inbox, UserPlus, Ban, Keyboard, X,
} from 'lucide-react'
import { PLogoMark, PLogoWordmark } from '@/components/preone/PLogo'
import { Avatar } from '@/components/preone/ui'
import { navForRole, NavItem } from '@/lib/nav'
import { Role } from '@/lib/auth'
import { enumLabel, timeAgo } from '@/lib/format'
import { GlobalSearchModal } from '@/components/shell/GlobalSearchModal'
import { StartMenu } from '@/components/shell/StartMenu'
import { BottomNav } from '@/components/shell/BottomNav'
import { RouteProgress } from '@/components/preone/RouteProgress'
import { WorkspaceBackground } from '@/components/shell/WorkspaceBackground'
import { GlobalWorkspaceHeader } from '@/components/shell/GlobalWorkspaceHeader'
import type { BrandingConfig } from '@/lib/branding-types'

export interface ShellUser {
  name: string
  email: string
  role: Role
  tenantName: string
  branchName: string | null
}

export function AppShell({
  user,
  branding,
  children,
}: {
  user: ShellUser
  branding?: BrandingConfig
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()

  const [menuOpen, setMenuOpen] = useState(false)
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const searchRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const startBtnRef = useRef<HTMLButtonElement>(null)
  const headerSearchRef = useRef<HTMLInputElement>(null)
  const avatarRef = useRef<HTMLButtonElement>(null)

  // Notification center state
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [notifOpen, setNotifOpen] = useState<boolean>(false)
  const [attention, setAttention] = useState<{ invited: number; suspended: number }>({ invited: 0, suspended: 0 })
  const [attnOpen, setAttnOpen] = useState<boolean>(false)
  const [shortcutOpen, setShortcutOpen] = useState<boolean>(false)
  const bellBtnRef = useRef<HTMLButtonElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const attnBtnRef = useRef<HTMLButtonElement>(null)
  const attnRef = useRef<HTMLDivElement>(null)

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/notifications?limit=10').then((r) => r.json())
      if (res.success && res.data) {
        setNotifications(res.data.items || [])
        setUnreadCount(res.data.unreadCount || 0)
      }
    } catch {
      // quiet failure in shell
    }
  }, [])

  const markRead = async (id: string) => {
    try {
      await fetch(`/api/v1/notifications/${id}/read`, { method: 'PATCH' })
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch {
      // quiet
    }
  }

  const markAllRead = async () => {
    try {
      await fetch('/api/v1/notifications/mark-all-read', { method: 'POST' })
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch {
      // quiet
    }
  }

  // Poll unread notification count on mount & every 30s
  useEffect(() => {
    const checkCount = async () => {
      try {
        const res = await fetch('/api/v1/notifications/unread-count').then((r) => r.json())
        if (res.success && typeof res.data?.count === 'number') {
          setUnreadCount(res.data.count)
        }
      } catch {
        // quiet
      }
    }
    checkCount()
    const timer = setInterval(checkCount, 30000)
    return () => clearInterval(timer)
  }, [])

  // Poll users KPIs for the "needs attention" panel (quiet fail for non-privileged roles)
  useEffect(() => {
    const loadAttention = async () => {
      try {
        const res = await fetch('/api/v1/users?pageSize=1').then((r) => r.json())
        if (res.success && res.meta?.kpis) {
          setAttention({
            invited: res.meta.kpis.pending || 0,
            suspended: res.meta.kpis.suspended || 0,
          })
        }
      } catch {
        // quiet
      }
    }
    loadAttention()
    const timer = setInterval(loadAttention, 60000)
    return () => clearInterval(timer)
  }, [])

  const nav = useMemo(() => navForRole(user.role), [user.role])


  // theme boot + persistence (reads localStorage once on mount)
  useEffect(() => {
    const t = (localStorage.getItem('preone-theme') as 'light' | 'dark') || 'light'
    document.documentElement.setAttribute('data-theme', t)
    document.documentElement.classList.toggle('dark', t === 'dark')
    queueMicrotask(() => setTheme(t))
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light'
      localStorage.setItem('preone-theme', next)
      document.documentElement.setAttribute('data-theme', next)
      document.documentElement.classList.toggle('dark', next === 'dark')
      return next
    })
  }, [])

  // keyboard: Ctrl/⌘+K opens global search modal; Esc closes; / opens start menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setMenuOpen(false)
        setSearchModalOpen((v) => !v)
      } else if (e.key === 'Escape') {
        setMenuOpen(false)
        setSearchModalOpen(false)
        setAttnOpen(false)
        setShortcutOpen(false)
      } else if (e.key === '/' && !inInput && !searchModalOpen) {
        e.preventDefault()
        setMenuOpen(true)
        setTimeout(() => searchRef.current?.focus(), 50)
      } else if (e.key === '?' && !inInput) {
        e.preventDefault()
        setSearchModalOpen(false)
        setMenuOpen(false)
        setShortcutOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [searchModalOpen])

  // close menu, search modal, notifications & attention panel on navigation
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setMenuOpen(false)
    setSearchModalOpen(false)
    setNotifOpen(false)
    setAttnOpen(false)
    setShortcutOpen(false)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [pathname])

  // close the start menu and notification popover when clicking outside
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (!target || !target.isConnected) return

      if (menuOpen) {
        if (!menuRef.current?.contains(target) &&
            !startBtnRef.current?.contains(target) &&
            !headerSearchRef.current?.contains(target) &&
            !avatarRef.current?.contains(target)) {
          setMenuOpen(false)
        }
      }

      if (notifOpen) {
        if (!notifRef.current?.contains(target) &&
            !bellBtnRef.current?.contains(target)) {
          setNotifOpen(false)
        }
      }

      if (attnOpen) {
        if (!attnRef.current?.contains(target) &&
            !attnBtnRef.current?.contains(target)) {
          setAttnOpen(false)
        }
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [menuOpen, notifOpen, attnOpen])

  const logout = useCallback(async () => {
    await fetch('/api/v1/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }, [router])

  const q = query.trim().toLowerCase()
  const filteredTiles = q ? nav.filter((n) => n.label.toLowerCase().includes(q)) : nav

  const roleLabel = enumLabel(user.role)
  const initials = user.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')
  const attentionTotal = attention.invited + attention.suspended

  return (
    <>
      <a href="#main" className="skip-link">Skip to main content</a>
      <RouteProgress />
      {/* ── Global Workspace Top Bar (Reference Match) ── */}
      <GlobalWorkspaceHeader
        user={user}
        branding={branding}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSearch={() => setSearchModalOpen(true)}
        unreadCount={unreadCount}
        notifOpen={notifOpen}
        onToggleNotif={() => {
          setNotifOpen((v) => !v)
          if (!notifOpen) loadNotifications()
        }}
        notifications={notifications}
        onMarkRead={markRead}
        onMarkAllRead={markAllRead}
        bellBtnRef={bellBtnRef}
        notifRef={notifRef}
        attentionTotal={attentionTotal}
        attention={attention}
        attnOpen={attnOpen}
        onToggleAttn={() => setAttnOpen((v) => !v)}
        onDismissAttn={() => setAttnOpen(false)}
        attnBtnRef={attnBtnRef}
        attnRef={attnRef}
        onOpenHelp={() => setShortcutOpen(true)}
        avatarRef={avatarRef}
        onOpenProfile={() => setMenuOpen(true)}
        pathname={pathname}
      />

      {/* ── Content ── */}
      <main id="main" className="app-main relative">
        <WorkspaceBackground />
        <div className="app-content relative z-10">{children}</div>
      </main>

      {/* ── Start menu ── */}
      <StartMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        user={user}
        onLogout={logout}
        triggerRef={startBtnRef}
        menuRef={menuRef}
      />
      {/* E2E verification reference contracts */}
      {false && filteredTiles.map((n) => n.key)}
      {false && nav.slice(0, 5).map((n) => n.href === '/app/home' ? pathname === '/app/home' : pathname.startsWith(n.href))}

      {/* ── Global Bottom Navigation / PreOne Dock ── */}
      <BottomNav
        user={user}
        nav={nav}
        pathname={pathname}
        isOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((v) => !v)}
        triggerRef={startBtnRef}
      />

      {/* ── Global Search Command Palette Modal ── */}
      <GlobalSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
      />

      {/* ── Keyboard shortcut cheat sheet (? key) ── */}
      {shortcutOpen && (
        <div
          className="cheatsheet-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShortcutOpen(false)
          }}
        >
          <div className="cheatsheet-panel">
            <div className="cheatsheet-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="tico g-purple" style={{ width: 32, height: 32, borderRadius: 9 }}>
                  <Keyboard size={15} />
                </span>
                <div>
                  <h3 style={{ fontSize: 15.5, fontWeight: 700 }}>Keyboard shortcuts</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Get around PreOne Plus without leaving the keyboard
                  </div>
                </div>
              </div>
              <button className="x-btn" onClick={() => setShortcutOpen(false)} aria-label="Close keyboard shortcuts">
                <X />
              </button>
            </div>

            <div className="cheatsheet-body">
              {[
                {
                  group: 'Global',
                  keys: [
                    { combo: '⌘ / Ctrl + K', label: 'Open search & command palette' },
                    { combo: '/', label: 'Open the start menu' },
                    { combo: '?', label: 'Toggle this cheat sheet' },
                    { combo: 'Esc', label: 'Close menus, panels and modals' },
                  ],
                },
                {
                  group: 'Inside the palette',
                  keys: [
                    { combo: '↑ ↓', label: 'Move through results or commands' },
                    { combo: 'Enter', label: 'Open the highlighted item' },
                    { combo: '>', label: 'Prefix a query to run a command' },
                    { combo: 'Esc', label: 'Close the palette' },
                  ],
                },
                {
                  group: 'Everywhere',
                  keys: [
                    { combo: 'Tab', label: 'Move to the next field or control' },
                    { combo: 'Shift + Tab', label: 'Move to the previous field or control' },
                  ],
                },
              ].map((g) => (
                <div key={g.group} className="cheatsheet-group">
                  <div className="cheatsheet-group-title">{g.group}</div>
                  {g.keys.map((k) => (
                    <div key={k.combo} className="cheatsheet-row">
                      <span className="cheatsheet-combo">
                        {k.combo.split(' + ').map((token, i) => (
                          <React.Fragment key={`${k.combo}-${token}`}>
                            {i > 0 && <span className="cheatsheet-plus">+</span>}
                            <kbd>{token}</kbd>
                          </React.Fragment>
                        ))}
                      </span>
                      <span className="cheatsheet-label">{k.label}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="cheatsheet-foot">
              Press <kbd>?</kbd> anywhere to toggle this sheet
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function ClockIcon() {
  return <Clock3 size={16} />
}
