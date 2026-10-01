import { withApi } from '@/lib/with-api'
import { NextRequest, NextResponse } from 'next/server'
import { requireApi, isResponse } from '@/lib/auth-api'

/**
 * GET /api/v1/users/import/template — Download canonical CSV template
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'users:read')
  if (isResponse(session)) return session

  const headers = [
    'fullName',
    'email',
    'phone',
    'password',
    'role',
    'roles',
    'branchCode',
    'designation',
    'department',
    'employeeCode',
    'employmentType',
    'status',
  ]

  const sampleRows = [
    [
      'Aarav Sharma',
      'aarav.sharma@school.demo',
      '+919876543210',
      'Preone@123',
      'TEACHER',
      'TEACHER',
      'MAIN',
      'Senior Montessori Teacher',
      'Early Childhood Education',
      'EMP-1001',
      'REGULAR',
      'ACTIVE',
    ],
    [
      'Neha Patel',
      'neha.patel@school.demo',
      '+919876543211',
      'Preone@123',
      'ACCOUNTS',
      'ACCOUNTS',
      'MAIN',
      'Senior Accounts Officer',
      'Finance & Accounts',
      'EMP-1002',
      'REGULAR',
      'ACTIVE',
    ],
    [
      'Pooja Kulkarni',
      'pooja.kulkarni@school.demo',
      '+919876543212',
      'Preone@123',
      'PARENT',
      'PARENT',
      'MAIN',
      '',
      '',
      '',
      '',
      'ACTIVE',
    ],
  ]

  const csvContent = [
    headers.join(','),
    ...sampleRows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')),
  ].join('\r\n')

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="preone_users_template.csv"',
    },
  })
}

export const GET = withApi(_GET)
