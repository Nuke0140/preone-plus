import { existsSync } from 'node:fs'
import { SupportedLocale } from './config'

export interface PdfFontConfig {
  family: string
  regularPath?: string
  boldPath?: string
  requiresEmbeddedFont: boolean
}

/**
 * PDF generators must embed a Unicode font for Devanagari.
 * Paths can be supplied via PREONE_PDF_FONT_DEVANAGARI_REGULAR/BOLD.
 */
export function getPdfFontConfig(locale: SupportedLocale): PdfFontConfig {
  if (locale === 'en-IN') {
    return { family: 'Helvetica', requiresEmbeddedFont: false }
  }

  const regularPath = process.env.PREONE_PDF_FONT_DEVANAGARI_REGULAR
  const boldPath = process.env.PREONE_PDF_FONT_DEVANAGARI_BOLD

  return {
    family: 'Noto Sans Devanagari',
    regularPath,
    boldPath,
    requiresEmbeddedFont: true,
  }
}

export function assertPdfFontAvailable(locale: SupportedLocale): PdfFontConfig {
  const config = getPdfFontConfig(locale)
  if (config.requiresEmbeddedFont && (!config.regularPath || !existsSync(config.regularPath))) {
    throw new Error(
      'Devanagari PDF font is not configured. Set PREONE_PDF_FONT_DEVANAGARI_REGULAR to a Unicode TTF/OTF font path.'
    )
  }
  return config
}
