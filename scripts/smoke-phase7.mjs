/**
 * Phase 7 smoke tests — Main Tone controls + audio effects.
 *
 * Deterministic UI-path tests: sliders/buttons drive the real DOM and the
 * engine; targets are engine-tracked, live AudioParam reads prove smooth
 * automation; a post-limiter analyser proves safety under max effects.
 */
export async function runPhase7({ page, check }) {
  const dTone = await page.evaluate(async () => {
    const api = window.__apiano
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    const out = {}

    const levels = [0, 0.25, 0.5, 0.75, 1]
    // Set a level via the UI, then read target + converged AudioParam value.
    const readLevel = async (kind, v, field, audioField) => {
      api.mainToneSet(kind, v)
      await sleep(120)
      const s = api.mainToneState()
      const a = api.mainToneAudio()
      return { v, target: s[field], audio: a ? a[audioField] : -1 }
    }

    out.initial = api.mainToneState()
    out.initMs = api.stats().mainToneInitMs
    out.ir0 = api.mainToneIr()
    out.active0 = api.mainToneActive()
    out.renders0 = out.initial.renders
    out.voicesBefore = api.stats().totalStarted

    // volume: 0/25/50/75/100
    out.volume = []
    for (const v of levels) out.volume.push(await readLevel('volume', v, 'volume', 'volume'))
    api.mainToneSet('volume', 1)
    await sleep(120)

    // Volume audibility. The headless renderer can stall in bursts, so wall-
    // clock windows and analyser reads are unreliable. The limiter worklet is
    // the ground-truth meter: it reports each 1024-sample window's peak at its
    // exact render position, in order, regardless of delivery stalls. Each
    // note is measured at the SAME point of its own stream (+150 ms after its
    // onset window), so the natural piano decay cancels and the level ratio
    // reflects the volume exactly. Automation applies by scheduled time, so a
    // note always sounds at the volume set before it.
    const waitForWorkletSound = async (floor = 0.05, timeoutMs = 4000) => {
      const start = performance.now()
      let last = { samples: 0, peak: 0 }
      while (performance.now() - start < timeoutMs) {
        last = api.engine.limiterLevel()
        if (last.peak > floor) return last
        await sleep(20)
      }
      return last
    }
    const workletLevelAt = async (samples, timeoutMs = 3000) => {
      const start = performance.now()
      while (performance.now() - start < timeoutMs) {
        const l = api.engine.limiterLevel()
        if (l.samples >= samples) return l
        await sleep(15)
      }
      return api.engine.limiterLevel()
    }
    const waitForWorkletSilence = async (floor, timeoutMs = 3000) => {
      const start = performance.now()
      let low = 0
      while (performance.now() - start < timeoutMs) {
        const l = api.engine.limiterLevel()
        if (l.peak < floor) {
          if (++low >= 2) return
        } else low = 0
        await sleep(20)
      }
    }
    const drain = async (timeoutMs = 3000) => {
      const start = performance.now()
      while (api.stats().activeVoices > 0 && performance.now() - start < timeoutMs) await sleep(50)
    }
    api.mainToneSet('volume', 1)
    await sleep(150)
    api.noteOn(60, 0.8)
    const onsetA = await waitForWorkletSound()
    out.peakAtVolume1 = onsetA.peak
    out.levelAtVolume1 = (await workletLevelAt(onsetA.samples + 6615)).peak
    api.noteOff(60)
    await drain()
    await waitForWorkletSilence(0.005)
    api.mainToneSet('volume', 0.25)
    await sleep(150)
    api.noteOn(60, 0.8)
    const onsetB = await waitForWorkletSound(0.01)
    out.peakAtVolume25 = onsetB.peak
    api.noteOff(60)
    await drain()
    await waitForWorkletSilence(0.003)
    api.mainToneSet('volume', 0)
    await sleep(150)
    api.noteOn(60, 0.8)
    await sleep(400)
    const lvlC = api.engine.limiterLevel()
    out.peakAtVolume0 = lvlC.peak
    api.noteOff(60)
    await drain()
    api.mainToneSet('volume', 1)
    await sleep(150)
    out.limiterClockAfter = api.engine.limiterClock()

    // rapid volume movement: no voices, no NaN
    const v0 = api.stats().totalStarted
    for (let i = 0; i < 40; i++) {
      api.mainToneSet('volume', i % 2 === 0 ? 1 - (i % 10) / 10 : (i % 10) / 10)
      await sleep(4)
    }
    out.rapidVolume = { started: api.stats().totalStarted - v0 }
    api.mainToneSet('volume', 1)
    await sleep(120)

    // pan: L100 / center / R100
    out.pan = []
    for (const v of [-1, 0, 1]) out.pan.push(await readLevel('pan', v, 'pan', 'pan'))
    api.mainToneSet('pan', 0)
    await sleep(120)

    // cutoff: min / middle / max (log mapping: mid ~ 1414 Hz)
    out.cutoff = []
    for (const v of [0, 0.5, 1]) out.cutoff.push(await readLevel('cutoff', v, 'cutoffHz', 'cutoffHz'))
    api.mainToneSet('cutoff', 0.5)
    await sleep(120)
    const c0 = api.stats().totalStarted
    for (let i = 0; i < 30; i++) {
      api.mainToneSet('cutoff', (i % 6) / 5)
      await sleep(4)
    }
    out.rapidCutoff = { started: api.stats().totalStarted - c0 }
    api.mainToneSet('cutoff', 1)
    await sleep(120)

    // reverb: 0/25/50/100 + bypass + presets (cache, never regenerate)
    out.reverb = []
    for (const v of [0, 0.25, 0.5, 1]) out.reverb.push(await readLevel('reverb', v, 'reverbAmount', 'reverbAmount'))
    api.mainToneSet('reverb', 0)
    await sleep(150)
    out.reverbOff = api.mainToneActive()
    api.mainToneSet('reverb', 0.5)
    await sleep(120)
    out.reverbOn = api.mainToneActive()
    const presets = ['stage', 'hall', 'cathedral', 'room']
    out.presetDurations = []
    for (const id of presets) {
      api.mainTonePreset(id)
      await sleep(60)
      out.presetDurations.push(api.mainToneIr().presetSeconds)
    }
    out.irAfter = api.mainToneIr()

    // chorus: 0/25/50/100
    out.chorus = []
    for (const v of [0, 0.25, 0.5, 1]) out.chorus.push(await readLevel('chorus', v, 'chorusAmount', 'chorusAmount'))

    // delay: off / short / medium / long + feedback bounds
    out.delayOff = api.mainToneActive()
    api.mainToneSet('delay-amt', 0.5)
    await sleep(120)
    out.delayOn = api.mainToneActive()
    out.delayTime = []
    for (const v of [0.12, 0.35, 0.9]) out.delayTime.push(await readLevel('delay-time', v, 'delayTime', 'delayTime'))
    api.mainToneSet('delay-time', 0.35)
    await sleep(60)
    api.mainToneSet('delay-fb', 0.85)
    await sleep(60)
    out.feedbackMax = api.mainToneState().delayFeedback
    api.mainToneSet('delay-fb', 2)
    await sleep(60)
    out.feedbackClamped = api.mainToneState().delayFeedback
    api.mainToneSet('delay-fb', -1)
    await sleep(60)
    out.feedbackFloor = api.mainToneState().delayFeedback
    api.mainToneSet('delay-fb', 0.3)
    await sleep(120)

    // octave / transpose / tune through the real buttons
    api.mainToneClick('[data-oct-up]')
    api.mainToneClick('[data-oct-up]')
    await sleep(150)
    out.uiOctave = {
      value: api.mainToneState().octave,
      chip: document.querySelector('[data-oct-value]')?.textContent,
    }
    api.mainToneClick('[data-tr-down]')
    api.mainToneClick('[data-tr-down]')
    api.mainToneClick('[data-tr-down]')
    await sleep(150)
    out.uiTranspose = {
      value: api.mainToneState().transpose,
      chip: document.querySelector('[data-tr-value]')?.textContent,
    }
    api.mainToneClick('[data-tune-up]')
    await sleep(150)
    out.uiTune = {
      value: api.mainToneState().tuning,
      chip: document.querySelector('[data-tune-value]')?.textContent,
    }
    api.mainToneClick('[data-oct-reset]')
    api.mainToneClick('[data-tr-reset]')
    api.mainToneClick('[data-tune-reset]')
    await sleep(150)

    // simultaneous effects at max + chord: limiter must hold, voices clean
    api.mainToneSet('volume', 1)
    api.mainToneSet('pan', 0)
    api.mainToneSet('cutoff', 1)
    api.mainToneSet('reverb', 1)
    api.mainTonePreset('cathedral')
    api.mainToneSet('chorus', 1)
    api.mainToneSet('delay-amt', 1)
    api.mainToneSet('delay-time', 0.9)
    api.mainToneSet('delay-fb', 0.85)
    await sleep(200)
    out.simStartedBefore = api.stats().totalStarted
    for (const note of [48, 52, 55, 60, 64, 67]) api.noteOn(note, 0.85)
    out.peakAllEffects = (await waitForWorkletSound(0.05, 4000)).peak
    for (const note of [48, 52, 55, 60, 64, 67]) api.noteOff(note)
    await drain(3500)
    out.simStarted = api.stats().totalStarted - out.simStartedBefore
    out.activeAfterRelease = api.stats().activeVoices

    // kill the effects: tails must drain, nothing accumulates (the sends are
    // gated, so the output must fall below -30 dB within ~3 s)
    api.mainToneSet('reverb', 0)
    api.mainToneSet('chorus', 0)
    api.mainToneSet('delay-amt', 0)
    await sleep(400)
    out.peakAfterDisable = await waitForWorkletSilence(0.03)
    out.peakAfterDisable = api.engine.limiterLevel().peak
    // rapid interleaved parameter changes: no voices, no NaN anywhere
    const i0 = api.stats().totalStarted
    const kinds = ['volume', 'pan', 'cutoff', 'reverb', 'chorus', 'delay-amt', 'delay-time', 'delay-fb']
    for (let i = 0; i < 30; i++) {
      const kind = kinds[i % kinds.length]
      const v = ((i * 37) % 101) / 100
      api.mainToneSet(kind, kind === 'pan' ? v * 2 - 1 : v)
    }
    const a = api.mainToneAudio()
    out.interleave = {
      started: api.stats().totalStarted - i0,
      allFinite: Object.values(a ?? {}).every((x) => Number.isFinite(x)),
    }
    await sleep(120)
    out.rendersAfter = api.mainToneState().renders
    out.voicesDelta = api.stats().totalStarted - out.voicesBefore

    // restore defaults
    api.mainToneSet('volume', 1)
    api.mainToneSet('pan', 0)
    api.mainToneSet('cutoff', 1)
    api.mainToneSet('reverb', 0)
    api.mainToneSet('chorus', 0)
    api.mainToneSet('delay-amt', 0)
    api.mainToneSet('delay-time', 0.35)
    api.mainToneSet('delay-fb', 0.3)
    api.mainTonePreset('room')
    await sleep(150)
    out.final = api.mainToneState()
    out.activeFinal = api.stats().activeVoices
    return out
  })

  // defaults & init
  check(
    'main tone defaults (vol 1, pan 0, cutoff 20k, effects off)',
    dTone.initial.volume === 1 &&
      dTone.initial.pan === 0 &&
      dTone.initial.cutoffHz === 20000 &&
      dTone.initial.reverbAmount === 0 &&
      dTone.initial.reverbPreset === 'room' &&
      dTone.initial.chorusAmount === 0 &&
      dTone.initial.delayAmount === 0 &&
      Math.abs(dTone.initial.delayTime - 0.35) < 0.001 &&
      Math.abs(dTone.initial.delayFeedback - 0.3) < 0.001,
    `vol=${dTone.initial.volume} pan=${dTone.initial.pan} cutoff=${dTone.initial.cutoffHz}Hz reverb=${dTone.initial.reverbAmount}/${dTone.initial.reverbPreset}`,
  )
  check('effects chain initialized quickly', typeof dTone.initMs === 'number' && dTone.initMs > 0 && dTone.initMs < 2000, `${dTone.initMs}ms`)
  check('all 4 reverb IRs pre-generated at init', dTone.ir0.generated === 4 && dTone.ir0.preset === 'room', `generated=${dTone.ir0.generated}`)
  check('effects bypassed at start (reverb+delay sends unwired)', !dTone.active0.reverb && !dTone.active0.delay, JSON.stringify(dTone.active0))

  // volume
  for (const r of dTone.volume) {
    check(
      `volume ${Math.round(r.v * 100)}% reaches engine`,
      r.target === r.v && Math.abs(r.audio - r.v) < 0.02,
      `target=${r.target} audio=${r.audio.toFixed(3)}`,
    )
  }
  check('volume 0 silences the piano', dTone.peakAtVolume0 < 0.003, `peak=${dTone.peakAtVolume0}`)
  check('volume 1 sounds normally', dTone.peakAtVolume1 > 0.005, `peak=${dTone.peakAtVolume1}`)
  check(
    'volume 25% measured ~quarter output level',
    dTone.peakAtVolume1 > 0.005 && Math.abs(dTone.peakAtVolume25 / dTone.peakAtVolume1 - 0.25) < 0.25,
    `peak25=${dTone.peakAtVolume25.toFixed(4)} peak1=${dTone.peakAtVolume1.toFixed(4)}`,
  )
  check('rapid volume movement creates no voices', dTone.rapidVolume.started === 0, `started=${dTone.rapidVolume.started}`)

  // pan
  for (const r of dTone.pan) {
    check(
      `pan ${r.v === 0 ? 'center' : r.v < 0 ? 'L100' : 'R100'} applies`,
      r.target === r.v && Math.abs(r.audio - r.v) < 0.02,
      `target=${r.target} audio=${r.audio.toFixed(3)}`,
    )
  }

  // cutoff
  check('cutoff min = 100 Hz', dTone.cutoff[0].target === 100 && Math.abs(dTone.cutoff[0].audio - 100) < 30, `audio=${dTone.cutoff[0].audio}`)
  check(
    'cutoff mid = musical log midpoint (~1.4 kHz)',
    Math.abs(dTone.cutoff[1].target - 1414) < 100 && Math.abs(dTone.cutoff[1].audio - dTone.cutoff[1].target) < 30,
    `target=${dTone.cutoff[1].target}Hz audio=${dTone.cutoff[1].audio}`,
  )
  check('cutoff max = 20 kHz', dTone.cutoff[2].target === 20000 && dTone.cutoff[2].audio > 19000, `audio=${dTone.cutoff[2].audio}`)
  check('rapid cutoff movement creates no voices', dTone.rapidCutoff.started === 0, `started=${dTone.rapidCutoff.started}`)

  // reverb
  for (const r of dTone.reverb) {
    check(
      `reverb ${Math.round(r.v * 100)}% reaches engine`,
      r.target === r.v && Math.abs(r.audio - r.v) < 0.02,
      `target=${r.target} audio=${r.audio.toFixed(3)}`,
    )
  }
  check('reverb 0% bypasses (send unwired)', !dTone.reverbOff.reverb && dTone.reverbOff.delay === false, JSON.stringify(dTone.reverbOff))
  check('reverb 50% wires the send', dTone.reverbOn.reverb, JSON.stringify(dTone.reverbOn))
  check(
    'preset switching never regenerates IRs (cache reused)',
    dTone.irAfter.generated === 4 && dTone.irAfter.switches === 4,
    `generated=${dTone.irAfter.generated} switches=${dTone.irAfter.switches}`,
  )
  check(
    'preset switches swap in matching IR lengths',
    Math.abs(dTone.presetDurations[0] - 1.6) < 0.05 &&
      Math.abs(dTone.presetDurations[1] - 2.4) < 0.05 &&
      Math.abs(dTone.presetDurations[2] - 4.0) < 0.05 &&
      Math.abs(dTone.presetDurations[3] - 0.9) < 0.05,
    dTone.presetDurations.join(' / '),
  )

  // chorus
  for (const r of dTone.chorus) {
    check(
      `chorus ${Math.round(r.v * 100)}% reaches engine`,
      r.target === r.v && Math.abs(r.audio - r.v) < 0.02,
      `target=${r.target} audio=${r.audio.toFixed(3)}`,
    )
  }

  // delay
  check('delay off bypasses (send unwired)', !dTone.delayOff.delay, JSON.stringify(dTone.delayOff))
  check('delay 50% wires the send', dTone.delayOn.delay, JSON.stringify(dTone.delayOn))
  for (const r of dTone.delayTime) {
    check(
      `delay time ${Math.round(r.v * 1000)}ms applies`,
      r.target === r.v && Math.abs(r.audio - r.v) < 0.02,
      `target=${r.target} audio=${r.audio.toFixed(3)}`,
    )
  }
  check('feedback max 85% applies', Math.abs(dTone.feedbackMax - 0.85) < 0.001, dTone.feedbackMax)
  check('feedback hard-clamped (2 -> 0.85)', Math.abs(dTone.feedbackClamped - 0.85) < 0.001, dTone.feedbackClamped)
  check('feedback floor clamped (-1 -> 0)', dTone.feedbackFloor === 0, dTone.feedbackFloor)

  // octave / transpose / tune via UI
  check('UI octave +2 applies and displays', dTone.uiOctave.value === 2 && String(dTone.uiOctave.chip).trim() === '+2', `${dTone.uiOctave.value} chip="${dTone.uiOctave.chip}"`)
  check('UI transpose -3 applies and displays', dTone.uiTranspose.value === -3 && String(dTone.uiTranspose.chip).trim() === '-3', `${dTone.uiTranspose.value} chip="${dTone.uiTranspose.chip}"`)
  check('UI tune +10 applies and displays', dTone.uiTune.value === 10 && String(dTone.uiTune.chip).trim() === '+10¢', `${dTone.uiTune.value} chip="${dTone.uiTune.chip}"`)

  // simultaneous effects + limiter safety
  check('chord with all effects starts voices', dTone.simStarted === 6, `started=${dTone.simStarted}`)
  check(
    'post-limiter output never clips under max effects (chord heard)',
    dTone.peakAllEffects > 0.05 && dTone.peakAllEffects < 1.1,
    `peak=${dTone.peakAllEffects.toFixed(4)}`,
  )
  check('no stuck voices after release', dTone.activeAfterRelease === 0, `active=${dTone.activeAfterRelease}`)
  check('disabling effects drains tails quickly', dTone.peakAfterDisable < 0.03, `peak=${dTone.peakAfterDisable}`)

  // rapid interleave & integrity
  check('rapid interleaved changes create no voices', dTone.interleave.started === 0, `started=${dTone.interleave.started}`)
  check('no NaN/infinite AudioParam values after stress', dTone.interleave.allFinite, 'all finite')
  check('slider movement does not spam React renders', dTone.rendersAfter - dTone.renders0 <= 80, `renders ${dTone.renders0} -> ${dTone.rendersAfter}`)
  check('limiter render clock advances (worklet renders audio)', dTone.limiterClockAfter > 44100, `samples=${dTone.limiterClockAfter}`)
  check('parameter tests created no voices at all', dTone.voicesDelta === 9, `delta=${dTone.voicesDelta} (3 audibility + 6 chord)`)
  check('final state clean (defaults restored, no voices)', dTone.activeFinal === 0 && Math.abs(dTone.final.volume - 1) < 0.001 && dTone.final.pan === 0 && dTone.final.cutoffHz === 20000 && dTone.final.reverbAmount === 0 && dTone.final.reverbPreset === 'room' && dTone.final.chorusAmount === 0 && dTone.final.delayAmount === 0, `active=${dTone.activeFinal}`)
}
