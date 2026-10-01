'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export function RouteProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pct, setPct] = useState(0)
  const [visible, setVisible] = useState(false)
  const timers = useRef<number[]>([])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    timers.current.forEach(clearTimeout)
    timers.current = []
    setVisible(true)
    setPct(0)

    timers.current.push(
      window.setTimeout(() => setPct(30), 50),
      window.setTimeout(() => setPct(65), 180),
      window.setTimeout(() => setPct(88), 400),
      window.setTimeout(() => setPct(100), 650),
      window.setTimeout(() => { setVisible(false); setPct(0) }, 850),
    )
    /* eslint-enable react-hooks/set-state-in-effect */

    return () => { timers.current.forEach(clearTimeout); timers.current = [] }
  }, [pathname, searchParams.toString()])

  if (!visible) return null

  return (
    <div
      style={{ position: 'fixed', inset: '0 0 auto', zIndex: 9999, pointerEvents: 'none' }}
      role="progressbar"
      aria-hidden="true"
    >
      <div
        style={{
          height: 3,
          width: `${pct}%`,
          background: 'linear-gradient(90deg,var(--primary),var(--info))',
          transition: 'width 200ms ease-out',
          boxShadow: '0 0 10px var(--primary)',
          borderRadius: '0 2px 2px 0',
        }}
      />
    </div>
  )
}