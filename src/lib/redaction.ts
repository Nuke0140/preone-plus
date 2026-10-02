/**
 * PreOne Sensitive Data & Secret Redaction Policy
 * Platform-wide recursive redaction of credentials, PII, and security tokens.
 */

const REDACTION_KEYS = new Set([
  'password',
  'passwordhash',
  'temppassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'jwt',
  'secret',
  'apikey',
  'api_key',
  'pickuppin',
  'pin',
  'otp',
  'cardnumber',
  'cvv',
  'cvc',
  'aadhaar',
  'pan',
  'sessioncookie',
])

const REDACTED_MASK = '[REDACTED]'

/**
 * Checks whether a key matches any sensitive field patterns.
 */
export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_]/g, '')
  if (REDACTION_KEYS.has(normalized)) return true
  for (const sensitive of REDACTION_KEYS) {
    if (normalized.includes(sensitive)) return true
  }
  return false
}

/**
 * Recursively redacts sensitive values from any arbitrary object, array, or primitive.
 * Safe against circular references and non-serializable objects.
 */
export function redactSensitive<T = unknown>(target: T, seen = new WeakSet()): T {
  if (target === null || target === undefined) {
    return target
  }

  if (typeof target !== 'object') {
    return target
  }

  if (seen.has(target as object)) {
    return '[CIRCULAR]' as unknown as T
  }
  seen.add(target as object)

  if (Array.isArray(target)) {
    return target.map((item) => redactSensitive(item, seen)) as unknown as T
  }

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(target as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      result[key] = REDACTED_MASK
    } else if (value && typeof value === 'object') {
      result[key] = redactSensitive(value, seen)
    } else {
      result[key] = value
    }
  }

  return result as T
}
