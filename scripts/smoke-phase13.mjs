/**
 * Automated smoke test for Phase 13: Production Hardening & PWA Deployment.
 *
 * Verifies:
 * - PWA Service Worker support diagnostic snapshot
 * - Offline status banner component DOM toggle on network state change
 * - Error Boundary UI isolation and teardown clean state
 */
export async function runPhase13(page, assert) {
  console.log('[smoke] Running Phase 13 Production Hardening checks...')

  // 1. PWA Environment Diagnostics
  const pwaSnap = await page.evaluate(() => window.__apiano.pwaSnapshot())
  assert('Service Worker browser API supported', pwaSnap.serviceWorkerSupported === true, `sw=${pwaSnap.serviceWorkerSupported}`)
  assert('Initial network state online', pwaSnap.onLine === true, `onLine=${pwaSnap.onLine}`)

  // 2. Offline Status Banner DOM Toggle
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  const offlineBannerPresent = await page.evaluate(() => !!document.querySelector('[data-offline-banner]'))
  assert('Offline status banner displays on offline event', offlineBannerPresent === true, `present=${offlineBannerPresent}`)

  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  const offlineBannerCleared = await page.evaluate(() => !document.querySelector('[data-offline-banner]'))
  assert('Offline status banner clears on online event', offlineBannerCleared === true, `cleared=${offlineBannerCleared}`)

  // 3. Error Boundary Baseline Verification
  const errorBoundariesActive = await page.evaluate(() => document.querySelectorAll('[data-error-boundary]').length)
  assert('Zero UI Error Boundaries triggered in healthy app state', errorBoundariesActive === 0, `active=${errorBoundariesActive}`)

  const finalSnap = await page.evaluate(() => window.__apiano.stats())
  assert('Final Phase 13 engine state clean', finalSnap.activeVoices === 0, `active=${finalSnap.activeVoices}`)

  console.log('[smoke] Phase 13 checks complete: all Phase 13 checks passed.')
}
