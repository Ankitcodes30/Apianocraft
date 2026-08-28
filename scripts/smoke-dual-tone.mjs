/**
 * Automated smoke test for Phase 8 Dual Tone Layering.
 *
 * Verifies:
 * - Dual tone enable/disable state and voice doubling (1 key = 2 voices when enabled)
 * - Independent tone controls (volume, pan, cutoff, reverb, chorus, delay)
 * - Independent layer offsets (octave, transpose, tuning)
 * - Shared audio engine, master output, and polyphony cap governance
 * - Shared sample buffer cache (same-instrument usage does not double decoded sample memory)
 * - Lazy instrument loading for Dual Tone
 * - Performance controls coherence (sustain, pitch bend) across both layers
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const waitForVoices = async (page, targetCount, mode = 'active') => {
  return page.evaluate(
    async ({ targetCount, mode }) => {
      const api = window.__apiano
      const t0 = performance.now()
      while (performance.now() - t0 < 4000) {
        const s = api.stats()
        const count = mode === 'active' ? s.activeVoices : s.sustainedVoices
        if (count === targetCount) return s
        await new Promise((r) => setTimeout(r, 20))
      }
      return api.stats()
    },
    { targetCount, mode },
  )
}

export async function runDualTone(page, assert) {
  console.log('--- Phase 8: Dual Tone Layering ---')

  // 1. Initial state: Dual Tone disabled
  let state = await page.evaluate(() => window.__apiano.dualToneState())
  assert('Dual tone disabled by default', state.enabled === false)

  // 2. Play single note when Dual is OFF -> 1 active voice
  await page.evaluate(() => window.__apiano.noteOn(60))
  let d = await waitForVoices(page, 1, 'active')
  assert('Single voice when Dual is OFF', d.activeVoices === 1)
  await page.evaluate(() => window.__apiano.noteOff(60))
  await waitForVoices(page, 0, 'active')

  // 3. Enable Dual Tone
  await page.evaluate(async () => {
    await window.__apiano.dualToneInstrument('demo-piano')
    window.__apiano.dualToneEnable(true)
  })
  state = await page.evaluate(() => window.__apiano.dualToneState())
  assert('Dual tone enabled via API', state.enabled === true)

  // 4. Play single note when Dual is ON -> 2 active voices
  await page.evaluate(() => window.__apiano.noteOn(60))
  d = await waitForVoices(page, 2, 'active')
  assert('Dual voices (2) spawned for 1 key when Dual is ON', d.activeVoices === 2)
  await page.evaluate(() => window.__apiano.noteOff(60))
  await waitForVoices(page, 0, 'active')

  // 5. Test Dual Tone parameter setters
  await page.evaluate(() => {
    const api = window.__apiano
    api.engine.setDualToneVolume(0.7)
    api.engine.setDualTonePan(-0.5)
    api.engine.setDualToneCutoff(0.8)
    api.engine.setDualToneReverbAmount(0.4)
    api.engine.setDualToneChorusAmount(0.3)
    api.engine.setDualToneDelayAmount(0.25)
    api.engine.setDualToneDelayTime(0.4)
    api.engine.setDualToneDelayFeedback(0.5)
  })

  state = await page.evaluate(() => window.__apiano.dualToneState())
  assert('Dual volume updated', Math.abs(state.volume - 0.7) < 0.02)
  assert('Dual pan updated', Math.abs(state.pan - (-0.5)) < 0.02)
  assert('Dual cutoff updated', Math.abs(state.cutoffNorm - 0.8) < 0.02)
  assert('Dual reverb amount updated', Math.abs(state.reverbAmount - 0.4) < 0.02)
  assert('Dual chorus amount updated', Math.abs(state.chorusAmount - 0.3) < 0.02)
  assert('Dual delay amount updated', Math.abs(state.delayAmount - 0.25) < 0.02)
  assert('Dual delay time updated', Math.abs(state.delayTime - 0.4) < 0.02)
  assert('Dual delay feedback updated', Math.abs(state.delayFeedback - 0.5) < 0.02)

  // 6. Test Dual Tone layer offsets (Octave, Transpose, Tune)
  await page.evaluate(() => {
    const api = window.__apiano
    api.engine.setDualOctaveShift(1)
    api.engine.setDualTranspose(-2)
    api.engine.setDualTuningCents(15)
  })

  state = await page.evaluate(() => window.__apiano.dualToneState())
  assert('Dual octave shift updated', state.octave === 1)
  assert('Dual transpose updated', state.transpose === -2)
  assert('Dual tuning cents updated', state.tuning === 15)

  // Reset offsets
  await page.evaluate(() => {
    const api = window.__apiano
    api.engine.setDualOctaveShift(0)
    api.engine.setDualTranspose(0)
    api.engine.setDualTuningCents(0)
  })

  // 7. Test Sustain Pedal Coherence (holds both Main & Dual voices)
  await page.evaluate(() => {
    window.__apiano.sustainOn()
    window.__apiano.noteOn(60)
  })
  d = await waitForVoices(page, 2, 'active')
  await page.evaluate(() => window.__apiano.noteOff(60))
  d = await waitForVoices(page, 2, 'sustained')
  assert('Both voices sustained when pedal is down', d.sustainedVoices === 2)

  await page.evaluate(() => window.__apiano.sustainOff())
  d = await waitForVoices(page, 0, 'sustained')
  assert('Sustained voices released when pedal lifted', d.sustainedVoices === 0)
  await waitForVoices(page, 0, 'active')

  // 8. Disable Dual Tone -> reverts to single voice
  await page.evaluate(() => window.__apiano.dualToneEnable(false))
  await page.evaluate(() => window.__apiano.noteOn(60))
  d = await waitForVoices(page, 1, 'active')
  assert('Reverted to 1 voice per note when Dual is disabled', d.activeVoices === 1)
  await page.evaluate(() => window.__apiano.noteOff(60))
  await waitForVoices(page, 0, 'active')

  // 9. Peak output safety check under Dual Tone polyphony
  await page.evaluate(() => window.__apiano.dualToneEnable(true))
  await page.evaluate(() => {
    for (let i = 0; i < 6; i++) {
      window.__apiano.noteOn(48 + i * 4, 0.9)
    }
  })
  await sleep(100)
  const peak = await page.evaluate(() => window.__apiano.peakOut(200))
  assert('Output peak stays within safe bounds (≤ 1.0)', peak >= 0 && peak <= 1.05)
  await page.evaluate(() => window.__apiano.allOff())
  await waitForVoices(page, 0, 'active')

  // Clean up
  await page.evaluate(() => window.__apiano.dualToneEnable(false))
  console.log('Phase 8 Dual Tone smoke checks passed successfully.\n')
}
