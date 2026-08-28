/**
 * Automated smoke tests for Phase 10: Additional Instrument Bank
 * (Electric Piano, Synth Pad, Drawbar Organ, String Ensemble, Synth Brass, Synth Bass).
 */
export async function runPhase10(page, assert) {
  console.log('[smoke] Running Phase 10 Additional Instrument Bank checks...')

  // 1. Instrument Registration check
  const instruments = await page.evaluate(() => window.__apiano.getAvailableInstruments())
  assert(
    'Instrument bank registers at least 8 instruments',
    Array.isArray(instruments) && instruments.length >= 8,
    `count=${instruments.length} ids=${instruments.map((i) => i.id).join(',')}`,
  )

  const expectedIds = ['demo-piano', 'electric-piano', 'synth-pad', 'drawbar-organ', 'string-ensemble', 'synth-brass', 'synth-bass', 'grand-piano']
  for (const id of expectedIds) {
    const found = instruments.some((i) => i.id === id)
    assert(`Instrument "${id}" registered in bank`, found, `id=${id}`)
  }

  // 2. Play note on each new synth instrument
  const testInstruments = ['electric-piano', 'synth-pad', 'drawbar-organ', 'string-ensemble', 'synth-brass', 'synth-bass']
  for (const instId of testInstruments) {
    await page.evaluate((id) => window.__apiano.setInstrument(id), instId)
    await new Promise((r) => setTimeout(r, 100))

    await page.evaluate(() => window.__apiano.noteOn(60, 0.8))
    await new Promise((r) => setTimeout(r, 100))
    const countDuring = await page.evaluate(() => window.__apiano.stats().activeVoices)
    assert(`Instrument "${instId}" spawns sounding voice`, countDuring === 1, `active=${countDuring}`)

    await page.evaluate(() => window.__apiano.noteOff(60))
    const countAfter = await page.evaluate(async () => {
      const api = window.__apiano
      const t0 = performance.now()
      while (performance.now() - t0 < 4000) {
        const s = api.stats()
        if (s.activeVoices === 0) return s.activeVoices
        await new Promise((r) => setTimeout(r, 50))
      }
      return api.stats().activeVoices
    })
    assert(`Instrument "${instId}" note release drains cleanly`, countAfter === 0, `active=${countAfter}`)
  }

  // 3. Multi-instrument Dual & Split Zone integration
  await page.evaluate(async () => {
    await window.__apiano.setInstrument('electric-piano')
    await window.__apiano.dualToneInstrument('string-ensemble')
    window.__apiano.dualToneEnable(true)
  })
  await page.evaluate(() => window.__apiano.noteOn(64, 0.8))
  await new Promise((r) => setTimeout(r, 100))
  const dualVoiceCount = await page.evaluate(() => window.__apiano.stats().activeVoices)
  assert('Multi-instrument Dual Layer (EP + Strings) spawns 2 voices', dualVoiceCount === 2, `active=${dualVoiceCount}`)

  await page.evaluate(() => window.__apiano.noteOff(64))
  await page.evaluate(async () => {
    const api = window.__apiano
    const t0 = performance.now()
    while (performance.now() - t0 < 4000) {
      if (api.stats().activeVoices === 0) return
      await new Promise((r) => setTimeout(r, 50))
    }
  })
  await page.evaluate(() => window.__apiano.dualToneEnable(false))

  // Split zone with Synth Bass lower zone
  await page.evaluate(async () => {
    await window.__apiano.splitSetLowerInstrument('synth-bass')
    window.__apiano.splitSetEnabled(true)
  })
  await page.evaluate(() => window.__apiano.noteOn(36, 0.8)) // Lower zone C2
  await new Promise((r) => setTimeout(r, 100))
  const lowerBassCount = await page.evaluate(() => window.__apiano.stats().activeVoices)
  assert('Split zone lower Synth Bass spawns voice', lowerBassCount === 1, `active=${lowerBassCount}`)

  await page.evaluate(() => window.__apiano.noteOff(36))
  await page.evaluate(async () => {
    const api = window.__apiano
    const t0 = performance.now()
    while (performance.now() - t0 < 4000) {
      if (api.stats().activeVoices === 0) return
      await new Promise((r) => setTimeout(r, 50))
    }
  })
  await page.evaluate(() => window.__apiano.splitSetEnabled(false))

  // 4. Preset load test for new instrument preset
  await page.evaluate(() => window.__apiano.presetLoad('lush-strings-piano'))
  await new Promise((r) => setTimeout(r, 200))
  const loadedMain = await page.evaluate(() => window.__apiano.mainToneState().instrument)
  const loadedDualInst = await page.evaluate(() => window.__apiano.dualToneState().instrument)
  assert('Preset "lush-strings-piano" loads Grand Piano & String Ensemble', (loadedMain === 'grand-piano' || loadedMain === 'Grand Piano') && (loadedDualInst === 'string-ensemble' || loadedDualInst === 'String Ensemble'), `main=${loadedMain} dual=${loadedDualInst}`)

  // Restore default grand preset
  await page.evaluate(() => window.__apiano.presetLoad('default-grand'))
  await new Promise((r) => setTimeout(r, 200))

  const finalDiag = await page.evaluate(() => window.__apiano.stats())
  assert('Final Phase 10 state clean', finalDiag.activeVoices === 0 && finalDiag.dualEnabled === false && finalDiag.splitZone.enabled === false, `active=${finalDiag.activeVoices}`)

  console.log('[smoke] Phase 10 checks complete: all Phase 10 checks passed.')
}
