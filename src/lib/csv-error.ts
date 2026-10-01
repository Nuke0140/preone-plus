/**
 * PreOne Enterprise CSV Error Contract & Export Engine
 * Standardized row-level error reporting with spreadsheet formula injection defense.
 */

import { ErrorClass } from './errors'

export interface CsvImportError {
  traceId: string
  rowNumber: number
  field?: string
  code: string
  class: ErrorClass
  message: string
  severity: 'ERROR' | 'WARNING'
  identifier?: string
  currentValue?: string
  requestedValue?: string
}

const DANGEROUS_FORMULA_CHARS = ['=', '+', '-', '@', '\t', '\r']

/**
 * Sanitizes cell values to neutralize spreadsheet formula injection vulnerabilities (CSV Injection).
 */
export function sanitizeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return ''
  const str = String(val).trim()
  if (str.length > 0 && DANGEROUS_FORMULA_CHARS.includes(str[0])) {
    return `'${str}`
  }
  return str
}

/**
 * Formats an array of CsvImportError records into a standard CSV download string.
 */
export function generateCsvErrorReport(
  errors: CsvImportError[],
  defaultFilename = 'import_validation_errors.csv'
): {
  csvContent: string
  filename: string
  headers: Record<string, string>
} {
  const headers = [
    'Trace ID',
    'Row Number',
    'Identifier',
    'Field',
    'Class',
    'Severity',
    'Error Code',
    'Error Message',
    'Current Value',
    'Requested Value',
  ]

  const rows = errors.map((e) => [
    sanitizeCsvCell(e.traceId),
    sanitizeCsvCell(e.rowNumber),
    sanitizeCsvCell(e.identifier || ''),
    sanitizeCsvCell(e.field || ''),
    sanitizeCsvCell(e.class),
    sanitizeCsvCell(e.severity),
    sanitizeCsvCell(e.code),
    sanitizeCsvCell(e.message),
    sanitizeCsvCell(e.currentValue || ''),
    sanitizeCsvCell(e.requestedValue || ''),
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map((r) => r.map((c) => `"${(c || '').replace(/"/g, '""')}"`).join(',')),
  ].join('\r\n')

  return {
    csvContent,
    filename: defaultFilename,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${defaultFilename}"`,
    },
  }
}
