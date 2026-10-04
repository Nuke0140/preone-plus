export const SUPPORTED_LOCALES = ['en-IN', 'hi-IN', 'mr-IN'] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: SupportedLocale = 'en-IN'

export const LOCALE_METADATA: Record<SupportedLocale, {
  name: string
  nativeName: string
  code: 'en' | 'hi' | 'mr'
  script: 'Latn' | 'Deva'
}> = {
  'en-IN': { name: 'English (India)', nativeName: 'English', code: 'en', script: 'Latn' },
  'hi-IN': { name: 'Hindi', nativeName: 'हिन्दी', code: 'hi', script: 'Deva' },
  'mr-IN': { name: 'Marathi', nativeName: 'मराठी', code: 'mr', script: 'Deva' },
}

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/** Return null for unsupported tags; use normalizeLocale only when a fallback is desired. */
export function supportedLocaleFrom(value?: string | null): SupportedLocale | null {
  if (!value) return null
  const tag = value.trim().replace(/_/g, '-').toLowerCase()
  if (!tag) return null
  if (tag === 'mr' || tag.startsWith('mr-')) return 'mr-IN'
  if (tag === 'hi' || tag.startsWith('hi-')) return 'hi-IN'
  if (tag === 'en' || tag.startsWith('en-')) return 'en-IN'
  return null
}

export function normalizeLocale(value?: string | null): SupportedLocale {
  return supportedLocaleFrom(value) || DEFAULT_LOCALE
}
