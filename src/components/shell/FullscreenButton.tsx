'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'

export interface FullscreenButtonProps {
  className?: string
  showLabel?: boolean
}

/**
 * Reusable Global Fullscreen Action Button
 * Supports standard Fullscreen API with browser vendor fallbacks,
 * responsive labels, keyboard accessibility, and real-time state sync.
 */
export function FullscreenButton({ className = '', showLabel = true }: FullscreenButtonProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSupported, setIsSupported] = useState(true)

  useEffect(() => {
    // Check browser capability
    if (
      typeof document !== 'undefined' &&
      !document.fullscreenEnabled &&
      !(document as any).webkitFullscreenEnabled
    ) {
      setIsSupported(false)
    }

    const onFsChange = () => {
      const active = Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement)
      setIsFullscreen(active)
    }

    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('webkitfullscreenchange', onFsChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('webkitfullscreenchange', onFsChange)
    }
  }, [])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen()
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          await (document.documentElement as any).webkitRequestFullscreen()
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen()
        }
      }
    } catch {
      // Browser permissions or user gesture restriction
    }
  }, [])

  if (!isSupported) return null

  const label = isFullscreen ? 'Exit Full Screen' : 'Full Screen'
  const tooltip = isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'

  return (
    <button
      type="button"
      className={`workspace-action-btn ${className}`.trim()}
      onClick={toggleFullscreen}
      aria-label={label}
      title={tooltip}
      aria-pressed={isFullscreen}
    >
      {isFullscreen ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
      {showLabel && <span className="workspace-action-label">{label}</span>}
    </button>
  )
}
