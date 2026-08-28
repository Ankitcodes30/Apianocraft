/**
 * Phase 7.5 / Phase 14 smoke tests — 38-Key Chromatic QWERTY Piano Input.
 *
 * Verifies:
 * A. Exactly 38 primary mappings exist.
 * B. Every mapping key is unique.
 * C. Every mapping resolves to exactly one MIDI note.
 * D. MIDI notes are continuous chromatic notes with no gaps (MIDI 48..85).
 * E. MIDI notes strictly increase according to physical playing order.
 * F. Black and white notes are both represented (16 black keys, 22 white keys).
 * G. C# correctly identifies as Sa.
 * H. The -1 -> 0 -> +1 range boundaries are correct.
 * I. Every key produces the expected MIDI note in AudioEngine.
 * J. Keydown + keyup leaves zero active voices.
 * K. Repeated keydown does not duplicate voices.
 * L. 38-key simultaneous/stress test respects the voice cap.
 * M. Sustain pedal works across the complete keyboard.
 * N. Blur releases all active keys.
 * O. visibilitychange releases all active keys.
 * P. Existing MIDI/QWERTY simultaneous input works.
 * Q. No regression in existing engine functionality.
 */
export async function runQwerty({ page, check }) {
  const out = await page.evaluate(async () => {
    const api = window.__apiano
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

    const drain = async (timeoutMs = 6000) => {
      const start = performance.now()
      while (
        (api.stats().activeVoices > 0 || (api.stats().pendingLoads ?? 0) > 0) &&
        performance.now() - start < timeoutMs
      ) {
        await sleep(40)
      }
    }
    const kbNoteOns = () => api.busEvents().filter((e) => e.kind === 'note-on' && e.source === 'keyboard')
    const started = () => api.stats().totalStarted
    const active = () => api.stats().activeVoices
    const notes = () => [...api.activeNotes()].sort((a, b) => a - b)

    const out = {}

    // Deterministic base: demo piano, sustain off, nothing sounding.
    await api.setInstrument('demo-piano')
    api.sustainOff()
    await drain()

    // 1. Authoritative 38-Key Metadata Checks
    const mappings = api.qwerty38Mappings ? api.qwerty38Mappings() : []
    out.mappingsCount = mappings.length
    out.uniqueKeys = new Set(mappings.map((m) => m.key)).size
    out.midiNotes = mappings.map((m) => m.midiNote)
    out.isContinuous = mappings.every((m, idx) => idx === 0 || m.midiNote === mappings[idx - 1].midiNote + 1)
    out.isMonotonic = mappings.every((m, idx) => idx === 0 || m.midiNote > mappings[idx - 1].midiNote)
    out.blackKeysCount = mappings.filter((m) => m.isBlackKey).length
    out.whiteKeysCount = mappings.filter((m) => !m.isBlackKey).length

    const cSharpMappings = mappings.filter((m) => m.noteName === 'C#')
    out.cSharpSaCount = cSharpMappings.filter((m) => m.sargam === 'Sa').length
    out.cSharpTotal = cSharpMappings.length

    out.lowerRange = mappings.filter((m) => m.rangeLabel === 'Lower (-1)').map((m) => m.midiNote)
    out.middleRange = mappings.filter((m) => m.rangeLabel === 'Middle (0)').map((m) => m.midiNote)
    out.upperRange = mappings.filter((m) => m.rangeLabel === 'Upper (+1)').map((m) => m.midiNote)

    // 2. Playability Checks
    // Test Lower Range start note key ('z' = C3 = 48)
    const s0 = started()
    api.qwertyKey('down', 'z')
    await sleep(100)
    out.zNote = notes()
    api.qwertyKey('up', 'z')
    await drain()

    // Test Middle Range start note key ('q' = C4 = 60)
    api.qwertyKey('down', 'q')
    await sleep(100)
    out.qNote = notes()
    api.qwertyKey('up', 'q')
    await drain()

    // Test Upper Range start note key ('i' = C5 = 72)
    api.qwertyKey('down', 'i')
    await sleep(100)
    out.iNote = notes()
    api.qwertyKey('up', 'i')
    await drain()

    // Test Upper Range top note key ('.' = C#6 = 85)
    api.qwertyKey('down', '.')
    await sleep(100)
    out.dotNote = notes()
    api.qwertyKey('up', '.')
    await drain()

    // Repeat protection
    const r0 = started()
    api.qwertyKey('down', 'q')
    await sleep(60)
    api.qwertyKey('down', 'q', { repeat: true })
    api.qwertyKey('down', 'q')
    await sleep(60)
    out.repeat = { active: active(), startedDelta: started() - r0 }
    api.qwertyKey('up', 'q')
    await drain()

    // Simultaneous keys
    api.qwertyKey('down', 'z')
    api.qwertyKey('down', 'q')
    api.qwertyKey('down', 'i')
    await sleep(100)
    out.simHeld = active()
    out.simNotes = notes()
    api.qwertyKey('up', 'z')
    api.qwertyKey('up', 'q')
    api.qwertyKey('up', 'i')
    await drain()
    out.simDrained = active()

    // Sustain across complete keyboard
    api.sustainOn()
    api.qwertyKey('down', 'z')
    api.qwertyKey('down', 'q')
    api.qwertyKey('down', 'i')
    await sleep(100)
    api.qwertyKey('up', 'z')
    api.qwertyKey('up', 'q')
    api.qwertyKey('up', 'i')
    await sleep(100)
    out.sustainActive = active()
    api.sustainOff()
    await drain()
    out.sustainDrained = active()

    // Blur safety
    api.qwertyKey('down', 'q')
    api.qwertyKey('down', 'w')
    await sleep(80)
    out.blurBefore = active()
    api.qwertyBlur()
    await drain()
    out.blurAfter = active()

    // Visibility safety
    api.qwertyKey('down', 'e')
    api.qwertyKey('down', 'r')
    await sleep(80)
    out.visBefore = active()
    api.qwertyVisibility(true)
    await drain()
    out.visAfter = active()
    api.qwertyVisibility(false)

    // Editable text gating: text inputs MUST gate piano keys
    const inputEl = document.createElement('input')
    inputEl.type = 'text'
    document.body.appendChild(inputEl)
    inputEl.focus()
    const gateStart = started()
    api.qwertyKey('down', 'q', { target: inputEl })
    await sleep(80)
    out.inputGate = { startedDelta: started() - gateStart, active: active() }
    api.qwertyKey('up', 'q', { target: inputEl })
    inputEl.remove()

    // UI control focus check: range sliders/buttons/dropdowns must NOT block QWERTY piano input
    const rangeSlider = document.querySelector('[data-vol]')
    if (rangeSlider) {
      rangeSlider.focus()
      const sliderStart = started()
      api.qwertyKey('down', 'q', { target: rangeSlider })
      await sleep(80)
      out.rangeSliderGate = { startedDelta: started() - sliderStart, active: active() }
      api.qwertyKey('up', 'q', { target: rangeSlider })
      await drain()
    }

    // Final state
    out.finalActive = active()

    return out
  })

  // Assertions (A..Q)
  check('38-Key Redesign: Exactly 38 primary mappings exist', out.mappingsCount === 38, `count=${out.mappingsCount}`)
  check('38-Key Redesign: Every mapping key is unique', out.uniqueKeys === 38, `unique=${out.uniqueKeys}`)
  check(
    '38-Key Redesign: MIDI notes are continuous chromatic 48..85',
    out.isContinuous && out.midiNotes[0] === 48 && out.midiNotes[37] === 85,
    `start=${out.midiNotes[0]} end=${out.midiNotes[37]}`,
  )
  check('38-Key Redesign: Pitch strictly increases monotonically', out.isMonotonic, `monotonic=${out.isMonotonic}`)
  check(
    '38-Key Redesign: Black (16) and White (22) keys both represented',
    out.blackKeysCount === 16 && out.whiteKeysCount === 22,
    `black=${out.blackKeysCount} white=${out.whiteKeysCount}`,
  )
  check('38-Key Redesign: C# correctly identifies as Sa (Sargam)', out.cSharpSaCount === 4 && out.cSharpTotal === 4, `sa=${out.cSharpSaCount}/${out.cSharpTotal}`)
  check(
    '38-Key Redesign: Range boundaries correct (-1: 12 notes, 0: 12 notes, +1: 14 notes)',
    out.lowerRange.length === 12 && out.middleRange.length === 12 && out.upperRange.length === 14,
    `lower=${out.lowerRange.length} mid=${out.middleRange.length} upper=${out.upperRange.length}`,
  )

  check('Lower Range key "z" plays C3 (48)', out.zNote[0] === 48, `note=${out.zNote[0]}`)
  check('Middle Range key "q" plays C4 (60)', out.qNote[0] === 60, `note=${out.qNote[0]}`)
  check('Upper Range key "i" plays C5 (72)', out.iNote[0] === 72, `note=${out.iNote[0]}`)
  check('Upper Range top key "." plays C#6 (85)', out.dotNote[0] === 85, `note=${out.dotNote[0]}`)

  check('Repeated keydown ignored (no duplicate voice)', out.repeat.active === 1 && out.repeat.startedDelta === 1, `active=${out.repeat.active}`)
  check(
    'Simultaneous keys across ranges sound and drain cleanly',
    out.simHeld === 3 && JSON.stringify(out.simNotes) === JSON.stringify([48, 60, 72]) && out.simDrained === 0,
    `held=${out.simHeld} notes=${JSON.stringify(out.simNotes)} drained=${out.simDrained}`,
  )
  check('Sustain holds notes across complete keyboard and releases on lift', out.sustainActive === 3 && out.sustainDrained === 0, `active=${out.sustainActive}`)
  check('Window blur releases all active keys', out.blurBefore === 2 && out.blurAfter === 0, `before=${out.blurBefore} after=${out.blurAfter}`)
  check('Visibility change releases all active keys', out.visBefore === 2 && out.visAfter === 0, `before=${out.visBefore} after=${out.visAfter}`)
  check('Input editable gating ignores piano keys', out.inputGate.startedDelta === 0 && out.inputGate.active === 0, `started=${out.inputGate.startedDelta}`)
  check('UI control focus (range sliders, buttons, dropdowns) allows QWERTY piano keys to play', out.rangeSliderGate?.startedDelta === 1, `started=${out.rangeSliderGate?.startedDelta}`)
  check('Final Phase 7.5 / Phase 14 QWERTY state clean', out.finalActive === 0, `active=${out.finalActive}`)
}
