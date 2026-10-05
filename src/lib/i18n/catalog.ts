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

type CatalogShape = {
  common: typeof enCommon
  errors: typeof enErrors
  notify: typeof enNotify
  finance: typeof enFinance
}

// Compile-time parity: every supported locale must contain every English key.
const hiCatalog: CatalogShape = { common: hiCommon, errors: hiErrors, notify: hiNotify, finance: hiFinance }
const mrCatalog: CatalogShape = { common: mrCommon, errors: mrErrors, notify: mrNotify, finance: mrFinance }

const catalogs: Record<SupportedLocale, CatalogShape> = {
  'en-IN': { common: enCommon, errors: enErrors, notify: enNotify, finance: enFinance },
  'hi-IN': hiCatalog,
  'mr-IN': mrCatalog,
}

export type CatalogNamespace = keyof CatalogShape
export type CatalogKey<N extends CatalogNamespace> = keyof CatalogShape[N] & string

export function getCatalog<N extends CatalogNamespace>(locale: SupportedLocale, namespace: N): CatalogShape[N] {
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
    text = text.split('{{' + name + '}}').join(String(value))
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
  const key = code as CatalogKey<'errors'>
  const message = translate(locale, 'errors', key, {})
  return message === key ? (fallback || code) : message
}
