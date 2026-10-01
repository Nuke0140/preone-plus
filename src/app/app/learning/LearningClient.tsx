'use client'

import React from 'react'
import Link from 'next/link'
import { Breadcrumbs } from '@/components/preone/Breadcrumbs'
import { PageHead, EmptyState } from '@/components/preone/ui'
import { TactileButton } from '@/components/preone/TactileMotion'
import { ArrowLeft } from 'lucide-react'

export function LearningClient() {
  return (
    <div className="page-shell space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/app/home' },
          { label: 'PreO Learning' },
        ]}
      />

      <PageHead
        title="PreO Learning"
        eyebrow="Preschool Workspace"
        description="Early childhood curriculum, developmental milestones & interactive learning activities"
        backHref="/app/home"
        actions={
          <Link href="/app/home">
            <TactileButton variant="secondary" size="md">
              <ArrowLeft size={16} className="mr-1.5" />
              Back to Home
            </TactileButton>
          </Link>
        }
      />

      <div className="card p-6 md:p-10">
        <EmptyState
          illustration="curriculum"
          eyebrow="Blank Module"
          title="PreO Learning Workspace"
          description="This module is reserved for PreO Learning. Early childhood curriculum plans, interactive classroom activities, and developmental milestone tracking will be built here."
          action={{
            label: 'Return to Home',
            href: '/app/home',
            variant: 'primary',
          }}
        />
      </div>
    </div>
  )
}
