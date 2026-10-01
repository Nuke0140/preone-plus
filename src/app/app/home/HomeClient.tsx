'use client'

import React, { useMemo, useState, useEffect } from 'react'
import type { Role } from '@/lib/auth'
import type { BrandingConfig } from '@/lib/branding-types'
import { homeModules, type HomeModule } from '@/lib/modules'
import { ModuleCard, PLogoWordmark } from '@/components/preone'

export interface HomeClientProps {
  role: Role
  branding?: BrandingConfig
  user?: {
    name: string
    role: Role
    tenantName: string
  }
}

export function HomeClient({ role, branding, user }: HomeClientProps) {
  const [greeting, setGreeting] = useState('Welcome back')

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good morning')
    else if (hour < 17) setGreeting('Good afternoon')
    else setGreeting('Good evening')
  }, [])

  const modules = useMemo<HomeModule[]>(
    () => homeModules(role).filter((m) => m.key !== 'home'),
    [role]
  )

  const firstName = user?.name ? user.name.split(' ')[0] : 'Educator'

  return (
    <div className="home">
      {/* ── Centered PreOne Brand Logo & Preschool Workspace Context ── */}
      <section className="home-center-hero" aria-label="PreOne Home">
        <div className="home-center-brand">
          {branding?.logoUrl ? (
            <div className="flex flex-col items-center gap-2">
              <img
                src={branding.logoUrl}
                alt={user?.tenantName || 'School Logo'}
                className="h-16 max-h-16 max-w-[260px] object-contain drop-shadow-sm rounded-lg"
              />
            </div>
          ) : (
            <PLogoWordmark subtitle="School OS Plus" />
          )}
        </div>

        {user && (
          <div className="home-context-bar" role="status">
            <span className="home-tenant-badge">
              <span className="home-tenant-dot" aria-hidden="true" />
              {user.tenantName || 'Sunshine Kids Preschool'}
            </span>
            <span className="home-context-sep" aria-hidden="true">•</span>
            <span className="home-greeting">
              {greeting}, <strong className="home-user-name">{firstName}</strong>
            </span>
          </div>
        )}
      </section>

      {/* ── Main Module Grid ── */}
      <main aria-label="Available Modules">
        <div className="module-grid">
          {modules.map((m) => (
            <ModuleCard key={m.key} module={m} />
          ))}
        </div>
        {modules.length === 0 && (
          <div className="home-note">No modules available yet — your little stars are waiting to be added!</div>
        )}
      </main>
    </div>
  )
}