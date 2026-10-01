import { NextRequest } from 'next/server'
import { withApi } from '@/lib/with-api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { ok, errValidation } from '@/lib/api'
import { GlobalSearchService, SearchCategory } from '@/lib/search/search-service'

const VALID_CATEGORIES: Array<SearchCategory | 'all'> = [
  'all',
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

/**
 * GET /api/v1/search?q=...&category=...&limit=...&offset=...
 *
 * Cross-module, RBAC-restricted search endpoint for PreOne.
 * Enforces tenant isolation, role permissions, and relationship scopes server-side.
 */
export const GET = withApi(async (req: NextRequest) => {
  const session = await requireApi(req)
  if (isResponse(session)) return session

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const categoryParam = (searchParams.get('category') || 'all') as SearchCategory | 'all'
  const limitParam = parseInt(searchParams.get('limit') || '20', 10)
  const offsetParam = parseInt(searchParams.get('offset') || '0', 10)
  const branchIdParam = searchParams.get('branchId') || undefined

  if (!VALID_CATEGORIES.includes(categoryParam)) {
    throw errValidation(`Invalid search category: ${categoryParam}`, 'category')
  }

  const limit = isNaN(limitParam) ? 20 : Math.min(Math.max(limitParam, 1), 50)
  const offset = isNaN(offsetParam) ? 0 : Math.max(offsetParam, 0)

  // Empty query returns empty results
  if (!q.trim()) {
    return ok({ query: '', total: 0, categoryCounts: {}, results: [] })
  }

  const result = await GlobalSearchService.search(session, q, {
    category: categoryParam,
    limit,
    offset,
    branchId: branchIdParam,
  })

  return ok(result)
}, { module: 'search' })
