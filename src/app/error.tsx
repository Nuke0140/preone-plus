'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw, Home, Copy, Check } from 'lucide-react'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string; traceId?: string }
  reset: () => void
}) {
  const [copied, setCopied] = useState(false)
  const referenceId = error.digest || error.traceId || 'PRE-' + Math.random().toString(16).slice(2, 10).toUpperCase()

  useEffect(() => {
    console.error('Error boundary caught error:', error)
    try {
      fetch('/api/v1/system/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error?.message,
          stack: error?.stack,
          digest: error?.digest,
          referenceId,
          url: typeof window !== 'undefined' ? window.location.href : '',
        }),
      }).catch(() => {})
    } catch {}
  }, [error, referenceId])

  const copyTrace = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(referenceId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-5 shadow-sm">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <h1 className="text-xl font-bold text-slate-900 tracking-tight mb-2">
          Something went unexpected
        </h1>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          An error occurred while loading this page. School operations and data are safe. Please try refreshing or sharing the reference code below with support.
        </p>

        {error?.message && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl mb-4 text-left font-mono break-words">
            <div><strong>Error:</strong> {error.message}</div>
            {error.stack && (
              <pre className="mt-2 text-[10px] whitespace-pre-wrap opacity-75 max-h-48 overflow-y-auto">
                {error.stack}
              </pre>
            )}
          </div>
        )}

        <div className="bg-slate-100/80 rounded-xl p-3 mb-6 border border-slate-200/80 flex items-center justify-between">
          <div className="text-left">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-600 block">
              Reference ID
            </span>
            <span className="text-xs font-mono font-bold text-slate-800">
              {referenceId}
            </span>
          </div>
          <button
            onClick={copyTrace}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
            title="Copy Reference ID"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => reset()}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <Link
            href="/app"
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
