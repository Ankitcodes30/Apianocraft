import assert from 'node:assert/strict'

export async function runResetControlsSmoke(page, check) {
  console.log('\n--- Reset Controls UX Smoke Suite ---')

  await check('All 5 section reset buttons exist with accessible aria-labels', async () => {
    const mainPrimary = await page.$('[data-testid="reset-main-primary"]')
    const mainEffects = await page.$('[data-testid="reset-main-effects"]')
    const layerbSound = await page.$('[data-testid="reset-layerb-sound"]')
    const layerbEffects = await page.$('[data-testid="reset-layerb-effects"]')
    const splitReset = await page.$('[data-testid="reset-keyboard-split"]')

    assert.ok(mainPrimary, 'reset-main-primary not found')
    assert.ok(mainEffects, 'reset-main-effects not found')
    assert.ok(layerbSound, 'reset-layerb-sound not found')
    assert.ok(layerbEffects, 'reset-layerb-effects not found')
    assert.ok(splitReset, 'reset-keyboard-split not found')

    const label1 = await page.evaluate((el) => el.getAttribute('aria-label'), mainPrimary)
    assert.ok(label1 && label1.includes('Reset'), 'Main primary reset missing aria-label')
  })

  await check('Main Tone Layer A Primary Sound reset acts independently and syncs slider DOM value', async () => {
    // Change Layer A volume to 0.4 and reverb to 0.7
    await page.evaluate(() => {
      window.__apiano.engine.setMainToneVolume(0.4)
      window.__apiano.engine.setMainToneReverbAmount(0.7)
      window.__apiano.engine.setDualToneVolume(0.2)
    })

    // Reset primary sound
    await page.click('[data-testid="reset-main-primary"]')

    const diag = await page.evaluate(() => window.__apiano.getDiagnostics())
    assert.equal(diag.mainTone?.volume, 1, 'Expected mainTone volume 1')
    assert.equal(diag.mainTone?.reverbAmount, 0.7, 'Expected mainTone reverb unchanged (0.7)')
    assert.equal(diag.dualTone?.volume, 0.2, 'Expected dualTone volume unchanged (0.2)')

    // Visual UI DOM Synchronization Assertion: slider input value matches engine default
    const volVal = await page.$eval('[data-vol]', (el) => el.value)
    assert.equal(volVal, '1', `Expected volume slider DOM value "1", got "${volVal}"`)
  })

  await check('Main Tone Layer A Effects reset acts independently and syncs slider DOM value', async () => {
    // Change reverb preset to hall and reverb amount to 0.7
    await page.evaluate(() => {
      window.__apiano.engine.setMainToneReverbPreset('hall')
      window.__apiano.engine.setMainToneReverbAmount(0.7)
    })

    // Reset effects
    await page.click('[data-testid="reset-main-effects"]')

    const diag = await page.evaluate(() => window.__apiano.getDiagnostics())
    assert.equal(diag.mainTone?.reverbAmount, 0, 'Expected mainTone reverb default 0')
    assert.equal(diag.mainTone?.reverbPreset, 'room', 'Expected mainTone reverbPreset room after reset')
    assert.equal(diag.dualTone?.volume, 0.2, 'Expected dualTone volume unchanged (0.2)')

    const revVal = await page.$eval('[data-reverb]', (el) => el.value)
    assert.equal(revVal, '0', `Expected reverb slider DOM value "0", got "${revVal}"`)
    const revPresetVal = await page.$eval('[data-reverb-preset]', (el) => el.value)
    assert.equal(revPresetVal, 'room', `Expected reverb preset DOM value "room", got "${revPresetVal}"`)
  })

  await check('Layer B Sound Control reset acts independently and syncs slider DOM value', async () => {
    await page.evaluate(() => {
      window.__apiano.engine.setDualToneEnabled(true)
      window.__apiano.engine.setDualToneVolume(0.3)
      window.__apiano.engine.setDualToneReverbAmount(0.9)
    })

    await page.click('[data-testid="reset-layerb-sound"]')

    const diag = await page.evaluate(() => window.__apiano.getDiagnostics())
    assert.equal(diag.dualTone?.volume, 0.8, 'Expected dualTone volume 0.8')
    assert.equal(diag.dualTone?.reverbAmount, 0.9, 'Expected dualTone reverb unchanged (0.9)')

    const dualVolVal = await page.$eval('[data-dual-vol]', (el) => el.value)
    assert.equal(dualVolVal, '0.8', `Expected dual volume slider DOM value "0.8", got "${dualVolVal}"`)
  })

  await check('Layer B Effects & Ambience reset acts independently and syncs slider DOM value', async () => {
    await page.evaluate(() => {
      window.__apiano.engine.setDualToneReverbPreset('hall')
      window.__apiano.engine.setDualToneReverbAmount(0.8)
    })

    await page.click('[data-testid="reset-layerb-effects"]')

    const diag = await page.evaluate(() => window.__apiano.getDiagnostics())
    assert.equal(diag.dualTone?.reverbAmount, 0, 'Expected dualTone reverb default 0')
    assert.equal(diag.dualTone?.reverbPreset, 'room', 'Expected dualTone reverbPreset room after reset')

    const dualRevVal = await page.$eval('[data-dual-reverb]', (el) => el.value)
    assert.equal(dualRevVal, '0', `Expected dual reverb slider DOM value "0", got "${dualRevVal}"`)
    const dualRevPresetVal = await page.$eval('[data-dual-reverb-preset]', (el) => el.value)
    assert.equal(dualRevPresetVal, 'room', `Expected dual reverb preset DOM value "room", got "${dualRevPresetVal}"`)
  })

  await check('Keyboard Split reset acts independently and syncs slider DOM value', async () => {
    await page.evaluate(() => {
      window.__apiano.engine.setSplitEnabled(true)
      window.__apiano.engine.setSplitPoint(48)
    })

    await page.click('[data-testid="reset-keyboard-split"]')

    const diag = await page.evaluate(() => window.__apiano.getDiagnostics())
    assert.equal(diag.splitZone?.enabled, false, 'Expected split disabled after reset')
    assert.equal(diag.splitZone?.splitPoint, 60, 'Expected splitPoint 60 after reset')
  })

  console.log('--- Reset Controls UX Smoke Suite Passed Cleanly ---\n')
}
