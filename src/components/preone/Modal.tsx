'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  icon?: React.ReactNode
  iconClass?: string
  wide?: boolean
  maxWidth?: string | number
  className?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function Modal({
  open, onClose, title, subtitle, icon, iconClass = 'ic-purple', wide, maxWidth, className, children, footer,
}: ModalProps) {
  const panelRef = React.useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Tab') {
        const panel = panelRef.current
        if (!panel) return
        const focusables = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => el.offsetParent !== null)
        if (focusables.length === 0) {
          e.preventDefault()
          panel.focus()
          return
        }
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    const focusTimer = window.setTimeout(() => {
      panelRef.current?.focus()
    }, 30)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      opener?.focus()
    }
  }, [open, onClose])

  if (!open || !mounted) return null

  return createPortal(
    <div className="ovl" role="dialog" aria-modal="true" aria-label={title}>
      <div className="ovl-backdrop" onClick={onClose} />
      <div
        className={`modal${wide ? ' modal-wide' : ''}${className ? ` ${className}` : ''}`}
        style={maxWidth ? { maxWidth, width: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth } : undefined}
        ref={panelRef}
        tabIndex={-1}
      >
        <div className="modal-head">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {icon && <div className={`modal-icon ${iconClass}`}>{icon}</div>}
            <div>
              <h3>{title}</h3>
              {subtitle && <div className="modal-sub">{subtitle}</div>}
            </div>
          </div>
          <button className="x-btn" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}

export function ConfirmModal({
  open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      icon={danger ? <X /> : <Alert />}
      iconClass={danger ? 'ic-pink' : 'ic-yellow'}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className={`btn ${danger ? 'btn-destructive' : 'btn-primary'}`}
            onClick={() => { onConfirm(); onClose() }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="t-body">{message}</p>
    </Modal>
  )
}

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  icon?: React.ReactNode
  iconClass?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function Drawer({
  open, onClose, title, subtitle, icon, iconClass = 'ic-purple', children, footer,
}: DrawerProps) {
  const panelRef = React.useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Tab') {
        const panel = panelRef.current
        if (!panel) return
        const focusables = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => el.offsetParent !== null)
        if (focusables.length === 0) {
          e.preventDefault()
          panel.focus()
          return
        }
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    const focusTimer = window.setTimeout(() => {
      panelRef.current?.focus()
    }, 30)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      opener?.focus()
    }
  }, [open, onClose])

  if (!open || !mounted) return null

  return createPortal(
    <div className="ovl ovl-drawer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="ovl-backdrop" onClick={onClose} />
      <div className="drawer" ref={panelRef} tabIndex={-1}>
        <div className="drawer-head">
          {icon && <div className={`modal-icon ${iconClass}`}>{icon}</div>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3>{title}</h3>
            {subtitle && <div className="drawer-sub">{subtitle}</div>}
          </div>
          <button className="x-btn" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}

function Alert() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}
