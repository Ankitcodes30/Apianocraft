import assert from 'node:assert/strict'

export async function runMousePerformanceSmoke(page, check) {
  console.log('\n--- Mouse Performance Pitch + Modulation Smoke Suite ---')

  await check('Mouse Performance toggle and harness functions exist', async () => {
    const isEnabled = await page.evaluate(() => window.__apiano.mousePerfIsEnabled())
    assert.equal(typeof isEnabled, 'boolean', 'mousePerfIsEnabled must return boolean')
    const btn = await page.$('[data-btn-mouse-perf]')
    assert.ok(btn, 'Mouse Performance toggle button [data-btn-mouse-perf] must exist in header')
  })

  await check('Disabled mouse performance: movement does nothing', async () => {
    await page.evaluate(() => window.__apiano.mousePerfSetEnabled(false))
    await page.evaluate(() => {
      window.__apiano.mousePerfEnter(100, 100)
      window.__apiano.mousePerfMove(300, 50)
    })
    const state = await page.evaluate(() => window.__apiano.mousePerfGetState())
    assert.equal(state.active, false, 'Inactive when disabled')
    assert.equal(state.pitchBend, 0, 'Pitch bend must remain 0 when disabled')
    assert.equal(state.modulation, 0, 'Modulation must remain 0 when disabled')

    // Re-enable for subsequent checks
    await page.evaluate(() => window.__apiano.mousePerfSetEnabled(true))
  })

  await check('Dwell-based settling: entry starts 350ms settling period without immediate origin or parameter jump', async () => {
    await page.evaluate(() => {
      window.__apiano.mousePerfLeave()
      window.__apiano.mousePerfEnter(200, 200)
    })
    let state = await page.evaluate(() => window.__apiano.mousePerfGetState())
    assert.equal(state.active, true, 'Active on enter')
    assert.equal(state.settling, true, 'Settling state active on enter')
    assert.equal(state.hasOrigin, false, 'Origin MUST NOT be established immediately on enter')
    assert.equal(state.pitchBend, 0, 'Pointer enter must NOT immediately alter pitch bend')
    assert.equal(state.modulation, 0, 'Pointer enter must NOT immediately alter modulation')

    const activeVoices = await page.evaluate(() => window.__apiano.stats().activeVoices)
    assert.equal(activeVoices, 0, 'Pointer enter/hover must NEVER trigger notes')

    // Wait for entry dwell (350ms)
    await new Promise((r) => setTimeout(r, 400))
    state = await page.evaluate(() => window.__apiano.mousePerfGetState())
    assert.equal(state.settling, false, 'Settling completed after 350ms dwell')
    assert.equal(state.hasOrigin, true, 'Origin established after 350ms dwell')
    assert.equal(state.originX, 200, 'OriginX established at entry point 200')
    assert.equal(state.originY, 200, 'OriginY established at entry point 200')
  })

  await check('Jitter tolerance: movement > 5px during settling restarts 350ms dwell timer', async () => {
    await page.evaluate(() => {
      window.__apiano.mousePerfLeave()
      window.__apiano.mousePerfEnter(200, 200)
    })
    await new Promise((r) => setTimeout(r, 200)) // Wait 200ms (<350ms)

    // Move 15px (> 5px tolerance)
    await page.evaluate(() => window.__apiano.mousePerfMove(215, 200))
    let state = await page.evaluate(() => window.__apiano.mousePerfGetState())
    assert.equal(state.settling, true, 'Still settling after move beyond tolerance')
    assert.equal(state.candidateX, 215, 'Candidate point updated to 215')
    assert.equal(state.hasOrigin, false, 'Origin NOT established yet due to timer restart')

    // Wait another 200ms (total 400ms from start, but only 200ms from restart -> still settling)
    await new Promise((r) => setTimeout(r, 200))
    state = await page.evaluate(() => window.__apiano.mousePerfGetState())
    assert.equal(state.hasOrigin, false, 'Origin NOT established after 200ms from restart')

    // Wait remaining 200ms (total >350ms from restart)
    await new Promise((r) => setTimeout(r, 200))
    state = await page.evaluate(() => window.__apiano.mousePerfGetState())
    assert.equal(state.hasOrigin, true, 'Origin established at candidate point after full 350ms dwell')
    assert.equal(state.originX, 215, 'OriginX set to restarted candidate 215')
  })

  await check('Micro-jitter <= 5px tolerance does NOT restart dwell timer', async () => {
    await page.evaluate(() => {
      window.__apiano.mousePerfLeave()
      window.__apiano.mousePerfEnter(300, 300)
    })
    await new Promise((r) => setTimeout(r, 200))

    // Micro jitter 2px (<= 5px tolerance)
    await page.evaluate(() => window.__apiano.mousePerfMove(302, 301))

    // Wait remaining 200ms (total 400ms > 350ms)
    await new Promise((r) => setTimeout(r, 200))
    const state = await page.evaluate(() => window.__apiano.mousePerfGetState())
    assert.equal(state.hasOrigin, true, 'Origin established despite micro-jitter')
    assert.equal(state.originX, 300, 'Original candidateX preserved')
  })

  await check('Horizontal & vertical movement updates pitch and modulation relative to established origin', async () => {
    await page.evaluate(() => {
      window.__apiano.mousePerfLeave()
      window.__apiano.mousePerfEnter(200, 200)
    })
    await new Promise((r) => setTimeout(r, 400)) // Establish origin (200, 200)

    // Move RIGHT (x=300) -> Pitch increases (> 0)
    await page.evaluate(() => window.__apiano.mousePerfMove(300, 200))
    let state = await page.evaluate(() => window.__apiano.mousePerfGetState())
    assert.ok(state.pitchBend > 0, `Expected pitchBend > 0, got ${state.pitchBend}`)

    // Move LEFT (x=100) -> Pitch decreases (< 0)
    await page.evaluate(() => window.__apiano.mousePerfMove(100, 200))
    state = await page.evaluate(() => window.__apiano.mousePerfGetState())
    assert.ok(state.pitchBend < 0, `Expected pitchBend < 0, got ${state.pitchBend}`)

    // Move UP (y=50, screen Y smaller) -> Modulation increases (> 0)
    await page.evaluate(() => window.__apiano.mousePerfMove(200, 50))
    state = await page.evaluate(() => window.__apiano.mousePerfGetState())
    assert.ok(state.modulation > 0, `Expected modulation > 0, got ${state.modulation}`)

    // Move DOWN (y=300, screen Y larger) -> Modulation decreases (= 0)
    await page.evaluate(() => window.__apiano.mousePerfMove(200, 300))
    state = await page.evaluate(() => window.__apiano.mousePerfGetState())
    assert.equal(state.modulation, 0, `Expected modulation clamped to 0 on downward move, got ${state.modulation}`)
  })

  await check('Smart mid-session re-centering: deliberate 550ms pause creates new origin', async () => {
    await page.evaluate(() => {
      window.__apiano.mousePerfLeave()
      window.__apiano.mousePerfEnter(200, 200)
    })
    await new Promise((r) => setTimeout(r, 400)) // Origin (200, 200)

    // Move to (400, 200) (displaced by 200px > 15px)
    await page.evaluate(() => window.__apiano.mousePerfMove(400, 200))
    let state = await page.evaluate(() => window.__apiano.mousePerfGetState())
    assert.equal(state.originX, 200, 'Origin remains 200 during active movement')

    // Short pause 300ms (< 550ms) -> MUST NOT RECENTER
    await new Promise((r) => setTimeout(r, 300))
    state = await page.evaluate(() => window.__apiano.mousePerfGetState())
    assert.equal(state.originX, 200, 'Short pause (< 550ms) does NOT recenter origin')

    // Wait remaining 350ms (total 650ms > 550ms deliberate pause) -> RECENTER!
    await new Promise((r) => setTimeout(r, 350))
    state = await page.evaluate(() => window.__apiano.mousePerfGetState())
    assert.equal(state.originX, 400, 'Deliberate pause (> 550ms) recenters originX to 400')
    assert.equal(state.originY, 200, 'Deliberate pause (> 550ms) recenters originY to 200')
  })

  await check('Pitch bend and modulation clamped strictly within bounds [-1.0, 1.0] and [0.0, 1.0]', async () => {
    await page.evaluate(() => {
      window.__apiano.mousePerfLeave()
      window.__apiano.mousePerfEnter(200, 200)
    })
    await new Promise((r) => setTimeout(r, 400))

    await page.evaluate(() => window.__apiano.mousePerfMove(2000, -2000)) // Extreme right & extreme up
    let state = await page.evaluate(() => window.__apiano.mousePerfGetState())
    assert.equal(state.pitchBend, 1, 'Pitch bend clamped to +1.0')
    assert.equal(state.modulation, 1, 'Modulation clamped to 1.0')

    await page.evaluate(() => window.__apiano.mousePerfMove(-2000, 2000)) // Extreme left & extreme down
    state = await page.evaluate(() => window.__apiano.mousePerfGetState())
    assert.equal(state.pitchBend, -1, 'Pitch bend clamped to -1.0')
    assert.equal(state.modulation, 0, 'Modulation clamped to 0.0')
  })

  await check('Mouse leave safely cancels timers and resets pitch bend and modulation to 0', async () => {
    await page.evaluate(() => {
      window.__apiano.mousePerfEnter(200, 200)
    })
    await new Promise((r) => setTimeout(r, 400))
    await page.evaluate(() => window.__apiano.mousePerfMove(350, 100))

    let state = await page.evaluate(() => window.__apiano.mousePerfGetState())
    assert.ok(state.pitchBend !== 0 || state.modulation !== 0, 'Expression active before leave')

    await page.evaluate(() => window.__apiano.mousePerfLeave())
    state = await page.evaluate(() => window.__apiano.mousePerfGetState())
    assert.equal(state.active, false, 'Inactive after leave')
    assert.equal(state.settling, false, 'Settling false after leave')
    assert.equal(state.hasOrigin, false, 'hasOrigin false after leave')
    assert.equal(state.pitchBend, 0, 'Pitch bend reset to 0')
    assert.equal(state.modulation, 0, 'Modulation reset to 0')
  })

  await check('Critical Manual Test Flow: entry -> settling -> active -> short pause -> deliberate recenter -> exit -> re-entry', async () => {
    // 1. Enter piano at (500, 300)
    await page.evaluate(() => {
      window.__apiano.mousePerfLeave()
      window.__apiano.mousePerfEnter(500, 300)
    })
    let state = await page.evaluate(() => window.__apiano.mousePerfGetState())
    assert.equal(state.settling, true, 'Step 1: Settling active on entry')
    assert.equal(state.pitchBend, 0, 'Step 1: 0 pitch jump on entry')

    // 2. Wait 400ms -> Origin (500, 300) established
    await new Promise((r) => setTimeout(r, 400))
    state = await page.evaluate(() => window.__apiano.mousePerfGetState())
    assert.equal(state.originX, 500, 'Step 2: OriginX established at 500')

    // 3. Move right to (600, 300) -> smooth pitch bend up
    await page.evaluate(() => window.__apiano.mousePerfMove(600, 300))
    state = await page.evaluate(() => window.__apiano.mousePerfGetState())
    assert.ok(state.pitchBend > 0, 'Step 3: smooth pitch bend up')

    // 4. Short pause 300ms -> NO recentering
    await new Promise((r) => setTimeout(r, 300))
    state = await page.evaluate(() => window.__apiano.mousePerfGetState())
    assert.equal(state.originX, 500, 'Step 4: Short pause retains origin 500')

    // 5. Deliberate pause 350ms more (total 650ms > 550ms) -> RECENTER to (600, 300)
    await new Promise((r) => setTimeout(r, 350))
    state = await page.evaluate(() => window.__apiano.mousePerfGetState())
    assert.equal(state.originX, 600, 'Step 5: Deliberate pause recenters origin to 600')

    // 6. Leave piano
    await page.evaluate(() => window.__apiano.mousePerfLeave())
    state = await page.evaluate(() => window.__apiano.mousePerfGetState())
    assert.equal(state.active, false, 'Step 6: inactive after leave')

    // 7. Re-enter at (150, 100) -> fresh settling cycle
    await page.evaluate(() => window.__apiano.mousePerfEnter(150, 100))
    state = await page.evaluate(() => window.__apiano.mousePerfGetState())
    assert.equal(state.settling, true, 'Step 7: fresh settling cycle on re-entry')
    assert.equal(state.candidateX, 150, 'Step 7: fresh candidate 150')
  })

  await check('QWERTY and MIDI notes play simultaneously with mouse performance', async () => {
    await page.evaluate(() => {
      window.__apiano.mousePerfEnter(200, 200)
    })
    await new Promise((r) => setTimeout(r, 400))
    await page.evaluate(() => {
      window.__apiano.mousePerfMove(300, 200) // Pitch bend up
      window.__apiano.qwertyKey('down', 'q') // QWERTY C4
    })
    const voices = await page.evaluate(() => window.__apiano.voices())
    assert.ok(voices.length > 0, 'QWERTY key must spawn active voice while mouse perf active')

    await page.evaluate(() => window.__apiano.qwertyKey('up', 'q'))
    await new Promise((r) => setTimeout(r, 50))
    await page.evaluate(() => window.__apiano.mousePerfLeave())

    const activeVoices = await page.evaluate(() => window.__apiano.stats().activeVoices)
    assert.equal(activeVoices, 0, 'Active voices drain to 0 cleanly')
  })

  await check('Zero React re-renders on keyboard during mouse movement', async () => {
    const rendersBefore = await page.evaluate(() => window.__apiano.keyboardRenders.count)
    await page.evaluate(() => {
      window.__apiano.mousePerfEnter(200, 200)
    })
    await new Promise((r) => setTimeout(r, 400))
    await page.evaluate(() => {
      for (let x = 200; x <= 400; x += 10) {
        window.__apiano.mousePerfMove(x, 200)
      }
      window.__apiano.mousePerfLeave()
    })
    const rendersAfter = await page.evaluate(() => window.__apiano.keyboardRenders.count)
    assert.equal(rendersAfter, rendersBefore, `Mouse movement must cause 0 React re-renders (before=${rendersBefore}, after=${rendersAfter})`)
  })

  console.log('--- Mouse Performance Smoke Suite Passed Cleanly ---\n')
}
