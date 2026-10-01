'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Search,
  Bell,
  Sun,
  Moon,
  Inbox,
  UserPlus,
  Ban,
  ChevronRight,
  ChevronDown,
} from 'lucide-react'
import { enumLabel, timeAgo } from '@/lib/format'
import type { Role } from '@/lib/auth'
import { FullscreenButton } from './FullscreenButton'
import { HelpButton } from './HelpButton'
import type { BrandingConfig } from '@/lib/branding-types'

export interface GlobalWorkspaceHeaderProps {
  user: {
    name: string
    email: string
    role: Role
    tenantName: string
    branchName: string | null
  }
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onOpenSearch: () => void
  // Notifications
  unreadCount: number
  notifOpen: boolean
  onToggleNotif: () => void
  notifications: any[]
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  bellBtnRef: React.RefObject<HTMLButtonElement | null>
  notifRef: React.RefObject<HTMLDivElement | null>
  // Attention / Inbox
  attentionTotal: number
  attention: { invited: number; suspended: number }
  attnOpen: boolean
  onToggleAttn: () => void
  onDismissAttn: () => void
  attnBtnRef: React.RefObject<HTMLButtonElement | null>
  attnRef: React.RefObject<HTMLDivElement | null>
  // Help
  onOpenHelp: () => void
  // Profile
  avatarRef: React.RefObject<HTMLButtonElement | null>
  onOpenProfile: () => void
  pathname?: string
  branding?: BrandingConfig
}

/**
 * PreOne OS — Global Workspace Top Bar
 *
 * Implements the approved PreOne Top Bar Design:
 * - Left: Subtle celestial sparkle identity link back to workspace home
 * - Center: Flexible command search bar with platform shortcut badge (⌘K / Ctrl+K)
 * - Right: Utility actions group (Help, Full Screen, Theme, Inbox, Alerts) + Profile
 * - Fluid scroll compression & calm enterprise elevation
 */
