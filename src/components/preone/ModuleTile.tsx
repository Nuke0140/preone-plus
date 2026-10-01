import Link from 'next/link'
import type { HomeModule } from '@/lib/modules'

/**
 * Clean launcher tile: surface card + icon chip + label.
 * Uses global theme tokens only — no hardcoded colors.
 */
export function ModuleTile({ module: m }: { module: HomeModule }) {
  const Icon = m.icon
  return (
    <Link
      href={m.href}
      className={`tile tile-${m.tileSize}`}
      aria-label={m.label}
      draggable={false}
    >
      <span className="tile-ico">
        <Icon />
      </span>
      <b className="tile-label">{m.label}</b>
    </Link>
  )
}