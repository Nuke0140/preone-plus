import { DEFAULT_LOCALE, SupportedLocale, normalizeLocale } from './config'

export function localeFromAcceptLanguage(header: string | null): SupportedLocale | null {
  if (!header) return null
  for (const part of header.split(',')) {
    const tag = part.trim().split(';')[0]
    const locale = normalizeLocale(tag)
    if (tag && locale !== DEFAULT_LOCALE || /^en(?:-|$)/i.test(tag)) return locale
  }
  return null
}

export async function resolveLocale(input?: {
  userId?: string | null
  tenantId?: string | null
  acceptLanguage?: string | null
}): Promise<SupportedLocale> {
  const { db } = await import('@/lib/db')

  if (input?.userId) {
    const user = await db.user.findUnique({ where: { id: input.userId }, select: { locale: true } })
    const userLocale = normalizeLocale(user?.locale)
    if (user?.locale) return userLocale
  }

  if (input?.tenantId) {
    const tenant = await db.tenant.findUnique({ where: { id: input.tenantId }, select: { locale: true } })
    const tenantLocale = normalizeLocale(tenant?.locale)
    if (tenant?.locale) return tenantLocale
  }

  return localeFromAcceptLanguage(input?.acceptLanguage || null) || DEFAULT_LOCALE
}

export function resolveLocaleSync(input?: {
  userLocale?: string | null
  tenantLocale?: string | null
  acceptLanguage?: string | null
}): SupportedLocale {
  if (input?.userLocale) return normalizeLocale(input.userLocale)
  if (input?.tenantLocale) return normalizeLocale(input.tenantLocale)
  return localeFromAcceptLanguage(input?.acceptLanguage || null) || DEFAULT_LOCALE
}
