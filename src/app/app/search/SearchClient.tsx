'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Search,
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
  ChevronLeft,
  Filter,
  ArrowRight,
  RotateCcw,
} from 'lucide-react'
import { PageHead, EmptyState } from '@/components/preone/ui'
import type { SearchCategory, SearchResultItem, GlobalSearchResponse } from '@/lib/search/search-service'

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
  admissions: 'Admissions & Leads',
  academics: 'Academics & Classes',
  attendance: 'Attendance',
  operations: 'Operations & Events',
  finance: 'Finance & Invoices',
  hr: 'HR & Staff Directory',
  transport: 'Transport & Routes',
  inventory: 'Inventory & Items',
  reports: 'Reports',
  communication: 'Announcements',
  audit: 'Audit Logs',
  settings: 'Settings & Tools',
}

const ALL_CATEGORIES: SearchCategory[] = [
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

const PAGE_SIZE = 20

export default function SearchPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialQ = searchParams?.get('q') || ''
  const initialCategory = (searchParams?.get('category') as SearchCategory | 'all') || 'all'

  const [inputQuery, setInputQuery] = useState(initialQ)
  const [activeCategory, setActiveCategory] = useState<SearchCategory | 'all'>(initialCategory)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<GlobalSearchResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const searchAbortRef = useRef<AbortController | null>(null)

  const executeSearch = useCallback(
    async (q: string, category: SearchCategory | 'all', pageNum: number) => {
      const trimmed = q.trim()
      if (!trimmed) {
        setData(null)
        setLoading(false)
        setError(null)
        return
      }

      if (searchAbortRef.current) {
        searchAbortRef.current.abort()
      }
      const controller = new AbortController()
      searchAbortRef.current = controller

      setLoading(true)
      setError(null)

      try {
        const catParam = category !== 'all' ? `&category=${encodeURIComponent(category)}` : ''
        const offset = (pageNum - 1) * PAGE_SIZE
        const res = await fetch(
          `/api/v1/search?q=${encodeURIComponent(trimmed)}${catParam}&limit=${PAGE_SIZE}&offset=${offset}`,
          { signal: controller.signal }
        )

        if (!res.ok) {
          throw new Error(`Search failed: HTTP ${res.status}`)
        }

        const json = await res.json()
        if (json.success && json.data) {
          setData(json.data)
        } else {
          throw new Error(json.error?.message || 'Unexpected search response')
        }
      } catch (err: unknown) {
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message || 'An error occurred during search')
        }
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // Sync with URL params
  useEffect(() => {
    const q = searchParams?.get('q') || ''
    const cat = (searchParams?.get('category') as SearchCategory | 'all') || 'all'
    setInputQuery(q)
    setActiveCategory(cat)
    setPage(1)
    executeSearch(q, cat, 1)
  }, [searchParams, executeSearch])

  // Handle Form Submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = inputQuery.trim()
    const catParam = activeCategory !== 'all' ? `&category=${activeCategory}` : ''
    router.push(`/app/search?q=${encodeURIComponent(trimmed)}${catParam}`)
  }

  // Handle Category Change
  const handleSelectCategory = (cat: SearchCategory | 'all') => {
    setActiveCategory(cat)
    setPage(1)
    const catParam = cat !== 'all' ? `&category=${cat}` : ''
    router.push(`/app/search?q=${encodeURIComponent(inputQuery.trim())}${catParam}`)
  }

  // Handle Page Change
  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    executeSearch(inputQuery, activeCategory, newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const results = data?.results || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1

  return (
    <div className="search-page-container" style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 60 }}>
      <PageHead
        title="Global Search"
        sub="Search unified canonical records across all modules with strict role-based access control."
      />

      {/* Main Search Input Form */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--foreground-muted)',
              }}
            />
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Search students, guardians, invoices, staff, classes, logs..."
              style={{
                width: '100%',
                height: 44,
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--surface-subtle)',
                color: 'var(--foreground)',
                fontSize: 15,
                padding: '0 16px 0 42px',
                outline: 'none',
              }}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ height: 44, padding: '0 24px' }}>
            {loading ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
            Search
          </button>
        </form>

        {/* Category Filter Pills */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            overflowX: 'auto',
            marginTop: 14,
            paddingBottom: 4,
            scrollbarWidth: 'none',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)', flex: 'none' }}>
            <Filter size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} /> Filter:
          </span>
          <button
            type="button"
            className={`category-pill ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => handleSelectCategory('all')}
          >
            All Categories {data?.total !== undefined && `(${data.total})`}
          </button>
          {ALL_CATEGORIES.map((cat) => {
            const count = data?.categoryCounts?.[cat] ?? 0
            return (
              <button
                key={cat}
                type="button"
                className={`category-pill ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => handleSelectCategory(cat)}
              >
                {CATEGORY_LABELS[cat]} {data && `(${count})`}
              </button>
            )
          })}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="card" style={{ padding: '16px 20px', marginBottom: 20, borderColor: 'var(--danger)' }}>
          <p style={{ color: 'var(--danger)', fontSize: 14, margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Results Header */}
      {data && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
            padding: '0 4px',
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
            Found <strong>{total}</strong> {total === 1 ? 'record' : 'records'} for “
            <strong>{data.query}</strong>”
            {activeCategory !== 'all' && ` in ${CATEGORY_LABELS[activeCategory]}`}
          </span>
          {totalPages > 1 && (
            <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
              Page {page} of {totalPages}
            </span>
          )}
        </div>
      )}

      {/* Results Listing */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading && (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <Loader2 className="spin" size={32} style={{ margin: '0 auto 12px', color: 'var(--preone-primary)' }} />
            <p style={{ fontSize: 14, color: 'var(--foreground-muted)' }}>Searching unified records across modules...</p>
          </div>
        )}

        {!loading && !inputQuery.trim() && (
          <EmptyState
            illustration="search"
            eyebrow="Global Search"
            title="Search unified preschool records"
            description="Find students, parents, fee invoices, admissions applications, and operational configurations instantly across PreOne."
          />
        )}

        {!loading && inputQuery.trim() && results.length === 0 && (
          <EmptyState
            illustration="search"
            eyebrow="Search Results"
            title={`No records match "${inputQuery}"`}
            description="No records matched your search query within your authorized role scope and selected category. Try checking spelling, using fewer keywords, or searching across all categories."
            action={{
              label: 'Clear Search',
              onClick: () => setInputQuery(''),
              variant: 'secondary',
            }}
          />
        )}

        {!loading && results.length > 0 && (
          <div className="search-results-list" style={{ display: 'flex', flexDirection: 'column' }}>
            {results.map((item: SearchResultItem) => {
              const Icon = CATEGORY_ICONS[item.category] || GraduationCap

              return (
                <Link
                  key={`${item.category}-${item.id}`}
                  href={item.actionUrl}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--border-subtle)',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'background 0.15s ease',
                  }}
                  className="search-result-table-row"
                >
                  <div className={`result-category-icon ${item.category}`} style={{ width: 40, height: 40 }}>
                    <Icon size={20} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--foreground)' }}>
                        {item.title}
                      </span>
                      {item.badge && (
                        <span className={`result-badge ${item.badgeVariant || 'default'}`}>
                          {item.badge}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: 'var(--foreground-muted)',
                          marginLeft: 'auto',
                          background: 'var(--surface-muted)',
                          padding: '2px 8px',
                          borderRadius: 6,
                        }}
                      >
                        {CATEGORY_LABELS[item.category]}
                      </span>
                    </div>

                    {item.subtitle && (
                      <p
                        style={{
                          fontSize: 12.5,
                          color: 'var(--foreground-muted)',
                          margin: 0,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.subtitle}
                      </p>
                    )}
                  </div>

                  <div style={{ color: 'var(--foreground-muted)', paddingLeft: 8 }}>
                    <ChevronRight size={18} />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Pagination Bar */}
      {!loading && totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 12,
            marginTop: 20,
          }}
        >
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={page <= 1}
            onClick={() => handlePageChange(page - 1)}
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={page >= totalPages}
            onClick={() => handlePageChange(page + 1)}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
