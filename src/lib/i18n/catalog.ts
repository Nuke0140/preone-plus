import enCommon from './locales/en/common.json'
import hiCommon from './locales/hi/common.json'
import mrCommon from './locales/mr/common.json'
import enErrors from './locales/en/errors.json'
import hiErrors from './locales/hi/errors.json'
import mrErrors from './locales/mr/errors.json'
import enNotify from './locales/en/notify.json'
import hiNotify from './locales/hi/notify.json'
import mrNotify from './locales/mr/notify.json'
import enFinance from './locales/en/finance.json'
import hiFinance from './locales/hi/finance.json'
import mrFinance from './locales/mr/finance.json'
import { DEFAULT_LOCALE, SupportedLocale } from './config'

const catalogs = {
  'en-IN': { common: enCommon, errors: enErrors, notify: enNotify, finance: enFinance },
  'hi-IN': { common: hiCommon, errors: hiErrors, notify: hiNotify, finance: hiFinance },
  'mr-IN': { common: mrCommon, errors: mrErrors, notify: mrNotify, finance: mrFinance },
} as const

export type CatalogNamespace = keyof typeof catalogs[typeof DEFAULT_LOCALE]
export type CatalogKey<N extends CatalogNamespace> = keyof typeof catalogs[typeof DEFAULT_LOCALE][N] & string

export function getCatalog<N extends CatalogNamespace>(locale: SupportedLocale, namespace: N) {
  return catalogs[locale][namespace]
}

export function translate<N extends CatalogNamespace>(
  locale: SupportedLocale,
  namespace: N,
  key: CatalogKey<N>,
  values: Record<string, string | number> = {}
): string {
  const catalog = catalogs[locale][namespace] as Record<string, string>
  const fallback = catalogs[DEFAULT_LOCALE][namespace] as Record<string, string>
  let text = catalog[key] || fallback[key] || key

  for (const [name, value] of Object.entries(values)) {
    text = text.replace(new RegExp('\\\\{\\\\{' + name + '\\\\}\\\\}', 'g'), String(value))
  }
  return text
}

export function notificationText(
  locale: SupportedLocale,
  eventType: string,
  part: 'title' | 'body',
  values: Record<string, string | number> = {}
) {
  const key = part === 'title' ? eventType + '_TITLE' : eventType
  return translate(locale, 'notify', key as CatalogKey<'notify'>, values)
}

export function apiErrorMessage(
  locale: SupportedLocale,
  code: string,
  fallback?: string
) {
  return translate(locale, 'errors', code as CatalogKey<'errors'>, {}) || fallback || code
}
