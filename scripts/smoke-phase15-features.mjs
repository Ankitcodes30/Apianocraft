import assert from 'node:assert/strict'

export async function runPhase15Features(page, check) {
  console.log('\n--- Phase 15 Multi-Feature & Workstation Upgrade Smoke Suite ---')

  // 1. Theme System Verification
  await check('Theme selector is rendered in top dock', async () => {
    const selector = await page.$('[data-theme-select]')
    assert.ok(selector, 'Theme selector [data-theme-select] not found')
  })

  await check('Theme switching updates document data-theme attribute', async () => {
    // Select dark mode
    await page.select('[data-theme-select]', 'dark')
    let themeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    assert.equal(themeAttr, 'dark', `Expected data-theme="dark", got "${themeAttr}"`)

    // Select light mode
    await page.select('[data-theme-select]', 'light')
    themeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    assert.equal(themeAttr, 'light', `Expected data-theme="light", got "${themeAttr}"`)

    // Select system mode
    await page.select('[data-theme-select]', 'system')
    const modeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme-mode'))
    assert.equal(modeAttr, 'system', `Expected data-theme-mode="system", got "${modeAttr}"`)
  })

  await check('Professional Brand Logo mark and wordmark render cleanly in top header', async () => {
    const logo = await page.$('[aria-label="Apianocraft Digital Piano Workstation Logo"]')
    assert.ok(logo, 'Brand logo [aria-label="Apianocraft Digital Piano Workstation Logo"] not found')
    const svg = await logo.$('svg')
    assert.ok(svg, 'Brand logo SVG mark not found inside logo container')
  })

  // 2. Portamento / Glide Verification
  await check('Portamento controls toggle and update engine state', async () => {
    // Click FX tab to reveal Portamento panel
    const fxTab = await page.$('button[role="tab"]:nth-child(2)')
    if (fxTab) await fxTab.click()

    const toggle = await page.$('[data-portamento-toggle]')
    assert.ok(toggle, 'Portamento toggle button not found')

    await toggle.click()
    let diag = await page.evaluate(() => window.__apiano.getDiagnostics())
    assert.equal(diag.portamento?.enabled, true, 'Expected portamento.enabled = true')

    // Change glide time
    await page.select('[data-portamento-time]', '200')
    diag = await page.evaluate(() => window.__apiano.getDiagnostics())
    assert.equal(diag.portamento?.timeMs, 200, 'Expected portamento.timeMs = 200')

    // Toggle off
    await toggle.click()
    diag = await page.evaluate(() => window.__apiano.getDiagnostics())
    assert.equal(diag.portamento?.enabled, false, 'Expected portamento.enabled = false')
  })

  // 3. Arpeggiator Verification
  await check('Arpeggiator controls toggle and update engine state', async () => {
    const toggle = await page.$('[data-arp-toggle]')
    assert.ok(toggle, 'Arpeggiator toggle button not found')

    await toggle.click()
    let diag = await page.evaluate(() => window.__apiano.getDiagnostics())
    assert.equal(diag.arpeggiator?.enabled, true, 'Expected arpeggiator.enabled = true')

    // Change rate
    await page.select('[data-arp-rate]', '1/16')
    diag = await page.evaluate(() => window.__apiano.getDiagnostics())
    assert.equal(diag.arpeggiator?.rate, '1/16', 'Expected arpeggiator.rate = 1/16')

    // Change direction
    await page.select('[data-arp-direction]', 'up-down')
    diag = await page.evaluate(() => window.__apiano.getDiagnostics())
    assert.equal(diag.arpeggiator?.direction, 'up-down', 'Expected arpeggiator.direction = up-down')

    // Toggle off
    await toggle.click()
    diag = await page.evaluate(() => window.__apiano.getDiagnostics())
    assert.equal(diag.arpeggiator?.enabled, false, 'Expected arpeggiator.enabled = false')
  })

  // 4. Visual Key Release Latency Verification
  await check('Piano key visual highlight turns off immediately on keyup', async () => {
    const keyC4 = await page.$('[data-midi="60"]')
    assert.ok(keyC4, 'C4 key element [data-midi="60"] not found')

    // Trigger noteOn
    await page.evaluate(() => window.__apiano.noteOn(60, 0.8))
    let hasActive = await page.evaluate(
      (el) => el.classList.contains('ap-key--active'),
      keyC4,
    )
    assert.equal(hasActive, true, 'Expected C4 key to have .ap-key--active on noteOn')

    // Trigger noteOff
    await page.evaluate(() => window.__apiano.noteOff(60))
    hasActive = await page.evaluate(
      (el) => el.classList.contains('ap-key--active'),
      keyC4,
    )
    assert.equal(
      hasActive,
      false,
      'Expected C4 key .ap-key--active to be removed immediately on noteOff',
    )
  })

  // 5. Main Tone Instrument Selector Verification
  await check('Main Tone instrument dropdown updates engine state, note spawning, and remains synchronized', async () => {
    // Navigate to Tone & Layers tab if not active
    const toneTab = await page.$('button[role="tab"]:nth-child(1)')
    if (toneTab) await toneTab.click()

    const mainSelect = await page.$('[data-instrument-select]')
    assert.ok(mainSelect, 'Main Tone instrument selector [data-instrument-select] not found')

    // Initial state check
    let engineInst = await page.evaluate(() => window.__apiano.engine.instrumentId)
    let uiVal = await page.evaluate((el) => el.value, mainSelect)
    assert.equal(uiVal, engineInst, `UI select value (${uiVal}) must match engine instrumentId (${engineInst})`)

    // Change Grand Piano -> Electric Piano via UI dropdown
    await page.select('[data-instrument-select]', 'electric-piano')
    await new Promise((r) => setTimeout(r, 200)) // Wait for load

    engineInst = await page.evaluate(() => window.__apiano.engine.instrumentId)
    uiVal = await page.evaluate((el) => el.value, mainSelect)
    assert.equal(engineInst, 'electric-piano', `Expected engine instrument = electric-piano, got ${engineInst}`)
    assert.equal(uiVal, 'electric-piano', `Expected UI select value = electric-piano, got ${uiVal}`)

    // Verify newly triggered note spawns voice on electric-piano
    await page.evaluate(() => window.__apiano.noteOn(60, 0.8))
    let activeVoices = await page.evaluate(() => window.__apiano.stats().activeVoices)
    assert.ok(activeVoices > 0, 'Expected active voice for note C4')
    await page.evaluate(() => window.__apiano.noteOff(60))

    // Change Electric Piano -> Synth Pad via UI dropdown
    await page.select('[data-instrument-select]', 'synth-pad')
    await new Promise((r) => setTimeout(r, 200))

    engineInst = await page.evaluate(() => window.__apiano.engine.instrumentId)
    uiVal = await page.evaluate((el) => el.value, mainSelect)
    assert.equal(engineInst, 'synth-pad', `Expected engine instrument = synth-pad, got ${engineInst}`)
    assert.equal(uiVal, 'synth-pad', `Expected UI select value = synth-pad, got ${uiVal}`)

    // Verify Dual Tone instrument remained unchanged
    const dualInst = await page.evaluate(() => window.__apiano.engine.dualInstrumentId)
    assert.notEqual(dualInst, 'synth-pad', 'Dual tone instrument must remain independent when Main Tone changes')

    // Restore to grand-piano
    await page.select('[data-instrument-select]', 'grand-piano')
    await new Promise((r) => setTimeout(r, 200))
  })

  // 6. Split / Lower Zone Instrument Selector & Engine Independence Verification
  await check('Split Lower Zone instrument dropdown updates lower zone engine state and leaves Main and Dual tones unchanged', async () => {
    // Enable split mode
    await page.evaluate(() => window.__apiano.splitSetEnabled(true))

    // Navigate to Tone & Layers tab if not active
    const toneTab = await page.$('button[role="tab"]:nth-child(1)')
    if (toneTab) await toneTab.click()

    const lowerSelect = await page.$('[data-testid="lower-instrument-select"]')
    assert.ok(lowerSelect, 'Lower Zone instrument selector [data-testid="lower-instrument-select"] not found')

    // Verify all registered instruments are present as options
    const optionCount = await page.evaluate((el) => el.options.length, lowerSelect)
    const availableInstCount = await page.evaluate(() => window.__apiano.engine.getInstruments().length)
    assert.equal(optionCount, availableInstCount, `Dropdown options count (${optionCount}) must match registered instruments (${availableInstCount})`)

    // Store baseline Main Tone & Dual Tone instruments
    const mainBefore = await page.evaluate(() => window.__apiano.engine.instrumentId)
    const dualBefore = await page.evaluate(() => window.__apiano.engine.dualInstrumentId)

    // Select 'synth-bass' for Lower Zone via dropdown
    await page.select('[data-testid="lower-instrument-select"]', 'synth-bass')
    await new Promise((r) => setTimeout(r, 150))

    // Verify Lower Zone engine state updated
    const lowerEngineInst = await page.evaluate(() => window.__apiano.splitGetState().instrument)
    const lowerUiVal = await page.evaluate((el) => el.value, lowerSelect)
    assert.equal(lowerEngineInst, 'synth-bass', `Expected Lower Zone engine instrument = synth-bass, got ${lowerEngineInst}`)
    assert.equal(lowerUiVal, 'synth-bass', `Expected Lower Zone UI select value = synth-bass, got ${lowerUiVal}`)

    // Verify Main Tone and Dual Tone remained unchanged
    const mainAfter = await page.evaluate(() => window.__apiano.engine.instrumentId)
    const dualAfter = await page.evaluate(() => window.__apiano.engine.dualInstrumentId)
    assert.equal(mainAfter, mainBefore, 'Main Tone instrument must remain unchanged when Lower Zone instrument changes')
    assert.equal(dualAfter, dualBefore, 'Dual Tone instrument must remain unchanged when Lower Zone instrument changes')

    // Trigger a Lower Zone note (note 48 < splitPoint 60) and verify voice spawns
    await page.evaluate(() => window.__apiano.noteOn(48, 0.8))
    const lowerActive = await page.evaluate(() => window.__apiano.stats().activeVoices)
    assert.ok(lowerActive > 0, 'Lower zone note on synth-bass must spawn active voice')
    await page.evaluate(() => window.__apiano.noteOff(48))

    // Disable split mode and clean up
    await page.evaluate(() => window.__apiano.splitSetEnabled(false))
  })

  // 7. Regression Assertion: Normal Note Input is Unquantized & Unfiltered
  await check('Raw note input (e.g. C#4 = 61) plays exact pitch directly without scale-quantization', async () => {
    // Trigger C#4 (61) via QWERTY key '2'
    await page.evaluate(() => window.__apiano.qwertyKey('down', '2'))
    const voices = await page.evaluate(() => window.__apiano.voices())
    assert.ok(voices.length > 0, 'Triggering QWERTY key "2" (C#4) must spawn an active voice')
    const actualMidi = voices[0]?.midiNote
    assert.equal(actualMidi, 61, `Note input must remain exact raw MIDI pitch 61 (unquantized), got ${actualMidi}`)

    // Release key '2'
    await page.evaluate(() => window.__apiano.qwertyKey('up', '2'))
    await new Promise((r) => setTimeout(r, 100))
    const afterRelease = await page.evaluate(() => window.__apiano.stats().activeVoices)
    assert.equal(afterRelease, 0, 'Active voices must drain cleanly to 0 after keyup')
  })

  console.log('--- Phase 15 Smoke Suite Passed Cleanly ---\n')
}



