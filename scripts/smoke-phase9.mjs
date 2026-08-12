/**
 * Automated smoke tests for Phase 9: Master Bus Processing / 3-Band EQ,
 * Split Keyboard Mode, and Workstation Preset System.
 */
export async function runPhase9(page, assert) {
  console.log('[smoke] Running Phase 9 Master EQ, Split Keyboard & Presets checks...')

  // 1. Master EQ & Master Volume checks
  const defaultEq = await page.evaluate(() => window.__apiano.masterGetEQ())
  assert('Master EQ default state', defaultEq.volume === 1 && defaultEq.lowGainDb === 0 && defaultEq.midGainDb === 0 && defaultEq.highGainDb === 0, `vol=${defaultEq.volume} low=${defaultEq.lowGainDb} mid=${defaultEq.midGainDb} high=${defaultEq.highGainDb}`)

  await page.evaluate(() => {
    window.__apiano.masterSetVolume(0.5)
    window.__apiano.masterSetEQ(3, -2, 4)
  })
  const updatedEq = await page.evaluate(() => window.__apiano.masterGetEQ())
  assert('Master EQ & Volume update', updatedEq.volume === 0.5 && updatedEq.lowGainDb === 3 && updatedEq.midGainDb === -2 && updatedEq.highGainDb === 4, `vol=${updatedEq.volume} low=${updatedEq.lowGainDb} mid=${updatedEq.midGainDb} high=${updatedEq.highGainDb}`)

  await page.evaluate(() => {
    window.__apiano.masterSetVolume(1)
    window.__apiano.masterSetEQ(0, 0, 0)
  })

  // 2. Split Keyboard Mode checks
  const defaultSplit = await page.evaluate(() => window.__apiano.splitGetState())
  assert('Split mode disabled by default', defaultSplit.enabled === false && defaultSplit.splitPoint === 60, `enabled=${defaultSplit.enabled} point=${defaultSplit.splitPoint}`)

  await page.evaluate(() => window.__apiano.splitSetEnabled(true))
  const splitEnabled = await page.evaluate(() => window.__apiano.splitGetState())
  assert('Enable split mode', splitEnabled.enabled === true, `enabled=${splitEnabled.enabled}`)

  // Lower zone note (note 48 < splitPoint 60)
  await page.evaluate(() => window.__apiano.noteOn(48, 0.8))
  await new Promise((r) => setTimeout(r, 100))
  const lowerVoiceCount = await page.evaluate(() => window.__apiano.stats().activeVoices)
  assert('Lower zone note spawns voice', lowerVoiceCount === 1, `active=${lowerVoiceCount}`)

  await page.evaluate(() => window.__apiano.noteOff(48))
  await new Promise((r) => setTimeout(r, 350))
  const afterLowerOff = await page.evaluate(() => window.__apiano.stats().activeVoices)
  assert('Lower zone note release', afterLowerOff === 0, `active=${afterLowerOff}`)

  // Upper zone note (note 72 >= splitPoint 60)
  await page.evaluate(() => window.__apiano.noteOn(72, 0.8))
  await new Promise((r) => setTimeout(r, 100))
  const upperVoiceCount = await page.evaluate(() => window.__apiano.stats().activeVoices)
  assert('Upper zone note spawns voice', upperVoiceCount === 1, `active=${upperVoiceCount}`)

  await page.evaluate(() => window.__apiano.noteOff(72))
  await new Promise((r) => setTimeout(r, 350))

  // Split chord across zones (48 lower, 72 upper)
  await page.evaluate(() => {
    window.__apiano.noteOn(48, 0.8)
    window.__apiano.noteOn(72, 0.8)
  })
  await new Promise((r) => setTimeout(r, 100))
  const splitChordCount = await page.evaluate(() => window.__apiano.stats().activeVoices)
  assert('Split chord spawns 2 voices across zones', splitChordCount === 2, `active=${splitChordCount}`)

  // Sustain pedal coherence across split zones
  await page.evaluate(() => window.__apiano.sustainOn())
  await page.evaluate(() => {
    window.__apiano.noteOff(48)
    window.__apiano.noteOff(72)
  })
  await new Promise((r) => setTimeout(r, 100))
  const sustainedSplitCount = await page.evaluate(() => window.__apiano.stats().activeVoices)
  assert('Split voices sustained by pedal', sustainedSplitCount === 2, `active=${sustainedSplitCount}`)

  await page.evaluate(() => window.__apiano.sustainOff())
  await new Promise((r) => setTimeout(r, 400))
  const releasedSplitCount = await page.evaluate(() => window.__apiano.stats().activeVoices)
  assert('Split voices released when pedal lifted', releasedSplitCount === 0, `active=${releasedSplitCount}`)

  // Split lower octave shift and transpose
  await page.evaluate(() => {
    window.__apiano.splitSetLowerOctave(-1)
    window.__apiano.splitSetLowerTranspose(2)
  })
  const updatedSplitState = await page.evaluate(() => window.__apiano.splitGetState())
  assert('Lower octave and transpose update', updatedSplitState.octaveShift === -1 && updatedSplitState.transpose === 2, `octave=${updatedSplitState.octaveShift} transpose=${updatedSplitState.transpose}`)

  // Disable split mode
  await page.evaluate(() => window.__apiano.splitSetEnabled(false))

  // 3. Preset System checks
  const presets = await page.evaluate(() => window.__apiano.presetGetList())
  assert('Factory presets available', Array.isArray(presets) && presets.length >= 4, `count=${presets.length}`)

  // Load factory preset "split-bass-keys"
  await page.evaluate(() => window.__apiano.presetLoad('split-bass-keys'))
  await new Promise((r) => setTimeout(r, 200))
  const loadedSplit = await page.evaluate(() => window.__apiano.splitGetState())
  assert('Preset load activates split mode', loadedSplit.enabled === true && loadedSplit.splitPoint === 60, `enabled=${loadedSplit.enabled} point=${loadedSplit.splitPoint}`)

  // Load factory preset "warm-dual-layer"
  await page.evaluate(() => window.__apiano.presetLoad('warm-dual-layer'))
  await new Promise((r) => setTimeout(r, 200))
  const loadedDual = await page.evaluate(() => window.__apiano.dualToneState())
  assert('Preset load activates dual mode', loadedDual.enabled === true, `dualEnabled=${loadedDual.enabled}`)

  // Create user preset
  const createdPreset = await page.evaluate(() => window.__apiano.presetSave('Smoke Test Preset'))
  assert('Create user preset in LocalStorage', createdPreset && createdPreset.category === 'user' && createdPreset.name === 'Smoke Test Preset', `id=${createdPreset.id} name=${createdPreset.name}`)

  const presetsAfterSave = await page.evaluate(() => window.__apiano.presetGetList())
  const hasUserPreset = presetsAfterSave.some((p) => p.id === createdPreset.id)
  assert('User preset appears in list', hasUserPreset, `userPresets=${presetsAfterSave.filter((p) => p.category === 'user').length}`)

  // Delete user preset
  const deleted = await page.evaluate((id) => window.__apiano.presetDelete(id), createdPreset.id)
  assert('Delete user preset', deleted === true, `deleted=${deleted}`)

  // Restore default grand preset
  await page.evaluate(() => window.__apiano.presetLoad('default-grand'))
  await new Promise((r) => setTimeout(r, 200))

  const finalDiag = await page.evaluate(() => window.__apiano.stats())
  assert('Final Phase 9 state clean', finalDiag.activeVoices === 0 && finalDiag.dualEnabled === false && finalDiag.splitZone.enabled === false, `active=${finalDiag.activeVoices} dual=${finalDiag.dualEnabled} split=${finalDiag.splitZone.enabled}`)

  console.log('[smoke] Phase 9 checks complete: all Phase 9 checks passed.')
}
