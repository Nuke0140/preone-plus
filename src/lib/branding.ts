/**
 * PreOne — Canonical Branding Utilities & Types (Client + Server Safe)
 *
 * Single source of truth for School Visual Identity:
 *  - Effective PreOne Defaults:
 *      Primary: #7C3AED
 *      Accent:  #3B82F6
 *      Layout:  WINDOWS_SHELL
 *      Banner:  null (None)
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
 * Returns a warning if contrast is weak (ratio < 3.0:1)
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

/**
 * Convert RGB to HSL
 */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h /= 6
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

/**
 * Convert HSL to HEX
 */
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/**
 * Calculates a readable presentation variant of tenant brand color for Dark Mode.
 * Adjusts perceived lightness by +10% to +15% while keeping the original hue intact.
 */
export function getDarkModeAdaptedColor(hexColor: string, targetBoostPercent = 14): string {
  const rgb = hexToRgb(hexColor)
  if (!rgb) return hexColor
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)

  // If already sufficiently bright (> 68% lightness), no boost needed
  if (hsl.l >= 68) return hexColor

  // Calculate new lightness with +10-15% target boost
  const targetLightness = Math.min(75, Math.max(55, hsl.l + targetBoostPercent))
  return hslToHex(hsl.h, hsl.s, targetLightness)
}
