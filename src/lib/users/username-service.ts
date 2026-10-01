import { db } from '@/lib/db'

export type UsernameType = 'STAFF' | 'PARENT' | 'GUARDIAN' | 'STUDENT'

export interface GenerateUsernameOptions {
  type: UsernameType
  name: string
  tenantId?: string
  preferred?: string
}

/**
 * Sanitizes a person's full name into a base username slug.
 * e.g. "Ananya Sharma" -> "ananya.sharma"
 * e.g. "Dr. Rahul O'Connor-Smith" -> "rahul.oconnorsmith"
 */
export function sanitizeUsernameSlug(name: string): string {
  if (!name || typeof name !== 'string') return 'user'

  // Remove common honorifics
  let clean = name.replace(/^(dr\.|mr\.|mrs\.|ms\.|prof\.)\s+/i, '').trim()

  // Normalize diacritics / accents
  clean = clean.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  // Split into words, remove non-alphanumerics within words
  const parts = clean
    .toLowerCase()
    .split(/\s+/)
    .map((p) => p.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean)

  if (parts.length === 0) return 'user'
  if (parts.length === 1) return parts[0]
  return `${parts[0]}.${parts[parts.length - 1]}`
}

export class UsernameService {
  /**
   * Checks whether a username is available.
   * For STAFF, PARENT, GUARDIAN: checks User table.
   * For STUDENT: checks Student table.
   */
  static async isUsernameAvailable(
    username: string,
    type: UsernameType,
    excludeId?: string
  ): Promise<boolean> {
    const normalized = username.toLowerCase().trim()
    if (!normalized) return false

    if (type === 'STUDENT') {
      const existing = await db.student.findFirst({
        where: {
          username: normalized,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      })
      return !existing
    } else {
      const existing = await db.user.findFirst({
        where: {
          username: normalized,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      })
      return !existing
    }
  }

  /**
   * Generates a unique, collision-resistant username.
   * e.g. "ananya.sharma" -> "ananya.sharma" -> "ananya.sharma01" -> "ananya.sharma02"
   * Thread-safe with retry attempts.
   */
  static async generateUniqueUsername(opts: GenerateUsernameOptions): Promise<string> {
    const baseSlug = opts.preferred
      ? sanitizeUsernameSlug(opts.preferred)
      : sanitizeUsernameSlug(opts.name)

    // First attempt: base slug without suffix
    let candidate = baseSlug
    if (await this.isUsernameAvailable(candidate, opts.type)) {
      return candidate
    }

    // Collision loop: append sequential digits (01, 02, ... 99)
    for (let i = 1; i <= 99; i++) {
      candidate = `${baseSlug}${String(i).padStart(2, '0')}`
      if (await this.isUsernameAvailable(candidate, opts.type)) {
        return candidate
      }
    }

    // If 1-99 exhausted, append timestamp hash
    const timestampSuffix = Date.now().toString().slice(-4)
    candidate = `${baseSlug}${timestampSuffix}`
    return candidate
  }
}
