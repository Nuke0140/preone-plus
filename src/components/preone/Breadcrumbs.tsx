import React from 'react'
import Link from 'next/link'

export interface Crumb {
  label: string
  href?: string
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav className={`breadcrumbs${className ? ` ${className}` : ''}`} aria-label="Breadcrumb">
      {items.map((c, i) => {
        const last = i === items.length - 1
        return (
          <React.Fragment key={`${c.label}-${i}`}>
            {i > 0 && <span className="bc-sep" aria-hidden="true">›</span>}
            {last || !c.href ? (
              <span className={`bc-item${last ? ' bc-current' : ''}`} aria-current={last ? 'page' : undefined}>
                {c.label}
              </span>
            ) : (
              <Link className="bc-item bc-link" href={c.href}>{c.label}</Link>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}