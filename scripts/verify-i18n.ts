import { strict as assert } from 'node:assert'
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../src/lib/i18n/config'
import { resolveLocaleSync } from '../src/lib/i18n/locale-resolver'
import { apiErrorMessage, notificationText, getCatalog } from '../src/lib/i18n/catalog'
import { getPdfFontConfig } from '../src/lib/i18n/pdf-fonts'

function test(name: string, fn: () => void) {
  fn()
  console.log('PASS', name)
}

test('supported locale set is exactly en-IN, hi-IN, mr-IN', () => {
  assert.deepEqual(SUPPORTED_LOCALES, ['en-IN', 'hi-IN', 'mr-IN'])
  assert.equal(DEFAULT_LOCALE, 'en-IN')
})

test('locale resolution prefers user, then tenant, then Accept-Language', () => {
  assert.equal(resolveLocaleSync({ userLocale: 'mr-IN', tenantLocale: 'hi-IN', acceptLanguage: 'en-IN' }), 'mr-IN')
  assert.equal(resolveLocaleSync({ tenantLocale: 'hi-IN', acceptLanguage: 'en-IN' }), 'hi-IN')
  assert.equal(resolveLocaleSync({ acceptLanguage: 'mr-IN,mr;q=0.9,en;q=0.8' }), 'mr-IN')
  assert.equal(resolveLocaleSync({ acceptLanguage: 'fr-FR' }), 'en-IN')
})

test('catalogs are populated for all supported locales', () => {
  for (const locale of SUPPORTED_LOCALES) {
    assert.ok(Object.keys(getCatalog(locale, 'common')).length > 0)
    assert.ok(Object.keys(getCatalog(locale, 'errors')).length > 0)
    assert.ok(Object.keys(getCatalog(locale, 'notify')).length > 0)
    assert.ok(Object.keys(getCatalog(locale, 'finance')).length > 0)
  }
})

test('API errors localize with fallback safety', () => {
  assert.equal(apiErrorMessage('hi-IN', 'AUTH_001'), 'प्रमाणीकरण आवश्यक है।')
  assert.equal(apiErrorMessage('mr-IN', 'NOT_FOUND_001'), 'विनंती केलेली नोंद सापडली नाही.')
  assert.equal(apiErrorMessage('en-IN', 'DOES_NOT_EXIST', 'Fallback message'), 'Fallback message')
})

test('notification localization resolves placeholders', () => {
  assert.equal(
    notificationText('mr-IN', 'STUDENT_ARRIVAL', 'body', { studentName: 'Aarav', time: '09:15' }),
    'Aarav 09:15 वाजता सुरक्षितपणे शाळेत पोहोचले.'
  )
  assert.equal(
    notificationText('hi-IN', 'FEE_DUE', 'body', { invoiceNo: 'INV-1', amount: '₹500', dueDate: '10 Oct' }),
    'चालान INV-1 की ₹500 राशि 10 Oct तक देय है।'
  )
})

test('PDF font policy requires embedded Unicode font for Devanagari', () => {
  assert.equal(getPdfFontConfig('en-IN').requiresEmbeddedFont, false)
  assert.equal(getPdfFontConfig('hi-IN').requiresEmbeddedFont, true)
  assert.equal(getPdfFontConfig('mr-IN').family, 'Noto Sans Devanagari')
})

console.log('ALL PREONE I18N TESTS PASSED')
