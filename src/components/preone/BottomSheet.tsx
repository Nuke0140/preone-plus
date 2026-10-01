'use client'

import React, { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

export interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  icon?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  maxHeight?: string
  className?: string
}

export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  maxHeight = '85vh',
  className = '',
}: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const startY = useRef<number>(0)
  const currentY = useRef<number>(0)
  const [translateY, setTranslateY] = useState<number>(0)
  const [isDragging, setIsDragging] = useState<boolean>(false)

  // Focus trap and ESC key dismissal
  useEffect(() => {
    if (!open) {
      setTranslateY(0)
      return
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }

    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'

    const focusTimer = setTimeout(() => {
      panelRef.current?.focus()
    }, 40)

    return () => {
      clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  // Touch handlers for swipe-down dismissal
  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY
    currentY.current = e.touches[0].clientY
    setIsDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    const diff = e.touches[0].clientY - startY.current
    if (diff > 0) {
      // Dragging downward
      setTranslateY(diff)
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    if (translateY > 120) {
      // Threshold passed -> dismiss
      onClose()
    } else {
      // Snap back
      setTranslateY(0)
    }
  }

  if (!open) return null

  return (
    <div
      className="sheet-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Bottom sheet dialog'}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--bg-overlay, rgba(0, 0, 0, 0.5))',
        backdropFilter: 'blur(4px)',
        zIndex: 'var(--z-modal, 600)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        transition: 'opacity 0.25s ease',
      }}
    >
      {/* Backdrop click listener */}
      <div
        style={{ position: 'absolute', inset: 0 }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`bottom-sheet ${className}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '640px',
          margin: '0 auto',
          maxHeight,
          background: 'var(--surface-elevated, #FFFFFF)',
          borderRadius: 'var(--radius-2xl, 24px) var(--radius-2xl, 24px) 0 0',
          boxShadow: 'var(--shadow-modal)',
          display: 'flex',
          flexDirection: 'column',
          transform: `translateY(${translateY}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.7, 0.3, 1)',
          outline: 'none',
          overflow: 'hidden',
          zIndex: 1,
        }}
      >
        {/* Grab Handle */}
        <div
          className="sheet-handle-wrap"
          style={{
            padding: '12px 0 6px',
            display: 'flex',
            justifyContent: 'center',
            cursor: 'grab',
            touchAction: 'none',
          }}
        >
          <div
            className="sheet-handle"
            style={{
              width: '44px',
              height: '5px',
              borderRadius: '999px',
              background: 'var(--border-strong, #CBD5E1)',
              opacity: 0.8,
            }}
          />
        </div>

        {/* Header */}
        {(title || icon) && (
          <div
            className="sheet-head"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 20px 14px',
              borderBottom: '1px solid var(--border-subtle, #EEF2F8)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {icon && (
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius-md, 12px)',
                    background: 'var(--primary-light, #F3EEFF)',
                    color: 'var(--primary, #7C3AED)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {icon}
                </div>
              )}
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {title}
                </h3>
                {subtitle && (
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: 2 }}>
                    {subtitle}
                  </div>
                )}
              </div>
            </div>

            <button
              className="x-btn"
              onClick={onClose}
              aria-label="Close sheet"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: 4,
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Scrollable Body */}
        <div
          className="sheet-body"
          style={{
            padding: '16px 20px',
            overflowY: 'auto',
            flex: 1,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {children}
        </div>

        {/* Sticky Action Footer */}
        {footer && (
          <div
            className="sheet-foot"
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border-subtle, #EEF2F8)',
              background: 'var(--surface, #FFFFFF)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
