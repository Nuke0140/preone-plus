'use client'

import React, { useState, useEffect } from 'react'
import { Calendar } from 'lucide-react'

export interface DockDateTimeProps {
  className?: string
  showIcon?: boolean
}

function getFormattedDateTime() {
  const now = new Date()
  return {
    time: now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    date: now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }),
  }
}

/**
 * Reusable client-side DateTime component for the PreOne Dock.
 * Mounts cleanly on client to eliminate SSR locale and timezone hydration mismatch.
 * Updates independently every second without re-rendering parent shell.
 */
export function DockDateTime({ className = '', showIcon = true }: DockDateTimeProps) {
  const [dateTime, setDateTime] = useState<{ time: string; date: string } | null>(null)

  useEffect(() => {
    // Sync client local time once mounted
    setDateTime(getFormattedDateTime())
    const interval = setInterval(() => {
      setDateTime(getFormattedDateTime())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      suppressHydrationWarning
      className={`dock-datetime ${className}`.trim()}
      aria-label={dateTime ? `Current time: ${dateTime.time}, ${dateTime.date}` : 'Current date and time'}
      role="status"
    >
      {showIcon && (
        <span className="dock-dt-icon" aria-hidden="true">
          <Calendar size={14} />
        </span>
      )}
      <div className="dock-dt-text" suppressHydrationWarning>
        <span className="dock-time" suppressHydrationWarning>
          {dateTime ? dateTime.time : '4:55 PM'}
        </span>
        <span className="dock-date" suppressHydrationWarning>
          {dateTime ? dateTime.date : 'Wed, 18 Sept'}
        </span>
      </div>
    </div>
  )
}
