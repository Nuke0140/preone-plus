/** PreOne formatting utilities — Indian rupee, dates, labels */

/** Money is stored as integer paise. Display in ₹ (en-IN). */
export function inr(paise: number, opts?: { compact?: boolean }): string {
  const rupees = paise / 100
  if (opts?.compact && rupees >= 100000) {
    if (rupees >= 10000000) return `₹${(rupees / 10000000).toFixed(2)} Cr`
    return `₹${(rupees / 100000).toFixed(2)} L`
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: rupees % 1 === 0 ? 0 : 2,
  }).format(rupees)
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function timeAgo(d: string | Date): string {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 30) return `${days}d ago`
  return fmtDate(d)
}

export function isoDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10)
}

/** Title-case an UPPER_SNAKE enum value → "PARTIALLY_PAID" → "Partially Paid" */
export function enumLabel(v: string | null | undefined): string {
  if (!v) return '—'
  return v
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function initials(name?: string | null): string {
  if (!name || typeof name !== 'string') return '?'
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

const AVATAR_CLASSES = ['a-p', 'a-b', 'a-k', 'a-o', 'a-g', 'a-c', 'a-y', 'a-n']
export function avatarClass(seed?: string | null): string {
  if (!seed || typeof seed !== 'string') return AVATAR_CLASSES[0]!
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_CLASSES[h % AVATAR_CLASSES.length]!
}
