/**
 * PreOne — Canonical Branding Types & Client Utilities
 * Safe for both Client Components and Server Components.
 */

export interface BrandingConfig {
  primaryColor: string
  accentColor: string
  layout: 'WINDOWS_SHELL' | 'CLASSIC_SIDEBAR'
  bannerUrl: string | null
  logoUrl: string | null
  schoolName?: string
  schoolCode?: string
}

export const PREONE_BRANDING_DEFAULTS: BrandingConfig = {
  primaryColor: '#7C3AED',
  accentColor: '#3B82F6',
  layout: 'WINDOWS_SHELL',
  bannerUrl: null,
  logoUrl: null,
}

/**
 * Validates a HEX color string (#RRGGBB or #RGB)
 */
export function isValidHexColor(color: string | null | undefined): boolean {
  if (!color || typeof color !== 'string') return false
  const trimmed = color.trim()
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(trimmed)
}

/**
 * Calculate relative luminance according to WCAG 2.1 specs
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Convert HEX to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleanHex = hex.trim().replace(/^#/, '')
  if (cleanHex.length === 3) {
    return {
      r: parseInt(cleanHex[0] + cleanHex[0], 16),
      g: parseInt(cleanHex[1] + cleanHex[1], 16),
      b: parseInt(cleanHex[2] + cleanHex[2], 16),
    }
  }
  if (cleanHex.length === 6) {
    return {
      r: parseInt(cleanHex.slice(0, 2), 16),
      g: parseInt(cleanHex.slice(2, 4), 16),
      b: parseInt(cleanHex.slice(4, 6), 16),
    }
  }
  return null
}

/**
 * Contrast check between color and white (for buttons/text)
 * Returns a warning if contrast is weak (ratio < 2.8:1)
 */
export function evaluateColorContrast(primaryHex: string, accentHex: string): {
  isWeakContrast: boolean
  warningMessage: string | null
  primaryOnWhiteRatio: number
} {
  const pRgb = hexToRgb(primaryHex)
  if (!pRgb) {
    return { isWeakContrast: false, warningMessage: null, primaryOnWhiteRatio: 4.5 }
  }

  const pLum = getLuminance(pRgb.r, pRgb.g, pRgb.b)
  const whiteLum = 1.0

  const ratio = (whiteLum + 0.05) / (pLum + 0.05)

  // If text on button (white text on primary background) has ratio < 2.8, it's very light (e.g. yellow, pastel)
  if (ratio < 2.8) {
    return {
      isWeakContrast: true,
      warningMessage: 'Primary color is very light. White button text may be hard to read.',
      primaryOnWhiteRatio: Math.round(ratio * 10) / 10,
    }
  }

  return {
    isWeakContrast: false,
    warningMessage: null,
    primaryOnWhiteRatio: Math.round(ratio * 10) / 10,
  }
}
