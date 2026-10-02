import React, { Suspense } from 'react'
import SearchPageClient from './SearchClient'
import { Loader2 } from 'lucide-react'

export const metadata = {
  title: 'Global Search · PreOne',
  description: 'Search across all modules and records in PreOne Enterprise Preschool OS.',
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <Loader2 className="spin" size={32} style={{ margin: '0 auto 12px', color: 'var(--preone-primary)' }} />
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)' }}>Loading Search...</p>
        </div>
      }
    >
      <SearchPageClient />
    </Suspense>
  )
}
