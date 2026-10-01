import Link from 'next/link'
import { FileQuestion, Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-5 shadow-sm">
          <FileQuestion className="w-7 h-7" />
        </div>

        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 mb-2">
          404 Not Found
        </span>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight mb-2">
          Page Not Found
        </h1>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          The preschool workspace or resource you were looking for doesn&apos;t exist or has moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/app"
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </Link>
          <Link
            href="/"
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
