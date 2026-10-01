'use client'

import React from 'react'
import { HelpCircle } from 'lucide-react'

export interface HelpButtonProps {
  onClick: () => void
  className?: string
  showLabel?: boolean
}

/**
 * Reusable Global Help Action Button
 * Triggers the PreOne interactive keyboard shortcuts & help guide modal.
 */
export function HelpButton({ onClick, className = '', showLabel = true }: HelpButtonProps) {
  return (
    <button
      type="button"
      className={`workspace-action-btn ${className}`.trim()}
      onClick={onClick}
      aria-label="Help and keyboard shortcuts"
      title="Help & keyboard shortcuts (?)"
    >
      <HelpCircle size={16} aria-hidden="true" />
      {showLabel && <span className="workspace-action-label">Help</span>}
    </button>
  )
}