export function GlobalWorkspaceHeader({
  user,
  branding,
  theme,
  onToggleTheme,
  onOpenSearch,
  unreadCount,
  notifOpen,
  onToggleNotif,
  notifications,
  onMarkRead,
  onMarkAllRead,
  bellBtnRef,
  notifRef,
  attentionTotal,
  attention,
  attnOpen,
  onToggleAttn,
  onDismissAttn,
  attnBtnRef,
  attnRef,
  onOpenHelp,
  avatarRef,
  onOpenProfile,
}: GlobalWorkspaceHeaderProps) {
  const [scrolled, setScrolled] = useState(false)
  const [isMac, setIsMac] = useState(false)

  // Scroll compression detection
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 8)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // OS detection for keyboard shortcut rendering
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsMac(/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform || navigator.userAgent))
    }
  }, [])

  const roleLabel = enumLabel(user.role)
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')

  const renderSearchBar = () => (
    <div
      className="workspace-search-bar"
      onClick={onOpenSearch}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpenSearch()
        }
      }}
      aria-label="Global search (Press ⌘K / Ctrl+K to open)"
    >
      <div className="workspace-search-left">
        <Search className="workspace-search-icon" aria-hidden="true" />
        <span className="workspace-search-placeholder">
          Search students, staff, invoices, classes…
        </span>
      </div>
      <kbd className="workspace-search-kbd">
        <span className="opacity-75">{isMac ? '⌘' : 'Ctrl'}</span>K
      </kbd>
    </div>
  )

  return (
    <div className="workspace-header-wrapper">
      <header
        className={`workspace-header workspace-floating-surface app-header ${scrolled ? 'scrolled' : ''}`}
      >
        {/* ── Main Horizontal Row (Desktop: Full Row / Mobile: Top Utility Row) ── */}
        <div className="workspace-header-main-row">
          {/* ── Left Area: Subtle PreOne Celestial Sparkle Identity ── */}
          <div className="workspace-header-left">
            <Link
              href="/app/home"
              className="workspace-sparkle-anchor"
              aria-label="PreOne OS Home"
              title="PreOne OS Home"
            >
              {branding?.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt={user.tenantName || 'School Logo'}
                  className="h-6 w-6 object-contain rounded drop-shadow-xs transition-transform duration-200 hover:scale-105"
                />
              ) : (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="transform-gpu transition-transform duration-200 hover:rotate-12"
                  aria-hidden="true"
                >
                  <path
                    d="M12 2C12 7.52 7.52 12 2 12C7.52 12 12 16.48 12 22C12 16.48 16.48 12 22 12C16.48 12 12 7.52 12 2Z"
                    fill="url(#workspaceHeaderSparkleGrad)"
                  />
                  <circle cx="18.5" cy="5.5" r="1.5" fill="#F59E0B" />
                  <circle cx="5.5" cy="18.5" r="1.2" fill="#38BDF8" opacity="0.85" />
                  <defs>
                    <linearGradient
                      id="workspaceHeaderSparkleGrad"
                      x1="2"
                      y1="2"
                      x2="22"
                      y2="22"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop stopColor="#9333EA" />
                      <stop offset="0.5" stopColor="#7C3AED" />
                      <stop offset="1" stopColor="#A855F7" />
                    </linearGradient>
                  </defs>
                </svg>
              )}
            </Link>
          </div>

          {/* ── Center Area: Workspace Global Command Search Bar (Desktop / Tablet) ── */}
          <div className="workspace-search-wrap hidden md:flex">
            {renderSearchBar()}
          </div>

          {/* ── Right Area: Action Group + Dividers + User Profile ── */}
          <div className="workspace-actions-group">
            {/* 1. Help Button */}
            <HelpButton onClick={onOpenHelp} className="hidden md:inline-flex" />

            {/* 2. Full Screen Button */}
            <FullscreenButton className="hidden md:inline-flex" />

        {/* 3. Theme Toggle Button */}
        <button
          suppressHydrationWarning
          type="button"
          className="workspace-action-btn"
          aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          onClick={onToggleTheme}
        >
          {theme === 'light' ? (
            <Moon size={16} aria-hidden="true" />
          ) : (
            <Sun size={16} aria-hidden="true" />
          )}
          <span className="workspace-action-label">Theme</span>
        </button>

        {/* 4. Inbox (Needs Attention) Action & Popover */}
        <div style={{ position: 'relative' }}>
          <button
            suppressHydrationWarning
            ref={attnBtnRef}
            type="button"
            className={`workspace-action-btn ${attnOpen ? 'active' : ''}`}
            aria-label="Inbox & Attention"
            aria-haspopup="dialog"
            aria-expanded={attnOpen}
            title={
              attentionTotal > 0
                ? `${attentionTotal} item${attentionTotal === 1 ? '' : 's'} need attention`
                : 'Inbox'
            }
            onClick={onToggleAttn}
          >
            <Inbox size={16} aria-hidden="true" />
            <span className="workspace-action-label">Inbox</span>
            {attentionTotal > 0 && (
              <span className="workspace-badge badge-amber">
                {attentionTotal > 99 ? '99+' : attentionTotal}
              </span>
            )}
          </button>

          {attnOpen && (
            <div ref={attnRef} className="workspace-popover" role="dialog" aria-label="Needs attention">
              <div
                style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Inbox size={15} />
                  <b style={{ fontSize: 13.5 }}>Needs attention</b>
                  {attentionTotal > 0 && (
                    <span
                      style={{
                        fontSize: 11,
                        flexShrink: 0,
                        background: 'var(--warning-strong, #d97706)',
                        color: '#fff',
                        borderRadius: 999,
                        padding: '2px 8px',
                        fontWeight: 700,
                        lineHeight: 1.3,
                      }}
                    >
                      {attentionTotal}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 11.5, padding: '2px 6px' }}
                  onClick={onDismissAttn}
                >
                  Dismiss
                </button>
              </div>

              <div style={{ overflowY: 'auto', flex: 1, maxHeight: 340 }}>
                {attentionTotal === 0 ? (
                  <div style={{ padding: '30px 16px', textAlign: 'center' }} className="txt-muted">
                    <p style={{ fontSize: 13 }}>You're all caught up</p>
                  </div>
                ) : (
                  <>
                    <Link
                      href="/app/users?tab=PENDING"
                      onClick={onDismissAttn}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '11px 14px',
                        borderBottom: '1px solid var(--border-subtle)',
                        textDecoration: 'none',
                        color: 'inherit',
                      }}
                    >
                      <span className="tico g-purple" style={{ width: 30, height: 30, borderRadius: 8 }}>
                        <UserPlus size={14} />
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600 }}>
                          Pending invitations
                        </span>
                        <span className="txt-muted" style={{ fontSize: 11, display: 'block' }}>
                          Awaiting enrolment or password setup
                        </span>
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          flexShrink: 0,
                          background: 'var(--warning-strong, #d97706)',
                          color: '#fff',
                          borderRadius: 999,
                          padding: '2px 8px',
                          fontWeight: 700,
                          lineHeight: 1.3,
                        }}
                      >
                        {attention.invited}
                      </span>
                      <ChevronRight size={14} className="txt-muted" style={{ flexShrink: 0 }} />
                    </Link>
                    <Link
                      href="/app/users?status=SUSPENDED"
                      onClick={onDismissAttn}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '11px 14px',
                        borderBottom: '1px solid var(--border-subtle)',
                        textDecoration: 'none',
                        color: 'inherit',
                      }}
                    >
                      <span className="tico g-orange" style={{ width: 30, height: 30, borderRadius: 8 }}>
                        <Ban size={14} />
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600 }}>
                          Suspended accounts
                        </span>
                        <span className="txt-muted" style={{ fontSize: 11, display: 'block' }}>
                          Portal access blocked until reactivated
                        </span>
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          flexShrink: 0,
                          background: 'var(--warning-strong, #d97706)',
                          color: '#fff',
                          borderRadius: 999,
                          padding: '2px 8px',
                          fontWeight: 700,
                          lineHeight: 1.3,
                        }}
                      >
                        {attention.suspended}
                      </span>
                      <ChevronRight size={14} className="txt-muted" style={{ flexShrink: 0 }} />
                    </Link>
                  </>
                )}
              </div>

              <div
                style={{
                  padding: '8px 14px',
                  borderTop: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-subtle)',
                  textAlign: 'center',
                }}
              >
                <Link
                  href="/app/users"
                  onClick={onDismissAttn}
                  style={{
                    fontSize: 12,
                    color: 'var(--primary)',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  Open Users &amp; Access →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* 5. Alerts (Notifications) Action & Popover */}
        <div style={{ position: 'relative' }}>
          <button
            suppressHydrationWarning
            ref={bellBtnRef}
            type="button"
            className={`workspace-action-btn ${notifOpen ? 'active' : ''}`}
            aria-label="Alerts and Notifications"
            title={
              unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
                : 'Alerts'
            }
            onClick={onToggleNotif}
          >
            <Bell size={16} aria-hidden="true" />
            <span className="workspace-action-label">Alerts</span>
            {unreadCount > 0 && (
              <span className="workspace-badge badge-primary">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div ref={notifRef} className="workspace-popover" role="dialog" aria-label="Notifications">
              <div
                style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Bell size={15} />
                  <b style={{ fontSize: 13.5 }}>Notifications</b>
                  {unreadCount > 0 && (
                    <span className="badge b-blue" style={{ fontSize: 11 }}>
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11.5, padding: '2px 6px' }}
                    onClick={onMarkAllRead}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div style={{ overflowY: 'auto', flex: 1, maxHeight: 340 }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '30px 16px', textAlign: 'center' }} className="txt-muted">
                    <p style={{ fontSize: 13 }}>No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => !n.isRead && onMarkRead(n.id)}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid var(--border-subtle)',
                        backgroundColor: n.isRead ? 'transparent' : 'rgba(99, 102, 241, 0.04)',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 6,
                        }}
                      >
                        <span style={{ fontSize: 12.5, fontWeight: n.isRead ? 500 : 600 }}>
                          {n.title}
                        </span>
                        <span className="badge" style={{ fontSize: 10, flexShrink: 0 }}>
                          {n.category}
                        </span>
                      </div>
                      <p
                        className="txt-muted"
                        style={{ fontSize: 12, marginTop: 3, lineHeight: 1.35 }}
                      >
                        {n.body}
                      </p>
                      <span
                        className="txt-muted"
                        style={{ fontSize: 10.5, marginTop: 4, display: 'block' }}
                      >
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div
                style={{
                  padding: '8px 14px',
                  borderTop: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-subtle)',
                  textAlign: 'center',
                }}
              >
                <Link
                  href="/app/settings"
                  onClick={onToggleNotif}
                  style={{
                    fontSize: 12,
                    color: 'var(--primary)',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  Manage notification settings →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* 6. Subtle Divider */}
        <div className="workspace-header-divider" aria-hidden="true" />

        {/* 7. Authenticated User Profile */}
        <button
          suppressHydrationWarning
          ref={avatarRef}
          type="button"
          className="workspace-profile-btn"
          onClick={onOpenProfile}
          aria-label="Open start menu and profile"
        >
          <span className="avatar sm a-p">{initials}</span>
          <div className="workspace-profile-info">
            <b className="workspace-profile-name">{user.name}</b>
            <span className="workspace-profile-role">{roleLabel}</span>
          </div>
          <ChevronDown size={13} className="workspace-profile-chevron" aria-hidden="true" />
        </button>
      </div>
    </div>

    {/* ── Mobile Secondary Row: Dedicated Full-Width Search Bar (< md) ── */}
    <div className="workspace-search-mobile-row md:hidden">
      <div className="workspace-search-wrap w-full">
        {renderSearchBar()}
      </div>
    </div>
  </header>
</div>
  )
}
