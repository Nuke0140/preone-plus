'use client'

// Module-scope side effect: this file is evaluated at bundle-load time on the
// browser, which always precedes React's hydrateRoot pass. That lets us mutate
// the DOM to match what React rendered server-side BEFORE hydration compares
// them, without ever emitting a <script> element into React's tree.
//
// 1. Restore the persisted theme so the very first paint (and hydrate) matches.
// 2. Strip attributes injected by browser extensions (e.g. 1Password's
//    `fdprocessedid`, `data-lp-*`) before hydration, preventing spurious
//    hydration-mismatch warnings on every input/button/select in the app.

if (typeof window !== 'undefined') {
  try {
    const t = localStorage.getItem('preone-theme')
    if (t) document.documentElement.setAttribute('data-theme', t)
  } catch {}

  const BAD_PREFIXES = ['fdprocessedid', 'data-lp-', 'data-frm', 'autocapitalize']
  const MATCHED_ATTRS = [
    'fdprocessedid',
    'data-lp-anchor',
    'data-lp-custom-fields-display',
    'data-lp-mo-localize',
    'data-lp-form-grouped-vault-products',
    'data-lp-form-processing',
    'data-lp-no-op',
    'autocapitalize',
  ]

  function strip(node: Element) {
    const attrs = node.attributes
    if (!attrs) return
    for (let i = attrs.length - 1; i >= 0; i--) {
      const name = attrs[i].name
      if (BAD_PREFIXES.some((p) => name.indexOf(p) === 0)) node.removeAttribute(name)
    }
  }

  strip(document.documentElement)
  try {
    document.querySelectorAll('*').forEach(strip)
  } catch {}

  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes') strip(m.target as Element)
      else if (m.type === 'childList') m.addedNodes.forEach((n) => n.nodeType === 1 && strip(n as Element))
    }
  })
  mo.observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: MATCHED_ATTRS,
    childList: true,
  })
}

export default function PreHydration() {
  return null
}