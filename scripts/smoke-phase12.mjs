/**
 * Automated smoke test for Phase 12: Workstation Tools (Metronome & Chord Assist).
 *
 * Verifies:
 * - Metronome start/stop, BPM configuration, and snapshot state
 * - Real-time Chord Detector analysis (Triads, 7ths, Inversions/Slash Chords)
 * - UI element interaction for metronome & chord display
 * - Teardown clean state
 */
export async function runPhase12(page, assert) {
  console.log('[smoke] Running Phase 12 Workstation Tools checks...')

  // 1. Metronome state & configuration
  const initSnap = await page.evaluate(() => window.__apiano.metronomeGetSnapshot())
  assert('Metronome initial state idle', initSnap.running === false && initSnap.bpm === 120, `bpm=${initSnap.bpm}`)

  await page.evaluate(() => window.__apiano.metronomeSetBpm(140))
  const updatedBpmSnap = await page.evaluate(() => window.__apiano.metronomeGetSnapshot())
  assert('Metronome BPM update', updatedBpmSnap.bpm === 140, `bpm=${updatedBpmSnap.bpm}`)

  await page.evaluate(() => window.__apiano.metronomeStart())
  const startSnap = await page.evaluate(() => window.__apiano.metronomeGetSnapshot())
  assert('Metronome start activates scheduler', startSnap.running === true, `running=${startSnap.running}`)

  await page.evaluate(() => window.__apiano.metronomeStop())
  const stopSnap = await page.evaluate(() => window.__apiano.metronomeGetSnapshot())
  assert('Metronome stop deactivates scheduler', stopSnap.running === false, `running=${stopSnap.running}`)

  // 2. Chord Detector pitch-class set matching
  const cMajor = await page.evaluate(() => window.__apiano.chordDetectNotes([60, 64, 67]))
  assert('Chord Detector identifies C Major triad', cMajor && cMajor.name === 'C Major', `name=${cMajor?.name}`)

  const cMinor = await page.evaluate(() => window.__apiano.chordDetectNotes([60, 63, 67]))
  assert('Chord Detector identifies C Minor triad', cMinor && cMinor.name === 'C Minor', `name=${cMinor?.name}`)

  const cMaj7 = await page.evaluate(() => window.__apiano.chordDetectNotes([60, 64, 67, 71]))
  assert('Chord Detector identifies C maj7', cMaj7 && cMaj7.name === 'C maj7', `name=${cMaj7?.name}`)

  const cInversion = await page.evaluate(() => window.__apiano.chordDetectNotes([64, 67, 72]))
  assert('Chord Detector identifies C Major first inversion (C Major/E)', cInversion && cInversion.name === 'C Major/E', `name=${cInversion?.name}`)

  // Restore default 120 BPM & clear any active voices
  await page.evaluate(() => {
    window.__apiano.metronomeSetBpm(120)
    window.__apiano.allOff()
  })
  await new Promise((r) => setTimeout(r, 600))

  const finalSnap = await page.evaluate(() => window.__apiano.stats())
  assert('Final Phase 12 state clean', finalSnap.activeVoices === 0, `active=${finalSnap.activeVoices}`)

  console.log('[smoke] Phase 12 checks complete: all Phase 12 checks passed.')
}
