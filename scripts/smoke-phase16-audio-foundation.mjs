import assert from 'node:assert/strict'

export async function runPhase16AudioFoundation(page, check) {
  console.log('\n--- Phase 16 Audio Foundation Smoke Suite ---')

  await check('Attack and Release envelope parameters set and update main tone targets', async () => {
    await page.evaluate(() => {
      window.__apiano.engine.setMainToneAttack(0.15)
      window.__apiano.engine.setMainToneRelease(0.85)
    })

    const diag = await page.evaluate(() => window.__apiano.getDiagnostics())
    assert.equal(diag.mainTone?.attackTime, 0.15, `Expected attackTime 0.15, got ${diag.mainTone?.attackTime}`)
    assert.equal(diag.mainTone?.releaseTime, 0.85, `Expected releaseTime 0.85, got ${diag.mainTone?.releaseTime}`)
  })

  await check('Attack and Release envelope bounds are safely clamped', async () => {
    await page.evaluate(() => {
      window.__apiano.engine.setMainToneAttack(-0.5) // Clamps to 0.001
      window.__apiano.engine.setMainToneRelease(10.0) // Clamps to 5.0
    })

    const diag = await page.evaluate(() => window.__apiano.getDiagnostics())
    assert.equal(diag.mainTone?.attackTime, 0.001, `Expected clamped attackTime 0.001, got ${diag.mainTone?.attackTime}`)
    assert.equal(diag.mainTone?.releaseTime, 5.0, `Expected clamped releaseTime 5.0, got ${diag.mainTone?.releaseTime}`)

    // Restore defaults
    await page.evaluate(() => {
      window.__apiano.engine.setMainToneAttack(0.005)
      window.__apiano.engine.setMainToneRelease(0.3)
    })
  })

  console.log('--- Phase 16 Audio Foundation Smoke Suite Passed Cleanly ---\n')
}
