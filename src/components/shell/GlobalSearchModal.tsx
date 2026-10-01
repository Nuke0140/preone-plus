'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  X,
  Loader2,
  GraduationCap,
  Users,
  UserCheck,
  Building,
  CalendarCheck,
  DollarSign,
  Briefcase,
  Truck,
  Package,
  FileText,
  Megaphone,
  ShieldCheck,
  Settings,
  ChevronRight,
  Sparkles,
  ArrowRight,
  CornerDownLeft,
  Plus,
  Inbox,
  Ban,
  History,
  Trash2,
  Command,
  Home,
  LayoutDashboard,
  BarChart3,
} from 'lucide-react'
import type { SearchCategory, SearchResultItem, GlobalSearchResponse } from '@/lib/search/search-service'

interface GlobalSearchModalProps {
  isOpen: boolean
  onClose: () => void
  initialQuery?: string
}

const CATEGORY_ICONS: Record<SearchCategory, React.ComponentType<{ size?: number; className?: string }>> = {
  students: GraduationCap,
  guardians: Users,
  staff: UserCheck,
  admissions: Building,
  academics: GraduationCap,
  attendance: CalendarCheck,
  operations: Building,
  finance: DollarSign,
  hr: Briefcase,
  transport: Truck,
  inventory: Package,
  reports: FileText,
  communication: Megaphone,
  audit: ShieldCheck,
  settings: Settings,
}

const CATEGORY_LABELS: Record<SearchCategory, string> = {
  students: 'Students',
  guardians: 'Guardians',
  staff: 'Staff / Users',
  admissions: 'Admissions',
  academics: 'Academics',
  attendance: 'Attendance',
  operations: 'Operations',
  finance: 'Finance',
  hr: 'Workforce / HR',
  transport: 'Transport',
  inventory: 'Inventory',
  reports: 'Reports',
  communication: 'Communication',
  audit: 'Audit Logs',
  settings: 'Settings & Navigation',
}

const CATEGORY_ORDER: SearchCategory[] = [
  'students',
  'guardians',
  'staff',
  'admissions',
  'academics',
  'attendance',
  'operations',
  'finance',
  'hr',
  'transport',
  'inventory',
  'reports',
  'communication',
  'audit',
  'settings',
]

type CommandItem = {
  key: string
  label: string
  hint: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  href: string
}

type RecentItem = { label: string; hint: string; href: string }

const COMMANDS: CommandItem[] = [
  { key: 'create-user', label: 'Create user', hint: 'Actions', icon: Plus, href: '/app/users?open=ADD' },
  { key: 'pending-invites', label: 'View pending invitations', hint: 'Actions', icon: Inbox, href: '/app/users?tab=PENDING' },
  { key: 'suspended-accounts', label: 'View suspended accounts', hint: 'Actions', icon: Ban, href: '/app/users?status=SUSPENDED' },
  { key: 'home', label: 'Home', hint: 'Jump to module', icon: Home, href: '/app/home' },
  { key: 'dashboard', label: 'Dashboard', hint: 'Jump to module', icon: LayoutDashboard, href: '/app/dashboard' },
  { key: 'users', label: 'Users & Access', hint: 'Jump to module', icon: UserCheck, href: '/app/users' },
  { key: 'students', label: 'Students', hint: 'Jump to module', icon: GraduationCap, href: '/app/students' },
  { key: 'admissions', label: 'Admissions', hint: 'Jump to module', icon: Building, href: '/app/admissions' },
  { key: 'daily-diary', label: 'Daily Diary & Attendance', hint: 'Jump to module', icon: CalendarCheck, href: '/app/daily-diary' },
  { key: 'finance', label: 'Fees & Finance', hint: 'Jump to module', icon: DollarSign, href: '/app/finance' },
  { key: 'transport', label: 'Transport', hint: 'Jump to module', icon: Truck, href: '/app/transport' },
  { key: 'reports', label: 'Reports & Analytics', hint: 'Jump to module', icon: BarChart3, href: '/app/reports' },
  { key: 'audit', label: 'Audit Logs', hint: 'Jump to module', icon: ShieldCheck, href: '/app/audit' },
  { key: 'settings', label: 'Settings', hint: 'Jump to module', icon: Settings, href: '/app/settings' },
]

