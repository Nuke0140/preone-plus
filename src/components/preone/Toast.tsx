'use client'

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'
interface ToastAction {
  label: string
  onClick: () => void
}
interface ToastItem {
  id: number
  type: ToastType
  title: string
  body?: string
  action?: ToastAction
  duration?: number
  out?: boolean
}

export interface ToastApi {
  (title: string, type?: ToastType, body?: string): void
  success: (title: string, body?: string, action?: ToastAction) => void
  error: (title: string, body?: string, action?: ToastAction) => void
  warning: (title: string, body?: string, action?: ToastAction) => void
  info: (title: string, body?: string, action?: ToastAction) => void
  /** Success toast with an Undo action. */
  undo: (title: string, body?: string, onUndo?: () => void) => void
}

const ToastCtx = createContext<ToastApi | null>(null)

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 />,
  error: <XCircle />,
  warning: <AlertTriangle />,
  info: <Info />,
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const idRef = useRef(1)

  const push = useCallback((type: ToastType, title: string, body?: string, action?: ToastAction, duration?: number) => {
    const id = idRef.current++
    setItems((prev) => [...prev.slice(-4), { id, type, title, body, action, duration: action ? 8000 : duration }])
    const wait = action ? 8000 : (duration ?? 4200)
    setTimeout(() => {
      setItems((prev) => prev.map((t) => (t.id === id && !t.out ? { ...t, out: true } : t)))
      setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 280)
    }, wait)
  }, [])

  const api = useMemo<ToastApi & ((title: string, type?: ToastType, body?: string) => void)>(() => {
    const fn = (title: string, type: ToastType = 'info', body?: string) => push(type, title, body)
    fn.success = (t: string, b?: string, a?: ToastAction) => push('success', t, b, a)
    fn.error = (t: string, b?: string, a?: ToastAction) => push('error', t, b, a)
    fn.warning = (t: string, b?: string, a?: ToastAction) => push('warning', t, b, a)
    fn.info = (t: string, b?: string, a?: ToastAction) => push('info', t, b, a)
    fn.undo = (t: string, b?: string, onUndo?: () => void) => push('success', t, b, onUndo ? { label: 'Undo', onClick: onUndo } : undefined)
    return fn as any
  }, [push])

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast t-${t.type}${t.out ? ' out' : ''}`}>
            <span className="t-ic">{ICONS[t.type]}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{t.title}</b>
              {t.body && <p>{t.body}</p>}
              {t.action && (
                <button
                  className="btn btn-sm btn-primary"
                  style={{ marginTop: 8, padding: '3px 12px', fontSize: 12 }}
                  onClick={() => {
                    t.action!.onClick()
                    setItems((prev) => prev.map((x) => (x.id === t.id ? { ...x, out: true } : x)))
                    setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 280)
                  }}
                >
                  {t.action!.label}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
