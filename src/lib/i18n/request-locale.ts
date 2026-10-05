import { traceStorage } from '@/lib/logger'
import { DEFAULT_LOCALE, SupportedLocale, normalizeLocale } from './config'

export function getActiveLocale(): SupportedLocale {
  return normalizeLocale(traceStorage.getStore()?.locale || DEFAULT_LOCALE)
}