const RECENTS_KEY = 'preone:search-recents'
const RECENTS_MAX = 5

function loadRecents(): RecentItem[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((r) => r && typeof r.label === 'string' && typeof r.href === 'string')
      .slice(0, RECENTS_MAX)
  } catch {
    return []
  }
}

export function GlobalSearchModal({ isOpen, onClose, initialQuery = '' }: GlobalSearchModalProps) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [activeCategory, setActiveCategory] = useState<SearchCategory | 'all'>('all')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<GlobalSearchResponse | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [recents, setRecents] = useState<RecentItem[]>(loadRecents)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Focus on mount or open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
    } else {
      setQuery('')
      setData(null)
      setActiveCategory('all')
      setSelectedIndex(0)
      setError(null)
    }
  }, [isOpen])

  // Persist recents whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(RECENTS_KEY, JSON.stringify(recents))
    } catch {
      // storage unavailable — recents stay in-memory for this session
    }
  }, [recents])

  // Debounced search
  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed || trimmed.startsWith('>')) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    const timer = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const catParam = activeCategory !== 'all' ? `&category=${encodeURIComponent(activeCategory)}` : ''
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(trimmed)}${catParam}&limit=20`, {
          signal: controller.signal,
        })
        if (!res.ok) {
          throw new Error(`Search failed: HTTP ${res.status}`)
        }
        const json = await res.json()
        if (json.success && json.data) {
          setData(json.data)
          setSelectedIndex(0)
        } else {
          throw new Error(json.error?.message || 'Search returned unexpected response')
        }
      } catch (err: unknown) {
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message || 'An error occurred while searching')
        }
      } finally {
        setLoading(false)
      }
    }, 200)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, activeCategory])

  const trimmedQuery = query.trim()
  const commandMode = trimmedQuery.startsWith('>')
  const commandQuery = commandMode ? trimmedQuery.slice(1).trim().toLowerCase() : ''
  const filteredCommands = commandMode
    ? COMMANDS.filter(
        (c) =>
          !commandQuery ||
          c.label.toLowerCase().includes(commandQuery) ||
          c.hint.toLowerCase().includes(commandQuery) ||
          c.key.includes(commandQuery),
      )
    : []
  const results = data?.results || []

  // Reset selection whenever the active list mode changes (commands / recents / results)
  const modeKey = commandMode ? 'cmd' : trimmedQuery ? 'search' : 'empty'
  useEffect(() => {
    setSelectedIndex(0)
  }, [modeKey])

  const pushRecent = useCallback((item: RecentItem) => {
    setRecents((prev) => [item, ...prev.filter((r) => r.href !== item.href)].slice(0, RECENTS_MAX))
  }, [])

  const clearRecents = useCallback(() => {
    setRecents([])
    setSelectedIndex(0)
  }, [])

  // Keyboard navigation over the merged active list
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const activeCount = commandMode ? filteredCommands.length : trimmedQuery ? results.length : recents.length
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (activeCount > 0 ? (prev + 1) % activeCount : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (activeCount > 0 ? (prev - 1 + activeCount) % activeCount : 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (commandMode) {
          const cmd = filteredCommands[selectedIndex]
          if (cmd) {
            pushRecent({ label: cmd.label, hint: cmd.hint, href: cmd.href })
            onClose()
            router.push(cmd.href)
          }
        } else if (!trimmedQuery) {
          const rec = recents[selectedIndex]
          if (rec) {
            onClose()
            router.push(rec.href)
          }
        } else if (results[selectedIndex]) {
          const target = results[selectedIndex]
          pushRecent({ label: target.title, hint: CATEGORY_LABELS[target.category], href: target.actionUrl })
          onClose()
          router.push(target.actionUrl)
        } else {
          onClose()
          router.push(`/app/search?q=${encodeURIComponent(trimmedQuery)}${activeCategory !== 'all' ? `&category=${activeCategory}` : ''}`)
        }
      }
    },
    [onClose, commandMode, filteredCommands, trimmedQuery, results, selectedIndex, recents, activeCategory, router, pushRecent],
  )

  // Auto-scroll to selected element
  useEffect(() => {
    if (!listRef.current) return
    const activeEl = listRef.current.querySelector('[data-sel]') as HTMLElement | null
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedIndex, commandMode, trimmedQuery, results.length, recents.length])

  if (!isOpen) return null

  const availableCategories = CATEGORY_ORDER.filter(
    (cat) => data?.categoryCounts && (data.categoryCounts[cat] ?? 0) > 0
  )

  return (
    <div
      className="global-search-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Global Search"
    >
      <div className="global-search-modal" onKeyDown={handleKeyDown}>
        {/* Search Input Bar */}
        <div className="search-modal-header">
          <div className="search-input-wrapper">
            {loading ? (
              <Loader2 className="search-icon spin" size={20} />
            ) : (
              <Search className="search-icon" size={20} />
            )}
            <input
              ref={inputRef}
              type="text"
              className="search-input"
              placeholder="Search the OS — or type “>” for commands"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search query"
              autoComplete="off"
              spellCheck="false"
            />
            {query && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => {
                  setQuery('')
                  inputRef.current?.focus()
                }}
                aria-label="Clear query"
              >
                <X size={16} />
              </button>
            )}
            <span className="search-badge-esc">ESC</span>
          </div>

          {/* Category Filter Pills */}
          {data && data.total > 0 && availableCategories.length > 1 && (
            <div className="category-pills-bar">
              <button
                type="button"
                className={`category-pill ${activeCategory === 'all' ? 'active' : ''}`}
                onClick={() => setActiveCategory('all')}
              >
                All ({data.total})
              </button>
              {availableCategories.map((cat) => {
                const count = data.categoryCounts[cat] || 0
                return (
                  <button
                    key={cat}
                    type="button"
                    className={`category-pill ${activeCategory === cat ? 'active' : ''}`}
                    onClick={() => setActiveCategory(cat)}
                  >
                    {CATEGORY_LABELS[cat]} ({count})
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Results List / Content */}
        <div className="search-modal-body" ref={listRef}>
          {error && (
            <div className="search-feedback-box error">
              <p>{error}</p>
            </div>
          )}

          {/* Commands (">" prefix) */}
          {commandMode && (
            <div className="search-section">
              <div className="search-section-head">
                <span className="search-section-label">
                  <Command size={13} /> Commands
                </span>
                {filteredCommands.length > 0 && (
                  <span className="search-section-count">{filteredCommands.length}</span>
                )}
              </div>
              {filteredCommands.length === 0 && (
                <div className="search-empty-state compact">
                  <p className="no-results-title">No command found</p>
                  <p className="no-results-desc">
                    Try “Create user”, “Pending invitations”, or a module name.
                  </p>
                </div>
              )}
              {filteredCommands.map((cmd: CommandItem, idx: number) => {
                const Icon = cmd.icon
                const isSelected = idx === selectedIndex
                return (
                  <div
                    key={cmd.key}
                    className={`search-result-row search-command-row ${isSelected ? 'selected' : ''}`}
                    data-sel={isSelected ? '' : undefined}
                    onClick={() => {
                      pushRecent({ label: cmd.label, hint: cmd.hint, href: cmd.href })
                      onClose()
                      router.push(cmd.href)
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="result-category-icon command">
                      <Icon size={18} />
                    </div>
                    <div className="result-info">
                      <div className="result-title-row">
                        <span className="result-title">{cmd.label}</span>
                        <span className="result-category-label">{cmd.hint}</span>
                      </div>
                      {cmd.href.includes('?') && <span className="result-subtitle">Deep link · {cmd.href.slice(cmd.href.indexOf('/app'))}</span>}
                    </div>
                    <div className="result-arrow">
                      {isSelected ? (
                        <span className="enter-key-indicator">
                          <CornerDownLeft size={13} />
                        </span>
                      ) : (
                        <ChevronRight size={16} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Recents (empty query) */}
          {!commandMode && !trimmedQuery && recents.length > 0 && (
            <div className="search-section">
              <div className="search-section-head">
                <span className="search-section-label">
                  <History size={13} /> Recent
                </span>
                <button
                  type="button"
                  className="search-section-clear"
                  onClick={clearRecents}
                  aria-label="Clear recent searches"
                >
                  <Trash2 size={12} /> Clear
                </button>
              </div>
              {recents.map((rec: RecentItem, idx: number) => {
                const isSelected = idx === selectedIndex
                return (
                  <div
                    key={rec.href}
                    className={`search-result-row ${isSelected ? 'selected' : ''}`}
                    data-sel={isSelected ? '' : undefined}
                    onClick={() => {
                      onClose()
                      router.push(rec.href)
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="result-category-icon recent">
                      <History size={16} />
                    </div>
                    <div className="result-info">
                      <div className="result-title-row">
                        <span className="result-title">{rec.label}</span>
                        <span className="result-category-label">{rec.hint}</span>
                      </div>
                    </div>
                    <div className="result-arrow">
                      {isSelected ? (
                        <span className="enter-key-indicator">
                          <CornerDownLeft size={13} />
                        </span>
                      ) : (
                        <ChevronRight size={16} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {!commandMode && !trimmedQuery && (
            <div className="search-empty-state">
              <div className="search-empty-icon">
                <Sparkles size={28} />
              </div>
              <h4>Search PreOne Enterprise OS</h4>
              <p>Type a student name, parent phone, invoice number, classroom, or module.</p>
              <div className="search-hints-grid">
                <div className="search-hint-item" onClick={() => setQuery('Sun')}>
                  <span className="hint-tag">Prefix</span> Search “Sun”
                </div>
                <div className="search-hint-item" onClick={() => setQuery('Class')}>
                  <span className="hint-tag">Module</span> Search “Class”
                </div>
                <div className="search-hint-item" onClick={() => setQuery('INV')}>
                  <span className="hint-tag">Finance</span> Search “INV”
                </div>
                <div className="search-hint-item" onClick={() => setQuery('>')}>
                  <span className="hint-tag">Commands</span> Type “&gt;” for actions
                </div>
              </div>
            </div>
          )}

          {!commandMode && trimmedQuery && !loading && results.length === 0 && (
            <div className="search-empty-state">
              <p className="no-results-title">No matching records found</p>
              <p className="no-results-desc">
                No results match “<strong>{trimmedQuery}</strong>” within your authorized access scope.
              </p>
            </div>
          )}

          {results.length > 0 &&
            results.map((item: SearchResultItem, idx: number) => {
              const Icon = CATEGORY_ICONS[item.category] || GraduationCap
              const isSelected = idx === selectedIndex

              return (
                <div
                  key={`${item.category}-${item.id}`}
                  className={`search-result-row ${isSelected ? 'selected' : ''}`}
                  data-sel={isSelected ? '' : undefined}
                  onClick={() => {
                    pushRecent({ label: item.title, hint: CATEGORY_LABELS[item.category], href: item.actionUrl })
                    onClose()
                    router.push(item.actionUrl)
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className={`result-category-icon ${item.category}`}>
                    <Icon size={18} />
                  </div>

                  <div className="result-info">
                    <div className="result-title-row">
                      <span className="result-title">{item.title}</span>
                      {item.badge && (
                        <span className={`result-badge ${item.badgeVariant || 'default'}`}>
                          {item.badge}
                        </span>
                      )}
                      <span className="result-category-label">
                        {CATEGORY_LABELS[item.category]}
                      </span>
                    </div>
                    {item.subtitle && <span className="result-subtitle">{item.subtitle}</span>}
                  </div>

                  <div className="result-arrow">
                    {isSelected ? (
                      <span className="enter-key-indicator">
                        <CornerDownLeft size={13} />
                      </span>
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </div>
                </div>
              )
            })}
        </div>

        {/* Modal Footer */}
        <div className="search-modal-footer">
          <div className="footer-keys">
            <span className="key-shortcut">
              <kbd>↑</kbd>
              <kbd>↓</kbd> Navigate
            </span>
            <span className="key-shortcut">
              <kbd>↵</kbd> Select
            </span>
            <span className="key-shortcut">
              <kbd>&gt;</kbd> Commands
            </span>
            <span className="key-shortcut">
              <kbd>esc</kbd> Close
            </span>
          </div>

          {!commandMode && trimmedQuery && data && data.total > 0 && (
            <button
              type="button"
              className="footer-view-all"
              onClick={() => {
                onClose()
                router.push(`/app/search?q=${encodeURIComponent(trimmedQuery)}${activeCategory !== 'all' ? `&category=${activeCategory}` : ''}`)
              }}
            >
              View all results ({data.total}) <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}