/**
 * Phase 7.5 smoke tests — QWERTY computer keyboard input.
 *
 * Deterministic: synthetic KeyboardEvents drive the real window-level
 * adapter; the NoteEventBus ring proves exact MIDI notes, source='keyboard'
 * and velocity; the engine proves voices start/release/drain and never
 * stick (focus, blur, visibility, repeat, modifiers, octave, transpose).
 */
export async function runQwerty({ page, check }) {
  const out = await page.evaluate(async () => {
    const api = window.__apiano
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

    const drain = async (timeoutMs = 6000) => {
      const start = performance.now()
      // Wait for in-flight spawns too: voices only become active after the
      // async sample fetch resolves, so activeVoices alone can read 0 while
      // spawns are still queued (premature drain).
      while (
        (api.stats().activeVoices > 0 || api.stats().pendingLoads > 0) &&
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

    out.renders0 = api.qwertyState().renders
    out.octave0 = api.qwertyState().octave

    // ---- mapping: one full octave, note on/off --------------------------
    const row = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j']
    const s0 = started()
    for (const k of row) api.qwertyKey('down', k)
    await sleep(150)
    out.rowNotes = notes()
    out.rowOns = kbNoteOns().slice(-12).map((e) => ({ note: e.note, source: e.source, velocity: e.velocity }))
    out.rowStarted = started() - s0
    for (const k of row) api.qwertyKey('up', k)
    await drain()
    out.rowDrained = active()

    // ---- repeat / duplicate / retrigger ----------------------------------
    const r0 = started()
    const onBefore = kbNoteOns().length
    api.qwertyKey('down', 'a')
    await sleep(80)
    api.qwertyKey('down', 'a', { repeat: true })
    api.qwertyKey('down', 'a')
    await sleep(80)
    out.repeat = { active: active(), startedDelta: started() - r0, extraOns: kbNoteOns().length - onBefore }
    api.qwertyKey('up', 'a')
    await drain()

    const r1 = started()
    api.qwertyKey('down', 'a')
    await sleep(60)
    api.qwertyKey('up', 'a')
    await drain()
    api.qwertyKey('down', 'a')
    await sleep(80)
    out.retrigger = { active: active(), startedDelta: started() - r1 }
    api.qwertyKey('up', 'a')
    await drain()

    // ---- simultaneous keys release independently -------------------------
    const t0 = started()
    api.qwertyKey('down', 'a')
    api.qwertyKey('down', 's')
    api.qwertyKey('down', 'd')
    await sleep(100)
    out.simHeld = active()
    api.qwertyKey('up', 'a')
    // The released C4 must leave activeNotes once its release tail ends,
    // while the still-held D4/E4 keep sounding.
    const simTailStart = performance.now()
    while (active() > 2 && performance.now() - simTailStart < 2000) await sleep(20)
    out.simAfterA = notes()
    api.qwertyKey('up', 's')
    api.qwertyKey('up', 'd')
    await drain()
    out.simFinal = { active: active(), startedDelta: started() - t0 }

    // ---- octave shift via Z/X ---------------------------------------------
    const rOct0 = api.qwertyState().renders
    api.qwertyKey('down', 'x')
    await sleep(80)
    out.xOctave = api.qwertyState().octave
    out.xChip = document.querySelector('[data-qwerty-octave]')?.textContent
    out.octRenders = api.qwertyState().renders - rOct0
    api.qwertyKey('down', 'a')
    await sleep(100)
    out.xNote = notes()
    api.qwertyKey('up', 'a')
    await drain()

    api.qwertyKey('down', 'z')
    await sleep(60)
    api.qwertyKey('down', 'z')
    await sleep(60)
    out.zOctave = api.qwertyState().octave
    api.qwertyKey('down', 'a')
    await sleep(100)
    out.zNote = notes()
    api.qwertyKey('up', 'a')
    await drain()

    // ---- octave clamping ----------------------------------------------------
    for (let i = 0; i < 8; i++) api.qwertyKey('down', 'x')
    await sleep(60)
    out.clampOctave = api.qwertyState().octave
    api.qwertyKey('down', 'a')
    await sleep(100)
    out.clampNote = notes()
    api.qwertyKey('up', 'a')
    await drain()
    for (let i = 0; i < 4; i++) api.qwertyKey('down', 'z')
    await sleep(60)
    out.backOctave = api.qwertyState().octave

    // ---- transpose interaction (real UI buttons) ---------------------------
    for (let i = 0; i < 5; i++) api.mainToneClick('[data-tr-up]')
    await sleep(100)
    api.qwertyKey('down', 'a')
    await sleep(100)
    out.trNote = notes()
    api.qwertyKey('up', 'a')
    await drain()
    api.qwertyKey('down', 'x')
    await sleep(60)
    api.qwertyKey('down', 'a')
    await sleep(100)
    out.trOctNote = notes()
    api.qwertyKey('up', 'a')
    await drain()
    api.qwertyKey('down', 'z')
    await sleep(60)
    api.mainToneClick('[data-tr-reset]')
    await sleep(100)

    // ---- engine octave shift interaction ------------------------------------
    api.mainToneClick('[data-oct-up]')
    await sleep(100)
    api.qwertyKey('down', 'a')
    await sleep(100)
    out.engOctNote = notes()
    api.qwertyKey('up', 'a')
    await drain()
    api.mainToneClick('[data-oct-reset]')
    await sleep(100)

    // ---- fine tuning ----------------------------------------------------------
    api.setTuningCents(50)
    api.qwertyKey('down', 'a')
    await sleep(100)
    const tuneVoice = api.voices().find((v) => v.midiNote === 60)
    out.tuneRate = tuneVoice ? tuneVoice.playbackRate : -1
    api.qwertyKey('up', 'a')
    await drain()
    api.setTuningCents(0)

    // ---- editable-target gating ----------------------------------------------
    const editable = async (makeEl) => {
      const el = makeEl()
      document.body.appendChild(el)
      el.focus()
      const b = started()
      const octaveBefore = api.qwertyState().octave
      api.qwertyKey('down', 'a', { target: el })
      api.qwertyKey('down', 'x', { target: el })
      await sleep(80)
      const res = { startedDelta: started() - b, octave: api.qwertyState().octave, octaveBefore, active: active() }
      api.qwertyKey('up', 'a', { target: el })
      el.remove()
      const ae = document.activeElement
      if (ae instanceof HTMLElement) ae.blur()
      return res
    }
    out.inputGate = await editable(() => {
      const i = document.createElement('input')
      i.type = 'text'
      i.value = 'typing here'
      return i
    })
    out.textareaGate = await editable(() => document.createElement('textarea'))
    out.selectGate = await editable(() => {
      const s = document.createElement('select')
      s.add(new Option('one'))
      return s
    })
    out.contenteditableGate = await editable(() => {
      const d = document.createElement('div')
      d.contentEditable = 'true'
      return d
    })

    // ---- modifier safety ------------------------------------------------------
    const m0 = started()
    api.qwertyKey('down', 'a', { ctrl: true })
    api.qwertyKey('down', 'a', { alt: true })
    api.qwertyKey('down', 'a', { meta: true })
    await sleep(80)
    out.modifiers = { startedDelta: started() - m0, active: active() }

    // ---- window blur ----------------------------------------------------------
    api.qwertyKey('down', 'a')
    api.qwertyKey('down', 's')
    api.qwertyKey('down', 'd')
    await sleep(100)
    out.blurBefore = active()
    api.qwertyBlur()
    await drain()
    out.blurAfter = { active: active(), held: api.qwertyState().heldKeys.length }

    // ---- visibility change ------------------------------------------------------
    api.qwertyKey('down', 'a')
    api.qwertyKey('down', 's')
    await sleep(100)
    out.visBefore = active()
    api.qwertyVisibility(true)
    await drain()
    out.visHidden = { active: active(), held: api.qwertyState().heldKeys.length }
    api.qwertyVisibility(false)
    await sleep(80)

    // ---- keyup after focus moves into an editable --------------------------------
    const inputEl = document.createElement('input')
    inputEl.type = 'text'
    document.body.appendChild(inputEl)
    api.qwertyKey('down', 'a')
    await sleep(80)
    inputEl.focus()
    api.qwertyKey('up', 'a', { target: inputEl })
    await drain()
    out.focusMoveRelease = { active: active(), held: api.qwertyState().heldKeys.length }
    inputEl.remove()
    const ae2 = document.activeElement
    if (ae2 instanceof HTMLElement) ae2.blur()

    // ---- render isolation ----------------------------------------------------------
    const rBefore = api.qwertyState().renders
    for (let i = 0; i < 10; i++) {
      api.qwertyKey('down', 'a')
      api.qwertyKey('up', 'a')
    }
    await drain()
    out.noteRenders = api.qwertyState().renders - rBefore

    // ---- rapid cycling: no drops, drains --------------------------------------------
    const c0 = started()
    for (let i = 0; i < 40; i++) {
      api.qwertyKey('down', 'a')
      api.qwertyKey('up', 'a')
    }
    await drain()
    out.rapid = { startedDelta: started() - c0, dropped: api.stats().dropped, active: active() }

    // ---- sustain ---------------------------------------------------------------------
    api.sustainOn()
    api.qwertyKey('down', 'a')
    api.qwertyKey('down', 's')
    await sleep(100)
    api.qwertyKey('up', 'a')
    api.qwertyKey('up', 's')
    await sleep(100)
    out.sustain = { active: active(), sustained: api.stats().sustainedVoices }
    api.sustainOff()
    await drain()
    out.sustainDrained = active()

    // ---- regression: pedal-off releases must never become sustained ------------------
    // 40 back-to-back on/off pairs with the pedal UP, then the pedal is pressed
    // while the sample spawns are still in flight. The voices were released
    // with the pedal up, so pressing the pedal later must NOT hold them: a
    // dropped note must never later become a sustained voice.
    api.sustainOff()
    await drain()
    const reg0 = started()
    for (let i = 0; i < 40; i++) {
      api.qwertyKey('down', 'a')
      api.qwertyKey('up', 'a')
    }
    api.sustainOn()
    // Measure quickly: sample voices end naturally after a few seconds, and
    // the 6s drain would mask leaky sustain behavior. The release tail is
    // ~80ms, so 150ms is long enough post-fix for voices to drain.
    await sleep(150)
    out.regression = {
      startedDelta: started() - reg0,
      sustained: api.stats().sustainedVoices,
      active: active(),
      held: api.qwertyState().heldKeys.length,
    }
    api.sustainOff()
    await drain()
    out.regressionAfter = { active: active(), sustained: api.stats().sustainedVoices }

    // ---- performance pad interplay ------------------------------------------------------
    api.qwertyKey('down', 'a')
    await sleep(100)
    api.perfPadPointer('down', 1, 0.5)
    await sleep(150)
    const bendVoice = api.voices().find((v) => v.midiNote === 60)
    out.padBend = {
      cents: api.stats().pitchBendCents,
      rate: bendVoice ? bendVoice.playbackRate : -1,
    }
    api.perfPadPointer('move', 0.5, 0)
    await sleep(100)
    out.padMod = api.stats().modulation
    api.perfPadPointer('up', 0.5, 0)
    await sleep(600)
    api.qwertyKey('up', 'a')
    await drain()

    // ---- final state ---------------------------------------------------------------------
    out.final = {
      active: active(),
      sustained: api.stats().sustainedVoices,
      octave: api.qwertyState().octave,
      held: api.qwertyState().heldKeys.length,
      transpose: api.stats().transpose,
      octaveShift: api.stats().octaveShift,
      tuning: api.stats().tuningCents,
      voiceTable: api.voices().length,
    }
    return out
  })

  const row = JSON.stringify([60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71])

  // mapping / note on / off
  check('qwerty row A..J sounds C4..B4 (12 notes)', JSON.stringify(out.rowNotes) === row, `notes=${JSON.stringify(out.rowNotes)}`)
  check(
    'qwerty note-ons carry source=keyboard + velocity 0.7',
    out.rowOns.length === 12 &&
      out.rowOns.every((e) => e.source === 'keyboard' && e.velocity === 0.7) &&
      JSON.stringify(out.rowOns.map((e) => e.note)) === row,
    `first=${JSON.stringify(out.rowOns[0])}`,
  )
  check('qwerty row started 12 voices', out.rowStarted === 12, `started=${out.rowStarted}`)
  check('qwerty keyups release the whole row', out.rowDrained === 0, `active=${out.rowDrained}`)

  // repeat / duplicate / retrigger
  check(
    'qwerty repeat+duplicate keydowns ignored (one voice)',
    out.repeat.active === 1 && out.repeat.startedDelta === 1 && out.repeat.extraOns === 1,
    `active=${out.repeat.active} started=${out.repeat.startedDelta} ons=${out.repeat.extraOns}`,
  )
  check(
    'qwerty re-press after release retriggers',
    out.retrigger.active === 1 && out.retrigger.startedDelta === 2,
    `active=${out.retrigger.active} started=${out.retrigger.startedDelta}`,
  )

  // simultaneous
  check('qwerty 3 simultaneous keys sound', out.simHeld === 3, `active=${out.simHeld}`)
  // keymap: a=60 (C4), s=62 (D4), d=64 (E4) — releasing 'a' leaves D4+E4.
  check('qwerty releasing one key keeps the other two', JSON.stringify(out.simAfterA) === JSON.stringify([62, 64]), `notes=${JSON.stringify(out.simAfterA)}`)
  check('qwerty simultaneous keys drain + no drops', out.simFinal.active === 0 && out.simFinal.startedDelta === 3, `active=${out.simFinal.active}`)

  // octave
  check('qwerty X raises octave to +1 (chip shows it)', out.xOctave === 1 && String(out.xChip).trim() === 'oct +1', `oct=${out.xOctave} chip="${out.xChip}"`)
  check('qwerty octave +1 plays C5 (72)', out.xNote[0] === 72, `note=${out.xNote[0]}`)
  check('qwerty octave change renders once (no storm)', out.octRenders === 1, `renders=${out.octRenders}`)
  check('qwerty Z twice lowers octave to -1', out.zOctave === -1, `oct=${out.zOctave}`)
  check('qwerty octave -1 plays C3 (48)', out.zNote[0] === 48, `note=${out.zNote[0]}`)
  check('qwerty octave clamps at +4 (A8 = 108)', out.clampOctave === 4 && out.clampNote[0] === 108, `oct=${out.clampOctave} note=${out.clampNote[0]}`)
  check('qwerty octave returns to 0 via Z', out.backOctave === 0, `oct=${out.backOctave}`)

  // transpose / engine octave / tuning
  check('qwerty respects engine transpose +5 (F5 = 65)', out.trNote[0] === 65, `note=${out.trNote[0]}`)
  check('qwerty octave + transpose combine (+12 +5 = 77)', out.trOctNote[0] === 77, `note=${out.trOctNote[0]}`)
  check('qwerty respects engine octave shift +1 (C5 = 72)', out.engOctNote[0] === 72, `note=${out.engOctNote[0]}`)
  check('qwerty respects fine tuning +50¢ (rate 1.0293)', Math.abs(out.tuneRate - 1.0293) < 0.002, `rate=${out.tuneRate}`)

  // editable gating
  for (const [label, gate] of [
    ['input', out.inputGate],
    ['textarea', out.textareaGate],
    ['select', out.selectGate],
    ['contenteditable', out.contenteditableGate],
  ]) {
    check(`qwerty typing in ${label} plays no notes`, gate.startedDelta === 0 && gate.active === 0, `started=${gate.startedDelta}`)
    check(`qwerty octave keys ignored in ${label}`, gate.octave === gate.octaveBefore, `oct=${gate.octave}`)
  }

  // modifiers
  check('qwerty ctrl/alt/meta presses play no notes', out.modifiers.startedDelta === 0 && out.modifiers.active === 0, `started=${out.modifiers.startedDelta}`)

  // blur / visibility / focus safety
  check('qwerty window blur releases all held notes', out.blurBefore === 3 && out.blurAfter.active === 0 && out.blurAfter.held === 0, `before=${out.blurBefore} after=${JSON.stringify(out.blurAfter)}`)
  check('qwerty tab-hide (visibility) releases held notes', out.visBefore === 2 && out.visHidden.active === 0 && out.visHidden.held === 0, `before=${out.visBefore} after=${JSON.stringify(out.visHidden)}`)
  check('qwerty keyup after focus moves into input still releases', out.focusMoveRelease.active === 0 && out.focusMoveRelease.held === 0, `active=${out.focusMoveRelease.active}`)

  // renders / rapid / sustain / pad
  check('qwerty note events cause zero React renders', out.noteRenders === 0, `renders=${out.noteRenders}`)
  check('qwerty rapid 40 cycles: no drops, drains', out.rapid.startedDelta === 40 && out.rapid.dropped === 0 && out.rapid.active === 0, `started=${out.rapid.startedDelta} dropped=${out.rapid.dropped}`)
  check('qwerty sustain holds keyboard notes', out.sustain.active === 2 && out.sustain.sustained === 2, `active=${out.sustain.active} sustained=${out.sustain.sustained}`)
  check('qwerty sustain lift drains', out.sustainDrained === 0, `active=${out.sustainDrained}`)
  check(
    'qwerty rapid pedal-off cycles start all voices (no drops)',
    out.regression.startedDelta === 40,
    `started=${out.regression.startedDelta}`,
  )
  check(
    'qwerty later pedal-down never sustains pedal-off releases',
    out.regression.sustained === 0 && out.regression.active === 0 && out.regression.held === 0,
    `sustained=${out.regression.sustained} active=${out.regression.active} held=${out.regression.held}`,
  )
  check(
    'qwerty regression drains fully after pedal lift',
    out.regressionAfter.active === 0 && out.regressionAfter.sustained === 0,
    JSON.stringify(out.regressionAfter),
  )
  check(
    'qwerty note bends with performance pad (+200¢ rate 1.1225)',
    Math.abs(out.padBend.cents - 200) < 2 && Math.abs(out.padBend.rate - 1.1225) < 0.005,
    `cents=${out.padBend.cents} rate=${out.padBend.rate}`,
  )
  check('qwerty note coexists with pad modulation (mod 1)', Math.abs(out.padMod - 1) < 0.001, `mod=${out.padMod}`)

  // final state
  check(
    'qwerty final state clean (no voices, defaults restored)',
    out.final.active === 0 &&
      out.final.sustained === 0 &&
      out.final.octave === 0 &&
      out.final.held === 0 &&
      out.final.transpose === 0 &&
      out.final.octaveShift === 0 &&
      out.final.tuning === 0 &&
      out.final.voiceTable === 0,
    JSON.stringify(out.final),
  )
}
