import React from 'react'
import { PLogoMark } from '@/components/preone/PLogo'

export interface AuthBrandProps {
  tagline?: string
  logoSize?: number
  className?: string
  logoUrl?: string | null
  schoolName?: string
}

/**
 * Reusable AuthBrand component.
 * Displays the school's configured logo if available, or falls back to
 * the authentic PreOne brand mark with generous breathing room.
 */
export function AuthBrand({
  tagline = 'Nurturing Little Futures',
  logoSize = 62,
  className = '',
  logoUrl,
  schoolName,
}: AuthBrandProps) {
  return (
    <div className={`auth-brand text-center mb-6 relative z-10 ${className}`}>
      {/* Product Brand Anchor with generous breathing room */}
      <div className="flex justify-center mb-3.5 transition-transform duration-300 hover:scale-105">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={schoolName || 'School Logo'}
            className="h-16 max-h-16 max-w-[220px] object-contain rounded-lg drop-shadow-sm"
          />
        ) : (
          <PLogoMark size={logoSize} />
        )}
      </div>

      {/* Brand Tagline Badge */}
      {tagline && (
        <div className="flex justify-center">
          <span className="inline-flex items-center text-xs font-semibold tracking-wide text-purple-700 dark:text-purple-300 bg-purple-50/90 dark:bg-purple-950/60 px-3.5 py-1 rounded-full border border-purple-200/70 dark:border-purple-800/60 shadow-2xs">
            {tagline}
          </span>
        </div>
      )}
    </div>
  )
}
