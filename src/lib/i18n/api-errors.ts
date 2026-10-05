import { NextRequest } from 'next/server'
import { fail } from './api'
import { resolveLocale } from './i18n/locale-resolver'
import { apiErrorMessage } from './i18n/catalog'

export async function localizedBadRequest(
  req: NextRequest,
  code: string,
  fallback?: string,
  field?: string
) {
  const locale = await resolveLocale({ acceptLanguage: req.headers.get('accept-language') })
  return fail(code, apiErrorMessage(locale, code, fallback), 400, field)
}

export async function localizedUnauthorized(req: NextRequest, code = 'AUTH_001') {
  const locale = await resolveLocale({ acceptLanguage: req.headers.get('accept-language') })
  return fail(code, apiErrorMessage(locale, code), 401)
}
