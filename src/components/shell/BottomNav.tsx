'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import {
  Home,
  LayoutGrid,
  Users,
  GraduationCap,
  Sparkles,
  Briefcase,
  CalendarCheck,
} from 'lucide-react'
import { PLogoMark } from '@/components/preone/PLogo'
import { DockStarsAccent } from '@/components/preone/illustrations'
import { DockDateTime } from './DockDateTime'
import type { NavItem } from '@/lib/nav'
import type { Role } from '@/lib/auth'

export interface BottomNavProps {
  user: { role: Role; name?: string }
  nav: NavItem[]
  pathname: string
  isOpen: boolean
  onToggleMenu: () => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
  className?: string
}

interface ResolvedDockItem {
  key: string
  label: string
  href: string
  icon: React.ComponentType<{ size?: number | string; className?: string }>
  image?: string
}

/**
 * PreOne Global Bottom Navigation / Dock
 * A wide floating pill dock with 3 visual zones:
 * - Left: Clean breathing space with subtle preschool decorative stars & pastel particles
 * - Center: Symmetrically centered canonical navigation around an elevated glowing PreOne Orb
 * - Right: Live Date/Time utility
 */
export function BottomNav({
  user,
  nav,
  pathname,
  isOpen,
  onToggleMenu,
  triggerRef,
  className = '',
}: BottomNavProps) {
  // Resolve canonical dock navigation items based on user role and permissions
  const { leftItems, rightItems } = useMemo(() => {
    // Canonical preferred items across roles
    const findItem = (keys: string[]) => nav.find((n) => keys.includes(n.key))

    const homeItem = findItem(['home']) || {
      key: 'home',
      label: 'Home',
      href: '/app/home',
      icon: Home,
    }

    const appsItem =
      findItem(['dashboard', 'setup']) ||
      nav.find((n) => n.href !== '/app/home') || {
        key: 'apps',
        label: 'Apps',
        href: '/app/home',
        icon: LayoutGrid,
      }

    const studentsItem =
      nav.find((n) => n.key === 'students') ||
      nav.find((n) => n.key === 'admissions')
    const learningItem =
      nav.find((n) => n.key === 'learning' || n.key === 'preo-learning' || n.key === 'preo_learning')
    const staffItem =
      nav.find((n) => n.key === 'users') ||
      nav.find((n) => n.key === 'hr')
    const growthItem =
      nav.find((n) => n.key === 'daily-diary') ||
      nav.find((n) => n.key === 'reports')

    // Prepare left cluster (Home, Apps)
    const left: ResolvedDockItem[] = [
      {
        key: homeItem.key,
        label: 'Home',
        href: homeItem.href,
        icon: homeItem.icon || Home,
      },
      {
        key: appsItem.key,
        label: 'Apps',
        href: appsItem.href,
        icon: appsItem.icon || LayoutGrid,
        image: '/animations/home/dashboard.webp',
      },
    ]

    // Prepare right cluster (Students, Learning, Staff, Growth)
    const right: ResolvedDockItem[] = []
    if (studentsItem) {
      right.push({
        key: studentsItem.key,
        label: 'Students',
        href: studentsItem.href,
        icon: studentsItem.icon || GraduationCap,
        image: '/animations/home/students.webp',
      })
    }
    if (learningItem) {
      right.push({
        key: learningItem.key,
        label: 'Learning',
        href: learningItem.href,
        icon: learningItem.icon || GraduationCap,
        image: '/animations/home/preo_learning_mascot.webp',
      })
    }
    if (staffItem) {
      right.push({
        key: staffItem.key,
        label: 'Staff',
        href: staffItem.href,
        icon: staffItem.icon || Briefcase,
        image: '/animations/home/users.webp',
      })
    }
    if (growthItem) {
      right.push({
        key: growthItem.key,
        label: growthItem.key === 'daily-diary' ? 'Diary' : growthItem.label,
        href: growthItem.href,
        icon: growthItem.key === 'daily-diary' ? CalendarCheck : (growthItem.icon || Sparkles),
        image: '/animations/home/daily_diary.webp',
      })
    }

    // If right items are sparse (e.g. for PARENT or RECEPTIONIST roles), backfill from remaining nav items
    if (right.length === 0) {
      const remaining = nav.filter(
        (n) => n.key !== homeItem.key && n.key !== appsItem.key
      ).slice(0, 3)
      for (const item of remaining) {
        right.push({
          key: item.key,
          label: item.label,
          href: item.href,
          icon: item.icon,
        })
      }
    }

    return { leftItems: left, rightItems: right }
  }, [nav])

  const isItemActive = (href: string) => {
    if (href === '/app/home') return pathname === '/app/home' || pathname === '/app'
    return pathname.startsWith(href)
  }

  return (
    <footer className={`dock-wrapper ${className}`.trim()} role="contentinfo">
      <nav className="taskbar preone-dock workspace-floating-surface" aria-label="Global navigation dock">
        {/* ── Left Zone: Clean breathing space + subtle decorative stars ── */}
        <div className="dock-zone dock-zone-left" aria-hidden="true">
          <DockStarsAccent className="dock-decorative-stars" />
        </div>

        {/* ── Center Zone: True centered navigation group + elevated PreOne Orb ── */}
        <div className="dock-zone dock-zone-center">
          {/* Left navigation items */}
          <div className="dock-nav-group dock-nav-group-left">
            {leftItems.map((item) => {
              const Icon = item.icon
              const active = isItemActive(item.href)
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`dock-item${active ? ' active' : ''}`}
                  title={item.label}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="dock-item-icon">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.label}
                        className="w-5 h-5 object-contain scale-110 drop-shadow-sm pointer-events-none"
                      />
                    ) : (
                      <Icon size={18} />
                    )}
                  </span>
                  <span className="dock-item-label">{item.label}</span>
                </Link>
              )
            })}
          </div>

          {/* Divider before Orb */}
          <span className="dock-divider" aria-hidden="true" />

          {/* Elevated glowing PreOne Orb (Start Menu Trigger) */}
          <div className="dock-orb-container">
            <button
              suppressHydrationWarning
              ref={triggerRef}
              className={`dock-orb tb-start${isOpen ? ' on active' : ''}`}
              onClick={onToggleMenu}
              aria-label="PreOne Plus Start Menu"
              aria-expanded={isOpen}
              aria-haspopup="menu"
              type="button"
            >
              <PLogoMark size={34} />
              <span className="dock-orb-halo" aria-hidden="true" />
            </button>
          </div>

          {/* Divider after Orb */}
          <span className="dock-divider" aria-hidden="true" />

          {/* Right navigation items */}
          <div className="dock-nav-group dock-nav-group-right">
            {rightItems.map((item) => {
              const Icon = item.icon
              const active = isItemActive(item.href)
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`dock-item${active ? ' active' : ''}`}
                  title={item.label}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="dock-item-icon">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.label}
                        className="w-5 h-5 object-contain scale-110 drop-shadow-sm pointer-events-none"
                      />
                    ) : (
                      <Icon size={18} />
                    )}
                  </span>
                  <span className="dock-item-label">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>

        {/* ── Right Zone: Live Date/Time ── */}
        <div className="dock-zone dock-zone-right">
          <DockDateTime />
        </div>
      </nav>
    </footer>
  )
}
