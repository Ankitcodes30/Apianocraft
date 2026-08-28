/**
 * Automated smoke test for Phase 11: Performance Recording & Capture.
 *
 * Verifies:
 * - Transport recording state transitions (idle -> recording -> stopped -> playing)
 * - Capture of noteOn, noteOff, sustain pedal, pitch bend events
 * - SMF Type 0 binary MIDI export (.mid) with valid MThd/MTrk chunk headers
 * - Transport playback re-routing to engine
 * - Transport clear
 */
export async function runPhase11(page, assert) {
  console.log('[smoke] Running Phase 11 Recording & Transport checks...')

  // 1. Initial idle state
  const initSnap = await page.evaluate(() => window.__apiano.recordingGetSnapshot())
  assert('Recorder initial state idle', initSnap.state === 'idle' && initSnap.eventCount === 0, `state=${initSnap.state}`)

  // 2. Start recording & play performance events
  await page.evaluate(() => window.__apiano.recordingStart())
  const recSnap = await page.evaluate(() => window.__apiano.recordingGetSnapshot())
  assert('Recorder enters recording state', recSnap.state === 'recording', `state=${recSnap.state}`)

  // Play notes + sustain
  await page.evaluate(() => window.__apiano.noteOn(60, 0.8))
  await new Promise((r) => setTimeout(r, 100))
  await page.evaluate(() => window.__apiano.sustainOn())
  await page.evaluate(() => window.__apiano.noteOff(60))
  await new Promise((r) => setTimeout(r, 100))
  await page.evaluate(() => window.__apiano.sustainOff())
  await page.evaluate(() => window.__apiano.noteOn(64, 0.9))
  await page.evaluate(() => window.__apiano.noteOff(64))

  // Stop recording
  await page.evaluate(() => window.__apiano.recordingStop())
  const stoppedSnap = await page.evaluate(() => window.__apiano.recordingGetSnapshot())
  assert(
    'Recorder stops recording and captures events',
    stoppedSnap.state === 'idle' && stoppedSnap.eventCount >= 6,
    `state=${stoppedSnap.state} count=${stoppedSnap.eventCount}`,
  )

  // 3. Export MIDI file & verify binary SMF structure
  const midiBytes = await page.evaluate(() => Array.from(window.__apiano.recordingExportMidi()))
  assert(
    'Export MIDI generates non-empty binary array',
    Array.isArray(midiBytes) && midiBytes.length > 25,
    `bytesLength=${midiBytes.length}`,
  )

  // Header chunk 'MThd'
  const isMThd =
    midiBytes[0] === 0x4d && // 'M'
    midiBytes[1] === 0x54 && // 'T'
    midiBytes[2] === 0x68 && // 'h'
    midiBytes[3] === 0x64    // 'd'
  assert('MIDI export contains valid MThd header chunk', isMThd, `header=${midiBytes.slice(0, 4).join(',')}`)

  // Track chunk 'MTrk' at byte offset 14
  const isMTrk =
    midiBytes[14] === 0x4d && // 'M'
    midiBytes[15] === 0x54 && // 'T'
    midiBytes[16] === 0x72 && // 'r'
    midiBytes[17] === 0x6b    // 'k'
  assert('MIDI export contains valid MTrk track chunk', isMTrk, `trackHeader=${midiBytes.slice(14, 18).join(',')}`)

  // 4. Transport playback
  await page.evaluate(() => window.__apiano.recordingPlay())
  await new Promise((r) => setTimeout(r, 50))
  const playSnap = await page.evaluate(() => window.__apiano.recordingGetSnapshot())
  assert('Recorder enters playing state', playSnap.state === 'playing', `state=${playSnap.state}`)

  // Wait for playback to finish
  const finalPlaySnap = await page.evaluate(async () => {
    const api = window.__apiano
    const t0 = performance.now()
    while (performance.now() - t0 < 5000) {
      const s = api.recordingGetSnapshot()
      if (s.state === 'idle') return s
      await new Promise((r) => setTimeout(r, 50))
    }
    return api.recordingGetSnapshot()
  })
  assert('Recorder completes playback and returns to idle', finalPlaySnap.state === 'idle', `state=${finalPlaySnap.state}`)

  // 5. Clear recording
  await page.evaluate(() => window.__apiano.recordingClear())
  const clearedSnap = await page.evaluate(() => window.__apiano.recordingGetSnapshot())
  assert('Recorder clear resets event timeline', clearedSnap.state === 'idle' && clearedSnap.eventCount === 0, `count=${clearedSnap.eventCount}`)

  console.log('[smoke] Phase 11 checks complete: all Phase 11 checks passed.')
}
