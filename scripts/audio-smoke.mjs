/**
 * Audio engine smoke test — drives a real headless Chromium against the
 * production build (vite preview) and asserts the engine behaviors that
 * Phases 2, 3 & 4A have to prove. Run after `npm run build`.
 *
 *   node scripts/audio-smoke.mjs
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { runPhase7 } from './smoke-phase7.mjs'
import { runQwerty } from './smoke-qwerty.mjs'
import { runDualTone } from './smoke-dual-tone.mjs'
import { runPhase9 } from './smoke-phase9.mjs'
import { runPhase10 } from './smoke-phase10.mjs'
import { runPhase11 } from './smoke-phase11.mjs'
import { runPhase12 } from './smoke-phase12.mjs'
import { runPhase13 } from './smoke-phase13.mjs'
import { runPhase14 } from './smoke-instruments-keyboard.mjs'
import { runPhase15Features } from './smoke-phase15-features.mjs'
import { runPhase16AudioFoundation } from './smoke-phase16-audio-foundation.mjs'
import { runResetControlsSmoke } from './smoke-reset-controls.mjs'
import { runMousePerformanceSmoke } from './smoke-mouse-performance.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 5199
const BASE = `http://localhost:${PORT}/`

const results = []
let failures = 0
function check(name, ok, extra = '') {
  results.push({ name, ok, extra })
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`)
}

const viteCli = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
const server = spawn(process.execPath, [viteCli, 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
})
let serverLog = ''
server.stdout.on('data', (d) => {
  serverLog += d
})
server.stderr.on('data', (d) => {
  serverLog += d
})

async function waitForServer(timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(BASE)
      if (r.ok) return
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error('preview server did not start. Log:\n' + serverLog.slice(-2000))
}

function findBrowser() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ]
  const found = candidates.find((c) => existsSync(c))
  if (!found) throw new Error('No Chromium-family browser found for the smoke test')
  return found
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  try {
    await waitForServer()

    const browser = await puppeteer.launch({
      executablePath: findBrowser(),
      headless: true,
      protocolTimeout: 360000,
      args: [
        '--autoplay-policy=no-user-gesture-required',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-gpu',
        '--hide-scrollbars',
        '--window-size=1600,900',
      ],
    })

    const page = await browser.newPage()
    const consoleErrors = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        if (!text.includes('ERR_CONNECTION_REFUSED') && !text.includes("unsupported MIME type ('text/html')")) {
          consoleErrors.push(text)
        }
      }
    })
    page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message))
    await page.setViewport({ width: 1600, height: 900 })

    await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 })
    await page.waitForFunction(() => window.__apiano && window.__apiano.engine, { timeout: 20000 })
    await page
      .waitForFunction(
        () => window.__apiano.engine.getDiagnostics().contextState === 'running',
        { timeout: 15000 },
      )
      .catch(() => {})

    const initDiag = await page.evaluate(async () => {
      const api = window.__apiano
      if (!api.engine.isCreated) await api.engine.create()
      await api.engine.unlock()
      return api.engine.getDiagnostics()
    })

    check('context running', initDiag.contextState === 'running', `state=${initDiag.contextState}`)
    check('sample rate valid', initDiag.sampleRate > 0, `${initDiag.sampleRate} Hz`)
    check('limiter is worklet', initDiag.limiter === 'worklet', initDiag.limiter)
    check('polyphony cap >= 32', initDiag.polyphonyCap >= 32, `cap=${initDiag.polyphonyCap}`)

    const canTime = initDiag.contextState === 'running'

    if (canTime) {
      // 1. single note round trip
      await page.evaluate(() => window.__apiano.noteOn(60, 0.7))
      await sleep(150)
      const during = await page.evaluate(() => ({
        active: window.__apiano.stats().activeVoices,
        notes: window.__apiano.activeNotes(),
      }))
      check(
        'single note sounding',
        during.active === 1 && during.notes.length === 1 && during.notes[0] === 60,
        JSON.stringify(during),
      )
      await page.evaluate(() => window.__apiano.noteOff(60))
      // Audio clock in headless can lag wall time; poll until the voice ends.
      const after = await page.evaluate(async () => {
        const api = window.__apiano
        const t0 = performance.now()
        while (performance.now() - t0 < 8000) {
          const s = api.stats()
          if (s.activeVoices === 0) return s
          await new Promise((r) => setTimeout(r, 100))
        }
        return api.stats()
      })
      check('single note drains to 0', after.activeVoices === 0, `active=${after.activeVoices}`)

      // 2. 16-note chord: all started, all released
      const d16 = await page.evaluate(() => window.__apiano.chord(16, 0.7))
      check('chord 16 all started', d16.totalStarted >= 16, `started=${d16.totalStarted}`)
      check('chord 16 drains to 0', d16.activeVoices === 0, `active=${d16.activeVoices}`)

      // 3. rapid same-task storm (noteOff before buffer ready — pending-off path)
      const dRapid = await page.evaluate(() => window.__apiano.rapid(400))
      check('rapid 400 processed', dRapid.totalStarted >= 400, `started=${dRapid.totalStarted}`)
      check('rapid 400 drains to 0', dRapid.activeVoices === 0, `active=${dRapid.activeVoices}`)
      check('rapid 400 no drops', dRapid.dropped === 0, `dropped=${dRapid.dropped}`)

      // 3b. realistic rapid playing with task gaps — same-note retrigger storm.
      // The 4-note cycle keeps the same note recurring inside its release tail,
      // so the retrigger path fires deterministically regardless of spawn
      // latency vs the 6 ms gap (slow spawns also take the pending-off path).
      const dGaps = await page.evaluate(() => window.__apiano.rapidGaps(150, 6))
      check('rapid-gap 150 retriggers', dGaps.retriggers >= 1, `retriggers=${dGaps.retriggers}`)
      check('rapid-gap drains to 0', dGaps.activeVoices === 0, `active=${dGaps.activeVoices}`)
      check('rapid-gap no drops', dGaps.dropped === 0, `dropped=${dGaps.dropped}`)

      // 4. voice pool bounded across repeat bursts
      const poolA = (await page.evaluate(() => window.__apiano.stats())).poolSize
      await page.evaluate(() => window.__apiano.rapid(400))
      const poolB = (await page.evaluate(() => window.__apiano.stats())).poolSize
      check(
        'voice pool does not grow',
        poolB <= Math.max(poolA, initDiag.polyphonyCap),
        `pool ${poolA} -> ${poolB} (cap ${initDiag.polyphonyCap})`,
      )

      // 5. over-cap storm: real voice stealing + adaptive polyphony
      const dStress = await page.evaluate(() => window.__apiano.stress(90))
      check(
        'stress 90 stays within initial cap',
        dStress.activeVoices <= initDiag.polyphonyCap,
        `active=${dStress.activeVoices} cap=${initDiag.polyphonyCap}`,
      )
      check('stealing engaged over cap', dStress.steals > 0, `steals=${dStress.steals}`)
      await page.evaluate(() => window.__apiano.allOff())
      await sleep(900)
      const afterStress = await page.evaluate(() => window.__apiano.stats())
      check('stress drains to 0', afterStress.activeVoices === 0, `active=${afterStress.activeVoices}`)
      // adaptive polyphony: the cap must halve under pressure, then recover
      const adaptTrace = await page.evaluate(async () => {
        const api = window.__apiano
        let min = api.stats().polyphonyCap
        let last = min
        const t0 = performance.now()
        while (performance.now() - t0 < 12000) {
          await new Promise((r) => setTimeout(r, 300))
          last = api.stats().polyphonyCap
          if (last < min) min = last
        }
        return { min, last }
      })
      check('adaptive cap reduced under pressure', adaptTrace.min < initDiag.polyphonyCap, `min=${adaptTrace.min}`)
      check('adaptive cap recovers when idle', adaptTrace.last === initDiag.polyphonyCap, `last=${adaptTrace.last}`)

      // 6. same-note retrigger x3
      const beforeR = (await page.evaluate(() => window.__apiano.stats())).totalStarted
      await page.evaluate(() => {
        window.__apiano.noteOn(64, 0.6)
        window.__apiano.noteOn(64, 0.8)
        window.__apiano.noteOn(64, 1.0)
        window.__apiano.noteOff(64)
      })
      await sleep(800)
      const afterR = await page.evaluate(() => window.__apiano.stats())
      check(
        'same-note retrigger x3',
        afterR.totalStarted - beforeR === 3,
        `delta=${afterR.totalStarted - beforeR}`,
      )
      check('retrigger drains to 0', afterR.activeVoices === 0, `active=${afterR.activeVoices}`)

      // 7. sustain pedal holds, then releases
      await page.evaluate(() => {
        window.__apiano.sustainOn()
        for (let i = 0; i < 8; i++) window.__apiano.noteOn(48 + i, 0.7)
      })
      await sleep(200)
      await page.evaluate(() => {
        for (let i = 0; i < 8; i++) window.__apiano.noteOff(48 + i)
      })
      await sleep(300)
      const held = await page.evaluate(() => window.__apiano.stats())
      check('sustain holds after key-up', held.activeVoices === 8, `active=${held.activeVoices}`)
      await page.evaluate(() => window.__apiano.sustainOff())
      await sleep(900)
      const released = await page.evaluate(() => window.__apiano.stats())
      check('sustain drains on pedal lift', released.activeVoices === 0, `active=${released.activeVoices}`)

      // 8. React must not re-render the keyboard during note bursts
      const rc = await page.evaluate(() => window.__apiano.keyboardRenders.count)
      await page.evaluate(() => window.__apiano.rapid(200))
      await sleep(400)
      const rc2 = await page.evaluate(() => window.__apiano.keyboardRenders.count)
      check('keyboard not re-rendered during notes', rc2 === rc, `renders ${rc} -> ${rc2}`)

      // 9. heap stability (Chrome-only metric)
      const heapBefore = await page.evaluate(() =>
        performance.memory ? performance.memory.usedJSHeapSize : 0,
      )
      await page.evaluate(() => window.__apiano.rapid(500))
      await page.evaluate(() => window.__apiano.chord(20, 0.8))
      const heapAfter = await page.evaluate(() =>
        performance.memory ? performance.memory.usedJSHeapSize : 0,
      )
      if (heapBefore > 0) {
        const deltaMb = (heapAfter - heapBefore) / 1048576
        check('heap growth bounded', deltaMb < 60, `${deltaMb.toFixed(1)} MB`)
      } else {
        check('heap growth bounded', true, 'performance.memory unavailable')
      }

      // ---- Phase 3: Grand Piano (real multisampled instrument) ----
      const bootPage = async () => {
        await page.evaluate(async () => {
          const api = window.__apiano
          if (!api.engine.isCreated) await api.engine.create()
          await api.engine.unlock()
        })
        await page
          .waitForFunction(
            () => window.__apiano.engine.getDiagnostics().contextState === 'running',
            { timeout: 15000 },
          )
          .catch(() => {})
      }

      // 10. Cold load: wipe the cache, reload the page, load all 60 samples
      await page.evaluate(() => window.__apiano.clearSampleCache())
      await page.reload({ waitUntil: 'networkidle0', timeout: 60000 })
      await page.waitForFunction(() => window.__apiano && window.__apiano.engine, { timeout: 20000 })
      await bootPage()
      const cold = await page.evaluate(async () => {
        const api = window.__apiano
        await api.setInstrument('grand-piano')
        const { ms, state } = await api.awaitLoad('ready', 240000)
        return { ms, state }
      })
      check('grand-piano cold load ready', cold.state.status === 'ready', `${Math.round(cold.ms)} ms`)
      check(
        'grand-piano all 60 files loaded',
        cold.state.progress.loadedFiles === cold.state.progress.totalFiles && cold.state.progress.totalFiles === 60,
        `${cold.state.progress.loadedFiles}/${cold.state.progress.totalFiles}`,
      )
      check('grand-piano cold load under 240 s', cold.ms < 240000, `${Math.round(cold.ms)} ms`)
      check('grand-piano manifest reports bytes', cold.state.progress.totalBytes > 50 * 1024 * 1024, `${(cold.state.progress.totalBytes / 1048576).toFixed(1)} MB`)

      // 11. First note plays lazily before the full set is loaded
      await page.evaluate(() => window.__apiano.clearSampleCache())
      await page.reload({ waitUntil: 'networkidle0', timeout: 60000 })
      await page.waitForFunction(() => window.__apiano && window.__apiano.engine, { timeout: 20000 })
      await bootPage()
      const lazy = await page.evaluate(async () => {
        const api = window.__apiano
        await api.setInstrument('grand-piano')
        const before = api.stats().totalStarted
        api.noteOn(60, 0.8)
        const t0 = performance.now()
        while (performance.now() - t0 < 15000) {
          const s = api.stats()
          if (s.totalStarted > before) {
            api.noteOff(60)
            return { startedMs: performance.now() - t0, noteTiming: s.noteTiming, status: s.instrumentLoad?.status }
          }
          await new Promise((r) => setTimeout(r, 50))
        }
        return { timedOut: true }
      })
      check('grand-piano first note lazy', !lazy.timedOut && lazy.startedMs < 15000, `started in ${Math.round(lazy.startedMs)} ms`)
      check(
        'grand-piano first note buffer ready fast',
        !lazy.timedOut && lazy.noteTiming.lastBufferReadyMs < 5000,
        `${Math.round(lazy.noteTiming?.lastBufferReadyMs ?? -1)} ms`,
      )
      check('grand-piano background load still in progress', lazy.status === 'loading', `status=${lazy.status}`)

      // 12. Warm load: same origin, cache warm — decode from IndexedDB only
      const warm = await page.evaluate(async () => {
        const api = window.__apiano
        await api.setInstrument('grand-piano')
        const { ms, state } = await api.awaitLoad('ready', 120000)
        return { ms, state }
      })
      check('grand-piano warm load ready', warm.state.status === 'ready', `${Math.round(warm.ms)} ms`)
      check('grand-piano warm load under 60 s', warm.ms < 60000, `${Math.round(warm.ms)} ms`)
      check('grand-piano warm faster than cold', warm.ms < cold.ms, `warm ${Math.round(warm.ms)} vs cold ${Math.round(cold.ms)} ms`)

      // 13. Note timing on warm cache: first touch re-decodes from IDB (LRU
      // evicted the early files under the 128 MB budget), second touch hits
      // the decoded LRU.
      const dTimed1 = await page.evaluate(() => window.__apiano.timedNote(60))
      const dTimed2 = await page.evaluate(() => window.__apiano.timedNote(60))
      check(
        'grand-piano warm note < 100 ms to buffer',
        dTimed2.noteTiming && dTimed2.noteTiming.lastBufferReadyMs < 100,
        `${Math.round(dTimed2.noteTiming?.lastBufferReadyMs ?? -1)} ms`,
      )
      check('grand-piano warm note drains', dTimed2.activeVoices === 0, `active=${dTimed2.activeVoices}`)
      check(
        'grand-piano sample cache hits',
        (dTimed2.sampleCache?.hits ?? 0) > (dTimed1.sampleCache?.hits ?? 0),
        `hits ${dTimed1.sampleCache?.hits} -> ${dTimed2.sampleCache?.hits}`,
      )
      check(
        'grand-piano decode cache within budget',
        (dTimed2.sampleCache?.decodedBytes ?? 0) <= 128 * 1024 * 1024 * 1.05,
        `${((dTimed2.sampleCache?.decodedBytes ?? 0) / 1048576).toFixed(1)} MB`,
      )

      // 14. Chords / rapid / sustain on real samples
      const d16g = await page.evaluate(() => window.__apiano.chord(16, 0.7))
      check('grand-piano chord 16 all started', d16g.totalStarted >= 16, `started=${d16g.totalStarted}`)
      check('grand-piano chord 16 drains', d16g.activeVoices === 0, `active=${d16g.activeVoices}`)
      const dRapG = await page.evaluate(() => window.__apiano.rapid(300))
      check('grand-piano rapid 300 processed', dRapG.totalStarted >= 300, `started=${dRapG.totalStarted}`)
      check('grand-piano rapid drains', dRapG.activeVoices === 0, `active=${dRapG.activeVoices}`)
      check('grand-piano rapid no drops', dRapG.dropped === 0, `dropped=${dRapG.dropped}`)

      // 15. noteOff before sample ready (cache cleared mid-session) — pending-off path.
      // Voice stealing is the designed pressure relief when fetches pile up,
      // so only drains and no-drops are asserted here.
      const dPend = await page.evaluate(async () => {
        const api = window.__apiano
        await api.clearSampleCache()
        const d = await api.rapid(150)
        return d
      })
      check('grand-piano pending-off storm drains', dPend.activeVoices === 0, `active=${dPend.activeVoices}`)
      check('grand-piano pending-off storm no drops', dPend.dropped === 0, `dropped=${dPend.dropped}`)

      // 16. Full 88-key zone coverage (every note must resolve to a sample zone)
      const dCover = await page.evaluate(async () => {
        const api = window.__apiano
        await api.setInstrument('grand-piano')
        const before = api.stats().totalStarted
        for (let n = 21; n <= 108; n++) {
          api.noteOn(n, 0.5)
          await new Promise((r) => setTimeout(r, 10))
          api.noteOff(n)
        }
        const t0 = performance.now()
        while (performance.now() - t0 < 30000) {
          const s = api.stats()
          if (s.totalStarted >= before + 88 && s.activeVoices === 0) {
            return { startedDelta: s.totalStarted - before, active: s.activeVoices }
          }
          await new Promise((r) => setTimeout(r, 100))
        }
        const s = api.stats()
        return { startedDelta: s.totalStarted - before, active: s.activeVoices }
      })
      check(
        'grand-piano full-range zone coverage',
        dCover.startedDelta === 88 && dCover.active === 0,
        `delta=${dCover.startedDelta}, active=${dCover.active}`,
      )

      // 17. Sustain on samples
      await page.evaluate(() => {
        window.__apiano.sustainOn()
        for (let i = 0; i < 8; i++) window.__apiano.noteOn(48 + i, 0.7)
      })
      await sleep(200)
      await page.evaluate(() => {
        for (let i = 0; i < 8; i++) window.__apiano.noteOff(48 + i)
      })
      await sleep(300)
      const heldG = await page.evaluate(() => window.__apiano.stats())
      check('grand-piano sustain holds', heldG.activeVoices === 8, `active=${heldG.activeVoices}`)
      await page.evaluate(() => window.__apiano.sustainOff())
      await sleep(900)
      const releasedG = await page.evaluate(() => window.__apiano.stats())
      check('grand-piano sustain drains', releasedG.activeVoices === 0, `active=${releasedG.activeVoices}`)

      // ---- Phase 4A: playability & performance (grand piano, warm cache) ----

      // 18. Sustain deep: re-strike under pedal, same-note hammer under pedal,
      // rapid pedal cycles, MIDI CC64-ready toggle, no stuck voices.
      const dSustainDeep = await page.evaluate(async () => {
        const api = window.__apiano
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

        // 18a. pedal holds 8; re-strike one note under pedal (retrigger)
        api.sustainOn()
        for (let i = 0; i < 8; i++) api.noteOn(48 + i, 0.7)
        await sleep(200)
        for (let i = 0; i < 8; i++) api.noteOff(48 + i)
        await sleep(200)
        const held8 = api.stats().activeVoices

        api.noteOn(52, 0.9)
        await sleep(120)
        const afterRestrike = api.stats().activeVoices
        api.noteOff(52)
        await sleep(200)
        const heldAfterOff = api.stats().activeVoices

        api.sustainOff()
        const t0 = performance.now()
        while (performance.now() - t0 < 8000) {
          if (api.stats().activeVoices === 0) break
          await sleep(100)
        }
        const drainedA = api.stats().activeVoices

        // 18b. same-note hammer under pedal — must stay bounded and drain
        api.sustainOn()
        for (let i = 0; i < 10; i++) {
          api.noteOn(60, 0.8)
          api.noteOff(60)
          await sleep(30)
        }
        await sleep(150)
        const peakDuring = api.stats().activeVoices
        api.sustainOff()
        const t1 = performance.now()
        while (performance.now() - t1 < 8000) {
          if (api.stats().activeVoices === 0) break
          await sleep(100)
        }
        const drainedB = api.stats().activeVoices

        // 18c. rapid pedal cycles
        let cyclePeak = 0
        for (let c = 0; c < 5; c++) {
          api.sustainOn()
          for (let i = 0; i < 6; i++) api.noteOn(36 + c + i, 0.6)
          await sleep(80)
          for (let i = 0; i < 6; i++) api.noteOff(36 + c + i)
          api.sustainOff()
          await sleep(120)
          const a = api.stats().activeVoices
          if (a > cyclePeak) cyclePeak = a
        }
        const t2 = performance.now()
        while (performance.now() - t2 < 8000) {
          if (api.stats().activeVoices === 0) break
          await sleep(100)
        }
        const d = api.stats()

        // 18d. CC64 mapping readiness: toggle twice returns to off
        api.sustainOn()
        const tog1 = api.stats().sustain
        api.sustainOff()
        const tog2 = api.stats().sustain
        return {
          held8,
          afterRestrike,
          heldAfterOff,
          drainedA,
          peakDuring,
          drainedB,
          cyclePeak,
          drainedC: d.activeVoices,
          stuck: api.voices().length,
          tog1,
          tog2,
        }
      })
      check('sustain holds 8 under pedal', dSustainDeep.held8 === 8, `active=${dSustainDeep.held8}`)
      check(
        'sustain re-strike retriggers without growth',
        dSustainDeep.afterRestrike >= 8 && dSustainDeep.afterRestrike <= 9,
        `active=${dSustainDeep.afterRestrike}`,
      )
      check('sustain re-strike holds after key-up', dSustainDeep.heldAfterOff === 8, `active=${dSustainDeep.heldAfterOff}`)
      check('sustain 8 drains on pedal lift', dSustainDeep.drainedA === 0, `active=${dSustainDeep.drainedA}`)
      check('same-note hammer under sustain bounded', dSustainDeep.peakDuring <= 4, `peak=${dSustainDeep.peakDuring}`)
      check('same-note hammer under sustain drains', dSustainDeep.drainedB === 0, `active=${dSustainDeep.drainedB}`)
      check('rapid pedal cycles bounded', dSustainDeep.cyclePeak <= 12, `peak=${dSustainDeep.cyclePeak}`)
      check('rapid pedal cycles drain to 0', dSustainDeep.drainedC === 0, `active=${dSustainDeep.drainedC}`)
      check('no stuck voices after sustain stress', dSustainDeep.stuck === 0, `voices=${dSustainDeep.stuck}`)
      check('CC64 toggle maps to engine pedal', dSustainDeep.tog1 === true && dSustainDeep.tog2 === false, `on=${dSustainDeep.tog1} off=${dSustainDeep.tog2}`)

      // 19. Octave & transpose: real note remapping, correct zones, no reloads
      const dTuning = await page.evaluate(async () => {
        const api = window.__apiano
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
        const playAndRead = async (key, effective) => {
          api.noteOn(key, 0.8)
          const t0 = performance.now()
          let voice = null
          while (performance.now() - t0 < 4000) {
            // Newest attack-state voice: the one this noteOn just spawned.
            const matches = api.voices().filter((v) => v.midiNote === effective && v.state === 'attack')
            if (matches.length > 0) {
              voice = matches[matches.length - 1]
              break
            }
            await sleep(20)
          }
          api.noteOff(key)
          const t1 = performance.now()
          while (performance.now() - t1 < 8000) {
            if (api.stats().activeVoices === 0) break
            await sleep(50)
          }
          return voice ? { midiNote: voice.midiNote, rate: voice.playbackRate } : null
        }
        const missesBefore = api.stats().sampleCache?.misses ?? 0
        const out = { missesBefore }

        api.engine.setOctaveShift(1)
        out.octaveUp = await playAndRead(60, 72)
        api.engine.setOctaveShift(-1)
        out.octaveDown = await playAndRead(60, 48)
        api.engine.setOctaveShift(0)
        api.engine.setTranspose(5)
        out.transposeUp = await playAndRead(60, 65)
        api.engine.setTranspose(-12)
        out.transposeDown = await playAndRead(60, 48)
        api.engine.setTranspose(0)
        api.engine.setOctaveShift(1)
        api.engine.setTranspose(-2)
        out.combo = await playAndRead(60, 70)
        api.engine.resetTuning()
        out.reset = await playAndRead(60, 60)

        // no sample reloads: same key at octave +2/+3 on the warm cache
        api.engine.setOctaveShift(2)
        await playAndRead(60, 84)
        api.engine.setOctaveShift(3)
        await playAndRead(60, 96)
        const missesAfter = api.stats().sampleCache?.misses ?? 0
        api.engine.resetTuning()
        out.missesAfterOctaves = missesAfter
        out.diag = {
          transpose: api.stats().transpose,
          octaveShift: api.stats().octaveShift,
          tuningCents: api.stats().tuningCents,
        }
        return out
      })
      check('octave +1 plays up an octave', dTuning.octaveUp?.midiNote === 72, `midiNote=${dTuning.octaveUp?.midiNote}`)
      check(
        'octave +1 plays the real C5 sample (rate ~1)',
        Math.abs((dTuning.octaveUp?.rate ?? 0) - 1) < 0.02,
        `rate=${dTuning.octaveUp?.rate}`,
      )
      check('octave -1 plays down an octave', dTuning.octaveDown?.midiNote === 48, `midiNote=${dTuning.octaveDown?.midiNote}`)
      check('transpose +5 plays F5', dTuning.transposeUp?.midiNote === 65, `midiNote=${dTuning.transposeUp?.midiNote}`)
      check('transpose -12 plays down an octave', dTuning.transposeDown?.midiNote === 48, `midiNote=${dTuning.transposeDown?.midiNote}`)
      check('octave+transpose combine correctly', dTuning.combo?.midiNote === 70, `midiNote=${dTuning.combo?.midiNote}`)
      check('reset restores untransposed note', dTuning.reset?.midiNote === 60, `midiNote=${dTuning.reset?.midiNote}`)
      check(
        'tuning diagnostics reset to 0',
        dTuning.diag.transpose === 0 && dTuning.diag.octaveShift === 0 && dTuning.diag.tuningCents === 0,
        JSON.stringify(dTuning.diag),
      )
      check(
        'octave changes reload no samples (warm)',
        dTuning.missesAfterOctaves === dTuning.missesBefore,
        `misses ${dTuning.missesBefore} -> ${dTuning.missesAfterOctaves}`,
      )

      // 20. Fine tuning (cents): shifts playback rate, never zone selection.
      // Deterministic: each case waits for the NEW attack-state voice of the
      // note (stale releasing voices of the same note are ignored) and fully
      // drains before the next tuning change.
      const dTune = await page.evaluate(async () => {
        const api = window.__apiano
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
        const drainVoices = async () => {
          const t0 = performance.now()
          while (performance.now() - t0 < 8000) {
            if (api.stats().activeVoices === 0) return
            await sleep(50)
          }
        }
        const readRate = async (note) => {
          api.noteOn(note, 0.8)
          const t0 = performance.now()
          let v = null
          while (performance.now() - t0 < 4000) {
            // Newest attack-state voice: the one this noteOn just spawned.
            const matches = api.voices().filter((x) => x.midiNote === note && x.state === 'attack')
            if (matches.length > 0) {
              v = matches[matches.length - 1]
              break
            }
            await sleep(20)
          }
          api.noteOff(note)
          await drainVoices()
          return v ? v.playbackRate : -1
        }
        const zone0 = await api.zoneFor(60, 0.8)

        api.setTuningCents(50)
        const diag50 = api.stats().tuningCents
        const rate50 = await readRate(60)
        const zone50 = await api.zoneFor(60, 0.8)

        // direct +50 -> -100 switch on the same note
        api.setTuningCents(-100)
        const diagNeg = api.stats().tuningCents
        const rateNeg = await readRate(60)
        const zoneNeg = await api.zoneFor(60, 0.8)

        // direct -100 -> +100 switch
        api.setTuningCents(100)
        const diag100 = api.stats().tuningCents
        const rate100 = await readRate(60)

        // -50
        api.setTuningCents(-50)
        const rate50neg = await readRate(60)

        // back to 0
        api.setTuningCents(0)
        const rate0 = await readRate(60)
        return {
          zone0,
          diag50,
          rate50,
          zone50,
          diagNeg,
          rateNeg,
          zoneNeg,
          diag100,
          rate100,
          rate50neg,
          rate0,
        }
      })
      const centsToFactor = (c) => Math.pow(2, c / 1200)
      check(
        'tuning diagnostics report cents',
        dTune.diag50 === 50 && dTune.diagNeg === -100 && dTune.diag100 === 100,
        `50 -> ${dTune.diag50}, -100 -> ${dTune.diagNeg}, 100 -> ${dTune.diag100}`,
      )
      check(
        'tuning +50 raises playback rate',
        Math.abs(dTune.rate50 - centsToFactor(50)) < 0.005,
        `rate=${dTune.rate50.toFixed(4)} expected=${centsToFactor(50).toFixed(4)}`,
      )
      check(
        'tuning -100 lowers playback rate',
        Math.abs(dTune.rateNeg - centsToFactor(-100)) < 0.005,
        `rate=${dTune.rateNeg.toFixed(4)} expected=${centsToFactor(-100).toFixed(4)}`,
      )
      check(
        'tuning +100 after -100 (direct switch)',
        Math.abs(dTune.rate100 - centsToFactor(100)) < 0.005,
        `rate=${dTune.rate100.toFixed(4)} expected=${centsToFactor(100).toFixed(4)}`,
      )
      check(
        'tuning -50 lowers playback rate',
        Math.abs(dTune.rate50neg - centsToFactor(-50)) < 0.005,
        `rate=${dTune.rate50neg.toFixed(4)} expected=${centsToFactor(-50).toFixed(4)}`,
      )
      check('tuning 0 restores base rate', Math.abs(dTune.rate0 - 1) < 0.005, `rate=${dTune.rate0.toFixed(4)}`)
      check(
        'tuning does not change zone selection',
        dTune.zone0?.sample === dTune.zone50?.sample && dTune.zone50?.sample === dTune.zoneNeg?.sample,
        `zone=${dTune.zone50?.sample}`,
      )

      // 21. Velocity layers: soft vs loud samples, boundary at 63/64.
      // Voice reads use the same newest-attack-state rule as section 20.
      const dVel = await page.evaluate(async () => {
        const api = window.__apiano
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
        const zone = async (note, vel) => (await api.zoneFor(note, vel))?.sample ?? 'none'
        const out = {
          c4soft: await zone(60, 0.2),
          c4mid: await zone(60, 0.4),
          c4loud: await zone(60, 0.7),
          c4full: await zone(60, 1.0),
          a2soft: await zone(45, 0.2),
          a2loud: await zone(45, 0.7),
          boundary63: await zone(60, 62 / 127),
          boundary64: await zone(60, 64 / 127),
          played: [],
        }
        for (const vel of [0.2, 0.4, 0.7, 1.0]) {
          const before = api.stats().totalStarted
          api.noteOn(60, vel)
          const t0 = performance.now()
          let v = null
          while (performance.now() - t0 < 4000) {
            const matches = api.voices().filter((x) => x.midiNote === 60 && x.state === 'attack')
            if (matches.length > 0) {
              v = matches[matches.length - 1]
              break
            }
            await sleep(20)
          }
          out.played.push({ vel, started: api.stats().totalStarted - before === 1, voiceVel: v ? v.velocity : -1 })
          api.noteOff(60)
          const t1 = performance.now()
          while (performance.now() - t1 < 8000) {
            if (api.stats().activeVoices === 0) break
            await sleep(50)
          }
        }
        return out
      })
      check('soft velocity selects soft layer', /v1/.test(dVel.c4soft) && /v1/.test(dVel.c4mid), `soft=${dVel.c4soft} mid=${dVel.c4mid}`)
      check('loud velocity selects loud layer', /v16/.test(dVel.c4loud) && /v16/.test(dVel.c4full), `loud=${dVel.c4loud} full=${dVel.c4full}`)
      check('velocity layer boundary at 63/64', /v1/.test(dVel.boundary63) && /v16/.test(dVel.boundary64), `63=${dVel.boundary63} 64=${dVel.boundary64}`)
      check('velocity layers on low notes too', /v1/.test(dVel.a2soft) && /v16/.test(dVel.a2loud), `soft=${dVel.a2soft} loud=${dVel.a2loud}`)
      check(
        'all velocities play through',
        dVel.played.every((p) => p.started && Math.abs(p.voiceVel - p.vel) < 0.001),
        JSON.stringify(dVel.played),
      )

      // 22. Rapid retrigger / hammering on real samples (same-note x20)
      const heapP4a = await page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize : 0))
      const dRe = await page.evaluate(async () => {
        const api = window.__apiano
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
        const hammer = async (note, times, gap) => {
          const before = api.stats().totalStarted
          for (let i = 0; i < times; i++) {
            api.noteOn(note, 0.7 + (i % 3) * 0.1)
            await sleep(gap)
            api.noteOff(note)
            await sleep(gap)
          }
          return api.stats().totalStarted - before
        }
        const r1 = await hammer(60, 5, 40)
        const t0 = performance.now()
        while (performance.now() - t0 < 8000) {
          if (api.stats().activeVoices === 0) break
          await sleep(100)
        }
        const d1 = api.stats()
        const r2 = await hammer(60, 20, 15)
        const r3 = await hammer(88, 20, 15)
        const r4 = await hammer(36, 20, 15)
        const t1 = performance.now()
        while (performance.now() - t1 < 12000) {
          if (api.stats().activeVoices === 0) break
          await sleep(100)
        }
        const d2 = api.stats()
        return {
          r1,
          d1Active: d1.activeVoices,
          d1Dropped: d1.dropped,
          r2,
          r3,
          r4,
          d2Active: d2.activeVoices,
          d2Dropped: d2.dropped,
          stuck: api.voices().length,
          pool: d2.poolSize,
          cap: d2.polyphonyCap,
        }
      })
      check('hammer C4 x5 plays 5', dRe.r1 === 5, `started=${dRe.r1}`)
      check('hammer C4 x5 drains', dRe.d1Active === 0, `active=${dRe.d1Active}`)
      check('hammer x20 no drops (mid)', dRe.d2Dropped === 0 && dRe.r2 === 20, `started=${dRe.r2} dropped=${dRe.d2Dropped}`)
      check('hammer x20 no drops (high)', dRe.r3 === 20, `started=${dRe.r3}`)
      check('hammer x20 no drops (low)', dRe.r4 === 20, `started=${dRe.r4}`)
      check('hammer stress drains', dRe.d2Active === 0, `active=${dRe.d2Active}`)
      check('no stuck voices after hammer', dRe.stuck === 0, `voices=${dRe.stuck}`)
      check('voice pool stays within cap', dRe.pool <= dRe.cap, `pool=${dRe.pool} cap=${dRe.cap}`)

      // 23. Chord stress: 3/5/8/10/12 voices, fast chord changes, heap
      const dChord = await page.evaluate(async () => {
        const api = window.__apiano
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
        const drain = async () => {
          const t0 = performance.now()
          while (performance.now() - t0 < 10000) {
            if (api.stats().activeVoices === 0) return true
            await sleep(100)
          }
          return false
        }
        const sizes = [3, 5, 8, 10, 12]
        const out = { started: {}, drained: {}, peak: api.stats().peakActiveVoices }
        for (const n of sizes) {
          const s0 = api.stats().totalStarted
          for (let i = 0; i < n; i++) api.noteOn(36 + i, 0.3)
          await sleep(250)
          for (let i = 0; i < n; i++) api.noteOff(36 + i)
          out.started[n] = api.stats().totalStarted - s0
          out.drained[n] = await drain()
          out.peak = Math.max(out.peak, api.stats().peakActiveVoices)
        }
        // fast chord changes: 40 x 3-note chords, 60 ms apart, alternating velocity
        await drain()
        const d0 = api.stats()
        for (let c = 0; c < 40; c++) {
          const root = 24 + ((c * 5) % 36)
          for (let i = 0; i < 3; i++) api.noteOn(root + i, c % 2 === 0 ? 0.3 : 0.9)
          await sleep(30)
          for (let i = 0; i < 3; i++) api.noteOff(root + i)
          await sleep(30)
        }
        const drainedFast = await drain()
        const d1 = api.stats()
        out.fast = {
          dropped: d1.dropped - d0.dropped,
          drained: drainedFast,
          started: d1.totalStarted - d0.totalStarted,
        }
        return out
      })
      check('chord sizes all start', [3, 5, 8, 10, 12].every((n) => dChord.started[n] === n), JSON.stringify(dChord.started))
      check('chord sizes all drain', [3, 5, 8, 10, 12].every((n) => dChord.drained[n]), JSON.stringify(dChord.drained))
      check('fast chord changes no drops', dChord.fast.dropped === 0, `dropped=${dChord.fast.dropped}`)
      check('fast chord changes drain', dChord.fast.drained, `started=${dChord.fast.started}`)
      check('chord stress peak within cap', dChord.peak <= initDiag.polyphonyCap, `peak=${dChord.peak} cap=${initDiag.polyphonyCap}`)

      const heapP4b = await page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize : 0))
      if (heapP4a > 0) {
        const deltaMb = (heapP4b - heapP4a) / 1048576
        check('phase4A stress heap bounded', deltaMb < 60, `${deltaMb.toFixed(1)} MB`)
      } else {
        check('phase4A stress heap bounded', true, 'performance.memory unavailable')
      }

      // 24. Release quality — analyser-level release profile (no click spikes)
      const dRel = await page.evaluate(async () => {
        const api = window.__apiano
        const out = {}
        for (const note of [60, 88, 36]) {
          out[note] = await api.releaseProfile(note, 0.9, 150, 600)
        }
        return out
      })
      const releaseOk = (profile) => {
        if (!profile || profile.length < 6) return { head: 0, tail: 1, jumps: 99, ok: false }
        const head = Math.max(...profile.slice(0, 3))
        const tail = Math.max(...profile.slice(-3))
        let jumps = 0
        for (let i = 1; i < profile.length; i++) {
          if (profile[i] > profile[i - 1] * 1.5) jumps++
        }
        return { head, tail, jumps, ok: head > 0.005 && tail < 0.015 && jumps <= 2 }
      }
      for (const note of [60, 88, 36]) {
        const label = note === 60 ? 'C4' : note === 88 ? 'high' : 'low'
        const r = releaseOk(dRel[note])
        check(
          `release profile decays cleanly (${label})`,
          r.ok,
          `head=${r.head.toFixed(4)} tail=${r.tail.toFixed(4)} jumps=${r.jumps}`,
        )
      }

      // 25. Performance report (measured values only)
      const perf = await page.evaluate(() => {
        const d = window.__apiano.stats()
        return {
          peakActiveVoices: d.peakActiveVoices,
          poolSize: d.poolSize,
          polyphonyCap: d.polyphonyCap,
          steals: d.steals,
          dropped: d.dropped,
          retriggers: d.retriggers,
          totalStarted: d.totalStarted,
          cacheHits: d.sampleCache?.hits ?? 0,
          cacheMisses: d.sampleCache?.misses ?? 0,
          decodedBytes: d.sampleCache?.decodedBytes ?? 0,
          noteTiming: d.noteTiming,
          loadState: d.instrumentLoad?.status,
        }
      })
      console.log('--- Phase 4A performance report (measured) ---')
      console.log(
        `peakActiveVoices=${perf.peakActiveVoices} pool=${perf.poolSize} cap=${perf.polyphonyCap} ` +
          `steals=${perf.steals} dropped=${perf.dropped} retriggers=${perf.retriggers}`,
      )
      console.log(
        `sample cache: ${perf.cacheHits} hits, ${perf.cacheMisses} misses, ${(perf.decodedBytes / 1048576).toFixed(1)} MB decoded`,
      )
      console.log(
        `note timing: last=${perf.noteTiming?.lastBufferReadyMs.toFixed(2)}ms ` +
          `avg=${perf.noteTiming?.avgBufferReadyMs.toFixed(2)}ms ` +
          `max=${perf.noteTiming?.maxBufferReadyMs.toFixed(2)}ms ` +
          `lastStart=${perf.noteTiming?.lastStartMs.toFixed(2)}ms lead=${perf.noteTiming?.schedulingLeadMs}ms`,
      )
      console.log(`cold load=${Math.round(cold.ms)}ms warm load=${Math.round(warm.ms)}ms`)
    } else {
      console.log('NOTE: context not running — timing-dependent checks skipped (context is suspended)')
    }

    // ---- Phase 5: MIDI input + performance controls -----------------------
    // Runs in three page loads: (26) no mock — graceful real-browser behavior,
    // (27-33) a Web MIDI mock — full discovery/hot-plug/message testing,
    // (34) a rejecting requestMIDIAccess — unsupported-browser fallback.
    const midiCentsToFactor = (c) => Math.pow(2, c / 1200)
    const mockMidiScript = () => {
      const inputs = new Map()
      const makePort = (id, name, manufacturer, state) => ({
        id,
        name,
        manufacturer,
        state,
        connection: state === 'connected' ? 'open' : 'pending',
        type: 'input',
        version: '1.0',
        _midiListeners: [],
        addEventListener(type, fn) {
          if (type === 'midimessage') this._midiListeners.push(fn)
        },
        removeEventListener(type, fn) {
          if (type === 'midimessage') this._midiListeners = this._midiListeners.filter((f) => f !== fn)
        },
      })
      const access = {
        sysexEnabled: false,
        inputs: {
          get size() {
            return inputs.size
          },
          get: (id) => inputs.get(id),
          has: (id) => inputs.has(id),
          forEach: (cb) => inputs.forEach((v, k) => cb(v, k)),
        },
        _stateListeners: [],
        addEventListener(type, fn) {
          if (type === 'statechange') this._stateListeners.push(fn)
        },
        removeEventListener(type, fn) {
          if (type === 'statechange') this._stateListeners = this._stateListeners.filter((f) => f !== fn)
        },
      }
      const fireState = (port) => {
        for (const f of access._stateListeners) f({ port })
      }
      const mock = {
        access,
        connect(id, name, manufacturer) {
          if (inputs.has(id)) return
          const p = makePort(id, name, manufacturer ?? 'Mock vendor', 'connected')
          inputs.set(id, p)
          fireState(p)
        },
        disconnect(id) {
          const p = inputs.get(id)
          if (!p) return
          inputs.delete(id)
          fireState({ ...p, state: 'disconnected', connection: 'pending' })
        },
        send(id, data) {
          const p = inputs.get(id)
          if (!p) return
          const ev = { data: new Uint8Array(data), receivedTime: performance.now() }
          for (const f of p._midiListeners) f(ev)
        },
      }
      window.__midiMock = mock
      Object.defineProperty(navigator, 'requestMIDIAccess', {
        configurable: true,
        writable: true,
        value: () => Promise.resolve(mock.access),
      })
      // Two devices present before the app boots (discovery, not hot-plug).
      mock.connect('kb1', 'Mock Keyboard 61', 'MockCorp')
      mock.connect('kb2', 'Mock Pad 25', 'MockCorp')
    }
    const midiUnsupportedScript = () => {
      Object.defineProperty(navigator, 'requestMIDIAccess', {
        configurable: true,
        writable: true,
        value: () => Promise.reject(new DOMException('MIDI access denied', 'SecurityError')),
      })
    }

    // 26. Real browser without a mock: graceful behavior either way.
    const midiReal = await page.evaluate(() => ({
      support: window.__apiano.midiSupport(),
      devices: window.__apiano.midiDevices().length,
      panel: !!document.querySelector('.midi-panel'),
    }))
    check(
      'MIDI manager survives without mock',
      midiReal.support === 'available' || midiReal.support === 'unavailable',
      `support=${midiReal.support}`,
    )
    check(
      'MIDI graceful with no devices',
      midiReal.support === 'unavailable' || midiReal.devices === 0,
      `devices=${midiReal.devices}`,
    )
    check('MIDI panel renders', midiReal.panel, '')

    // 27. Full Web MIDI simulation: reload with a mock access.
    // (This puppeteer-core exposes evaluateOnNewDocument — same semantics as
    // addInitScript: runs before page scripts on every navigation.)
    await page.evaluateOnNewDocument(mockMidiScript)
    await page.reload({ waitUntil: 'networkidle0', timeout: 30000 })
    await page.waitForFunction(() => window.__apiano && window.__apiano.engine, { timeout: 20000 })
    await page.waitForFunction(() => window.__apiano.midiSupport() === 'available', { timeout: 15000 })
    await page
      .waitForFunction(
        () => window.__apiano.engine.getDiagnostics().contextState === 'running',
        { timeout: 15000 },
      )
      .catch(() => {})

    const dMidi = await page.evaluate(async () => {
      const api = window.__apiano
      await api.engine.unlock()
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const connected = () => api.midiDevices().filter((d) => d.connected).length
      const out = { devices: api.midiDevices(), selected: api.midiSelected() }
      api.midiConnect('kb3', 'Hotplug Board')
      await sleep(50)
      out.afterHotplugConnect = connected()
      api.midiDisconnect('kb3')
      await sleep(50)
      out.afterHotplugDisconnect = connected()
      api.midiDisconnect('kb1')
      await sleep(50)
      out.afterSelectedDisconnect = { selected: api.midiSelected(), connected: connected(), devices: api.midiDevices().map((d) => `${d.name}:${d.connected}`) }
      api.midiConnect('kb1', 'Mock Keyboard 61')
      await sleep(50)
      api.midiSelect('kb1')
      out.explicitSelect = api.midiSelected()
      return out
    })
    check('MIDI device discovery', dMidi.devices.length === 2, `devices=${dMidi.devices.length}`)
    check('MIDI auto-selects first device', dMidi.selected === 'kb1', `selected=${dMidi.selected}`)
    check('MIDI hot-plug connect adds device', dMidi.afterHotplugConnect === 3, `devices=${dMidi.afterHotplugConnect}`)
    check('MIDI hot-plug disconnect removes device', dMidi.afterHotplugDisconnect === 2, `devices=${dMidi.afterHotplugDisconnect}`)
    check(
      'MIDI selection falls over on disconnect',
      dMidi.afterSelectedDisconnect.selected === 'kb2' && dMidi.afterSelectedDisconnect.connected === 1,
      `selected=${dMidi.afterSelectedDisconnect.selected} connected=${dMidi.afterSelectedDisconnect.connected}`,
    )
    check('MIDI explicit device selection', dMidi.explicitSelect === 'kb1', `selected=${dMidi.explicitSelect}`)

    // 28. Note on/off through the bus into the engine; velocity-0 = note off.
    const dNote = await page.evaluate(async () => {
      const api = window.__apiano
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const drain = async () => {
        const t0 = performance.now()
        while (performance.now() - t0 < 8000) {
          if (api.stats().activeVoices === 0) return true
          await sleep(50)
        }
        return false
      }
      const out = {}
      const s0 = api.stats()
      api.midiSend('kb1', [0x90, 60, 100])
      await sleep(200)
      const during = api.stats()
      out.on = { active: during.activeVoices, started: during.totalStarted - s0.totalStarted, source: during.midiTiming?.count ?? 0 }
      api.midiSend('kb1', [0x80, 60, 0])
      out.drainedOff = await drain()
      const s1 = api.stats()
      api.midiSend('kb1', [0x90, 62, 0])
      await sleep(150)
      out.velZeroStarted = api.stats().totalStarted - s1.totalStarted
      out.velZeroActive = api.stats().activeVoices
      api.midiSend('kb1', [0x90, 62, 100])
      await sleep(150)
      api.midiSend('kb1', [0x90, 62, 0])
      out.drainedVelZero = await drain()
      return out
    })
    check(
      'MIDI note-on routes bus -> engine',
      dNote.on.active === 1 && dNote.on.started === 1,
      `active=${dNote.on.active} started=${dNote.on.started}`,
    )
    check('MIDI note-off releases voice', dNote.drainedOff, '')
    check(
      'velocity-0 note-on treated as note-off',
      dNote.velZeroStarted === 0 && dNote.velZeroActive === 0,
      `started=${dNote.velZeroStarted} active=${dNote.velZeroActive}`,
    )
    check('velocity-0 note-off still drains later notes', dNote.drainedVelZero, '')

    // 29. Velocity mapping: raw 1/32/64/96/127 -> normalized 0..1, then the
    // grand-piano layer selection for the same normalized values.
    const dVel = await page.evaluate(async () => {
      const api = window.__apiano
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const play = async (vel) => {
        api.midiSend('kb1', [0x90, 64, vel])
        const t0 = performance.now()
        let v = null
        while (performance.now() - t0 < 4000) {
          const m = api.voices().filter((x) => x.midiNote === 64 && x.state === 'attack')
          if (m.length > 0) {
            v = m[m.length - 1]
            break
          }
          await sleep(20)
        }
        api.midiSend('kb1', [0x80, 64, 0])
        const t1 = performance.now()
        while (performance.now() - t1 < 8000) {
          if (api.stats().activeVoices === 0) break
          await sleep(50)
        }
        return v ? v.velocity : -1
      }
      const mapped = {}
      for (const vel of [1, 32, 64, 96, 127]) mapped[vel] = await play(vel)
      const s0 = api.stats().totalStarted
      await api.setInstrument('grand-piano')
      await api.awaitLoad('ready', 120000)
      const out = { mapped, gpLoaded: api.stats().instrumentLoad?.status === 'ready', zones: {}, playedVel: {} }
      for (const vel of [32, 127]) {
        api.midiSend('kb1', [0x90, 60, vel])
        const t0 = performance.now()
        let v = null
        while (performance.now() - t0 < 4000) {
          const m = api.voices().filter((x) => x.midiNote === 60 && x.state === 'attack')
          if (m.length > 0) {
            v = m[m.length - 1]
            break
          }
          await sleep(20)
        }
        out.playedVel[vel] = v ? v.velocity : -1
        const z = await api.zoneFor(60, vel / 127)
        out.zones[vel] = z?.sample ?? 'none'
        api.midiSend('kb1', [0x80, 60, 0])
        const t1 = performance.now()
        while (performance.now() - t1 < 8000) {
          if (api.stats().activeVoices === 0) break
          await sleep(50)
        }
      }
      out.gpStarted = api.stats().totalStarted - s0
      return out
    })
    const velOk = (got, expected) => Math.abs(got - expected) < 0.001
    check(
      'MIDI velocity 1 maps to 1/127',
      dVel.mapped[1] >= 0 && velOk(dVel.mapped[1], 1 / 127),
      `voiceVel=${dVel.mapped[1].toFixed(4)} expected=${(1 / 127).toFixed(4)}`,
    )
    check(
      'MIDI velocity 32 maps to 32/127',
      velOk(dVel.mapped[32], 32 / 127),
      `voiceVel=${dVel.mapped[32].toFixed(4)} expected=${(32 / 127).toFixed(4)}`,
    )
    check(
      'MIDI velocity 64 maps to 64/127',
      velOk(dVel.mapped[64], 64 / 127),
      `voiceVel=${dVel.mapped[64].toFixed(4)} expected=${(64 / 127).toFixed(4)}`,
    )
    check(
      'MIDI velocity 96 maps to 96/127',
      velOk(dVel.mapped[96], 96 / 127),
      `voiceVel=${dVel.mapped[96].toFixed(4)} expected=${(96 / 127).toFixed(4)}`,
    )
    check('MIDI velocity 127 maps to 1', velOk(dVel.mapped[127], 1), `voiceVel=${dVel.mapped[127].toFixed(4)}`)
    check('MIDI grand-piano loads for layer test', dVel.gpLoaded, '')
    check(
      'MIDI soft velocity selects soft layer',
      /v1/.test(dVel.zones[32]) && velOk(dVel.playedVel[32], 32 / 127),
      `zone=${dVel.zones[32]} voiceVel=${dVel.playedVel[32].toFixed(4)}`,
    )
    check(
      'MIDI loud velocity selects loud layer',
      /v16/.test(dVel.zones[127]) && velOk(dVel.playedVel[127], 1),
      `zone=${dVel.zones[127]} voiceVel=${dVel.playedVel[127].toFixed(4)}`,
    )
    check('MIDI notes started on grand-piano', dVel.gpStarted === 2, `started=${dVel.gpStarted}`)

    // 30. Sustain CC64 through the existing sustain system.
    const dSus = await page.evaluate(async () => {
      const api = window.__apiano
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const drain = async () => {
        const t0 = performance.now()
        while (performance.now() - t0 < 10000) {
          if (api.stats().activeVoices === 0) return true
          await sleep(50)
        }
        return false
      }
      const out = {}
      api.midiSend('kb1', [0xb0, 0x40, 127])
      await sleep(80)
      out.sustainOn = api.stats().sustain
      api.midiSend('kb1', [0x90, 60, 100])
      await sleep(200)
      api.midiSend('kb1', [0x80, 60, 0])
      await sleep(200)
      out.heldAfterKeyUp = api.stats().activeVoices
      out.sustainedAfterKeyUp = api.stats().sustainedVoices
      for (let i = 0; i < 3; i++) {
        api.midiSend('kb1', [0x90, 67 + i, 90])
        await sleep(60)
        api.midiSend('kb1', [0x80, 67 + i, 0])
        await sleep(40)
      }
      await sleep(200)
      out.repeatedUnderSustain = api.stats().activeVoices
      api.midiSend('kb1', [0xb0, 0x40, 0])
      const t0 = performance.now()
      while (performance.now() - t0 < 10000) {
        if (api.stats().activeVoices === 0) break
        await sleep(50)
      }
      out.drainedAfterLift = api.stats().activeVoices
      const d0 = api.stats()
      for (let i = 0; i < 10; i++) {
        api.midiSend('kb1', [0xb0, 0x40, 127])
        await sleep(40)
        api.midiSend('kb1', [0xb0, 0x40, 0])
        await sleep(40)
      }
      await drain()
      const d1 = api.stats()
      out.rapidPedal = { active: d1.activeVoices, dropped: d1.dropped - d0.dropped, sustain: d1.sustain }
      api.midiSend('kb1', [0xb0, 0x40, 63])
      await sleep(80)
      out.under64 = api.stats().sustain
      return out
    })
    check('MIDI CC64 >= 64 turns sustain on', dSus.sustainOn, '')
    check('MIDI note holds after key-up under sustain', dSus.heldAfterKeyUp === 1, `active=${dSus.heldAfterKeyUp}`)
    check('MIDI sustain-held counted as sustained', dSus.sustainedAfterKeyUp === 1, `sustained=${dSus.sustainedAfterKeyUp}`)
    check(
      'MIDI repeated notes under sustain no stuck',
      dSus.repeatedUnderSustain === 4,
      `active=${dSus.repeatedUnderSustain}`,
    )
    check('MIDI sustain lift drains everything', dSus.drainedAfterLift === 0, `active=${dSus.drainedAfterLift}`)
    check(
      'MIDI rapid pedal cycles drain',
      dSus.rapidPedal.active === 0 && dSus.rapidPedal.dropped === 0 && !dSus.rapidPedal.sustain,
      JSON.stringify(dSus.rapidPedal),
    )
    check('MIDI CC64 < 64 turns sustain off', !dSus.under64, '')

    // 31. Pitch bend: 14-bit parsing, ±2 and ±12 ranges, smooth AudioParam
    // automation (same voice keeps playing — no rebuilds), bend under sustain.
    const dBend = await page.evaluate(async () => {
      const api = window.__apiano
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const drain = async () => {
        const t0 = performance.now()
        while (performance.now() - t0 < 8000) {
          if (api.stats().activeVoices === 0) return true
          await sleep(50)
        }
        return false
      }
      const readRate = async () => {
        const t0 = performance.now()
        while (performance.now() - t0 < 4000) {
          const m = api.voices().filter((x) => x.midiNote === 60 && x.state === 'attack')
          if (m.length > 0) return m[m.length - 1].playbackRate
          await sleep(20)
        }
        return -1
      }
      const out = {}
      api.setPitchBendRange(2)
      api.midiSend('kb1', [0xe0, 0x00, 0x40])
      await sleep(60)
      out.centerCents = api.stats().pitchBendCents
      api.midiSend('kb1', [0x90, 60, 100])
      out.rateAtCenter = await readRate()
      api.midiSend('kb1', [0xe0, 0x00, 0x00])
      await sleep(150)
      out.downCents = api.stats().pitchBendCents
      out.rateAtDown = (api.voices().filter((x) => x.midiNote === 60 && x.state === 'attack').pop() ?? {}).playbackRate ?? -1
      api.midiSend('kb1', [0xe0, 0x7f, 0x7f])
      await sleep(150)
      out.upCents = api.stats().pitchBendCents
      out.rateAtUp = (api.voices().filter((x) => x.midiNote === 60 && x.state === 'attack').pop() ?? {}).playbackRate ?? -1
      const s0 = api.stats()
      for (let i = 0; i < 30; i++) {
        const raw = i % 2 === 1 ? 16383 : 0
        api.midiSend('kb1', [0xe0, raw & 0x7f, raw >> 7])
        await sleep(10)
      }
      await sleep(150)
      const s1 = api.stats()
      out.rapid = {
        active: s1.activeVoices,
        started: s1.totalStarted - s0.totalStarted,
        dropped: s1.dropped - s0.dropped,
        rate: (api.voices().filter((x) => x.midiNote === 60 && x.state === 'attack').pop() ?? {}).playbackRate ?? -1,
      }
      api.setPitchBendRange(12)
      api.midiSend('kb1', [0xe0, 0x7f, 0x7f])
      await sleep(150)
      out.range12Cents = api.stats().pitchBendCents
      out.rateAtRange12 = (api.voices().filter((x) => x.midiNote === 60 && x.state === 'attack').pop() ?? {}).playbackRate ?? -1
      api.midiSend('kb1', [0x80, 60, 0])
      await drain()
      // bend while sustaining (reset to ±2 st, center first)
      api.setPitchBendRange(2)
      api.midiSend('kb1', [0xe0, 0x00, 0x40])
      await sleep(80)
      api.midiSend('kb1', [0xb0, 0x40, 127])
      await sleep(80)
      api.midiSend('kb1', [0x90, 60, 100])
      await sleep(200)
      api.midiSend('kb1', [0x80, 60, 0])
      await sleep(150)
      out.sustainActive = api.stats().activeVoices
      api.midiSend('kb1', [0xe0, 0x00, 0x00])
      await sleep(150)
      out.sustainBendCents = api.stats().pitchBendCents
      out.sustainBendRate = (api.voices().filter((x) => x.midiNote === 60 && x.state === 'attack').pop() ?? {}).playbackRate ?? -1
      api.midiSend('kb1', [0xb0, 0x40, 0])
      out.sustainDrained = await drain()
      api.midiSend('kb1', [0xe0, 0x00, 0x40])
      api.setPitchBendRange(2)
      return out
    })
    check('MIDI pitch bend center = 0 cents', Math.abs(dBend.centerCents) < 0.5, `cents=${dBend.centerCents}`)
    check('MIDI pitch bend max down = -range cents', Math.abs(dBend.downCents + 200) < 0.5, `cents=${dBend.downCents}`)
    check(
      'MIDI pitch bend max down changes voice rate',
      Math.abs(dBend.rateAtDown - midiCentsToFactor(-200)) < 0.01,
      `rate=${dBend.rateAtDown.toFixed(4)} expected=${midiCentsToFactor(-200).toFixed(4)}`,
    )
    check('MIDI pitch bend max up = +range cents', Math.abs(dBend.upCents - 200) < 0.5, `cents=${dBend.upCents}`)
    check(
      'MIDI pitch bend max up changes voice rate',
      Math.abs(dBend.rateAtUp - midiCentsToFactor(200)) < 0.01,
      `rate=${dBend.rateAtUp.toFixed(4)} expected=${midiCentsToFactor(200).toFixed(4)}`,
    )
    check(
      'MIDI rapid bend keeps one voice (no rebuilds)',
      dBend.rapid.active === 1 && dBend.rapid.started === 0 && dBend.rapid.dropped === 0,
      `active=${dBend.rapid.active} started=${dBend.rapid.started} dropped=${dBend.rapid.dropped}`,
    )
    check(
      'MIDI rapid bend ends at expected rate',
      Math.abs(dBend.rapid.rate - midiCentsToFactor(200)) < 0.02,
      `rate=${dBend.rapid.rate.toFixed(4)}`,
    )
    check('MIDI bend range 12 maps to ±1200 cents', Math.abs(dBend.range12Cents - 1200) < 0.5, `cents=${dBend.range12Cents}`)
    check(
      'MIDI bend ±12 semitones doubles rate',
      Math.abs(dBend.rateAtRange12 - midiCentsToFactor(1200)) < 0.02,
      `rate=${dBend.rateAtRange12.toFixed(4)} expected=${midiCentsToFactor(1200).toFixed(4)}`,
    )
    check('MIDI bend while sustaining keeps voice', dBend.sustainActive === 1, `active=${dBend.sustainActive}`)
    check(
      'MIDI bend moves sustained voice',
      Math.abs(dBend.sustainBendRate - midiCentsToFactor(-200)) < 0.02,
      `rate=${dBend.sustainBendRate.toFixed(4)}`,
    )
    check('MIDI bend under sustain drains on lift', dBend.sustainDrained, '')

    // 32. Modulation CC1 -> normalized 0..1 (reserved for future effects).
    const dMod = await page.evaluate(async () => {
      const api = window.__apiano
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const out = {}
      api.midiSend('kb1', [0xb0, 0x01, 127])
      await sleep(60)
      out.full = api.stats().modulation
      api.midiSend('kb1', [0xb0, 0x01, 0])
      await sleep(60)
      out.zero = api.stats().modulation
      api.midiSend('kb1', [0xb0, 0x01, 64])
      await sleep(60)
      out.mid = api.stats().modulation
      return out
    })
    check('MIDI CC1 127 -> modulation 1', dMod.full === 1, `mod=${dMod.full}`)
    check('MIDI CC1 0 -> modulation 0', dMod.zero === 0, `mod=${dMod.zero}`)
    check('MIDI CC1 64 -> 64/127', Math.abs(dMod.mid - 64 / 127) < 0.001, `mod=${dMod.mid.toFixed(4)}`)

    // 33. Performance: a 40-note MIDI burst must not re-render React per
    // note (activity is throttled to ~10/s) and must not drop notes.
    const dPerf = await page.evaluate(async () => {
      const api = window.__apiano
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const panel = document.querySelector('.midi-panel')
      let mutations = 0
      const obs = new MutationObserver(() => mutations++)
      obs.observe(panel, { childList: true, subtree: true, characterData: true, attributes: true })
      const s0 = api.stats()
      for (let i = 0; i < 40; i++) {
        const note = 60 + (i % 12)
        api.midiSend('kb1', [0x90, note, 90])
        await sleep(9)
        api.midiSend('kb1', [0x80, note, 0])
      }
      // Sample-backed voices start asynchronously; wait for all 40 to land.
      const w0 = performance.now()
      while (performance.now() - w0 < 8000) {
        if (api.stats().totalStarted - s0.totalStarted >= 40) break
        await sleep(50)
      }
      await sleep(300)
      obs.disconnect()
      const s1 = api.stats()
      const t0 = performance.now()
      while (performance.now() - t0 < 12000) {
        if (api.stats().activeVoices === 0) break
        await sleep(50)
      }
      const midiTiming = api.stats().midiTiming
      return {
        started: s1.totalStarted - s0.totalStarted,
        dropped: s1.dropped - s0.dropped,
        active: api.stats().activeVoices,
        mutations,
        timing: midiTiming
          ? { count: midiTiming.count, lastSchedulingMs: midiTiming.lastSchedulingMs, avg: midiTiming.avgSchedulingMs }
          : null,
      }
    })
    check('MIDI burst 40 notes no drops', dPerf.started === 40 && dPerf.dropped === 0, `started=${dPerf.started} dropped=${dPerf.dropped}`)
    check('MIDI burst drains to 0', dPerf.active === 0, `active=${dPerf.active}`)
    check('MIDI activity throttled (no per-note React churn)', dPerf.mutations <= 14, `mutations=${dPerf.mutations}`)
    check(
      'MIDI scheduling timing measured',
      (dPerf.timing?.count ?? 0) >= 40 && typeof dPerf.timing?.lastSchedulingMs === 'number',
      dPerf.timing ? `count=${dPerf.timing.count} last=${dPerf.timing.lastSchedulingMs.toFixed(2)}ms avg=${dPerf.timing.avg.toFixed(2)}ms` : 'none',
    )

    // 34. All-notes-off panic release.
    const dPanic = await page.evaluate(async () => {
      const api = window.__apiano
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const out = {}
      api.midiSend('kb1', [0x90, 60, 100])
      api.midiSend('kb1', [0x90, 61, 100])
      api.midiSend('kb1', [0x90, 62, 100])
      await sleep(200)
      out.activeBefore = api.stats().activeVoices
      api.midiSend('kb1', [0xb0, 0x7b, 0x00])
      const t0 = performance.now()
      while (performance.now() - t0 < 8000) {
        if (api.stats().activeVoices === 0) break
        await sleep(50)
      }
      out.activeAfter = api.stats().activeVoices
      return out
    })
    check('MIDI CC123 all-notes-off releases everything', dPanic.activeBefore === 3 && dPanic.activeAfter === 0, JSON.stringify(dPanic))

    // 35. Unsupported-browser fallback: reload with a rejecting access.
    await page.evaluateOnNewDocument(midiUnsupportedScript)
    await page.reload({ waitUntil: 'networkidle0', timeout: 30000 })
    await page.waitForFunction(() => window.__apiano && window.__apiano.engine, { timeout: 20000 })
    await page
      .waitForFunction(() => window.__apiano.midiSupport() === 'unavailable', { timeout: 15000 })
      .catch(() => {})
    const dFallback = await page.evaluate(async () => {
      const api = window.__apiano
      await api.engine.unlock()
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const s0 = api.stats()
      api.noteOn(60, 0.7)
      await sleep(200)
      const started = api.stats().totalStarted - s0.totalStarted
      api.noteOff(60)
      const t0 = performance.now()
      while (performance.now() - t0 < 8000) {
        if (api.stats().activeVoices === 0) break
        await sleep(50)
      }
      return {
        support: api.midiSupport(),
        panelUnavailable: document.querySelector('.midi-panel')?.textContent?.includes('unavailable') ?? false,
        started,
        active: api.stats().activeVoices,
      }
    })
    check('MIDI unsupported reports unavailable', dFallback.support === 'unavailable', `support=${dFallback.support}`)
    check('MIDI panel shows unavailable state', dFallback.panelUnavailable, '')
    check('App still plays without MIDI (QWERTY path)', dFallback.started === 1, `started=${dFallback.started}`)
    check('No stuck notes after fallback check', dFallback.active === 0, `active=${dFallback.active}`)

    // ---- Phase 6: Engine Pitch Bend & Modulation APIs & UI Clean-up -----------
    const dPad = await page.evaluate(async () => {
      const api = window.__apiano
      const padEl = document.querySelector('[data-perf-pad]')
      const hasOldUi = padEl !== null

      // Test engine pitch bend & modulation API directly
      api.engineSetPitchBend(1)
      const stateRight = api.enginePitchBendState()
      api.engineSetPitchBend(-1)
      const stateLeft = api.enginePitchBendState()
      api.engineSetPitchBend(0)

      api.engineSetModulation(1)
      const stateModUp = api.enginePitchBendState()
      api.engineSetModulation(0)
      const stateModDown = api.enginePitchBendState()

      api.engineSetPitchBendRange(12)
      const stateRange12 = api.enginePitchBendState()
      api.engineSetPitchBendRange(2)
      const stateRange2 = api.enginePitchBendState()

      return {
        hasOldUi,
        stateRight,
        stateLeft,
        stateModUp,
        stateModDown,
        stateRange12,
        stateRange2,
      }
    })
    check('Old Pitch Bend & Modulation pad UI ([data-perf-pad]) is completely removed from DOM', !dPad.hasOldUi, `hasOldUi=${dPad.hasOldUi}`)
    check('Engine pitch bend +1 = +200 cents (±2st range)', Math.abs(dPad.stateRight.cents - 200) < 0.5 && dPad.stateRight.bend === 1, `cents=${dPad.stateRight.cents}`)
    check('Engine pitch bend -1 = -200 cents (±2st range)', Math.abs(dPad.stateLeft.cents + 200) < 0.5 && dPad.stateLeft.bend === -1, `cents=${dPad.stateLeft.cents}`)
    check('Engine modulation 1 = 1.0', dPad.stateModUp.mod === 1, `mod=${dPad.stateModUp.mod}`)
    check('Engine modulation 0 = 0.0', dPad.stateModDown.mod === 0, `mod=${dPad.stateModDown.mod}`)
    check('Engine pitch bend range 12 = 12 st', dPad.stateRange12.range === 12, `range=${dPad.stateRange12.range}`)
    check('Engine pitch bend range 2 = 2 st', dPad.stateRange2.range === 2, `range=${dPad.stateRange2.range}`)

    // ---- Phase 7: Main Tone controls + audio effects ----------------------
    await runPhase7({ page, check })

    // ---- Phase 7.5: QWERTY computer keyboard input -------------------------
    await runQwerty({ page, check })

    // ---- Phase 8: Dual Tone layering ----------------------------------------
    await runDualTone(page, (name, ok, extra) => check(name, ok, extra))

    // ---- Phase 9: Master EQ, Split Keyboard & Presets -------------------------
    await runPhase9(page, (name, ok, extra) => check(name, ok, extra))

    // ---- Phase 10: Additional Instrument Bank --------------------------------
    await runPhase10(page, (name, ok, extra) => check(name, ok, extra))

    // ---- Phase 11: Recording & Performance Capture ---------------------------
    await runPhase11(page, (name, ok, extra) => check(name, ok, extra))

    // ---- Phase 12: Workstation Tools (Metronome & Chord Assist) ---------------
    await runPhase12(page, (name, ok, extra) => check(name, ok, extra))

    // ---- Phase 13: Production Hardening & PWA Deployment ----------------------
    await runPhase13(page, (name, ok, extra) => check(name, ok, extra))

    // ---- Phase 14: Instrument-Library & Keyboard-Playability Expansion --------
    await runPhase14(page, (name, ok, extra) => check(name, ok, extra))

    // ---- Phase 15: Theme System, Arp, Portamento, Visual Release Fix ----------
    await runPhase15Features(page, (name, ok, extra) => check(name, ok, extra))

    // ---- Phase 16: Audio Foundation Envelope Controls -------------------------
    await runPhase16AudioFoundation(page, (name, ok, extra) => check(name, ok, extra))

    // ---- Reset Controls UX Verification --------------------------------------
    await runResetControlsSmoke(page, (name, ok, extra) => check(name, ok, extra))

    // ---- Mouse Performance Pitch + Modulation ---------------------------------
    await runMousePerformanceSmoke(page, (name, ok, extra) => check(name, ok, extra))

    // 10. console clean
    check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))

    try {
      const outDir = mkdtempSync(path.join(tmpdir(), 'apiano-'))
      const shot = path.join(outDir, 'apiano.png')
      await page.screenshot({ path: shot })
      console.log(`Screenshot: ${shot}`)
    } catch {
      // screenshot optional
    }

    try {
      await browser.close()
    } catch {
      // browser close optional
    }
  } catch (err) {
    failures++
    console.error('SMOKE TEST ERROR:', err)
  } finally {
    try {
      server.kill()
    } catch {
      // server kill optional
    }
  }

  console.log(
    `\nRESULT ${failures === 0 ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length} checks)`,
  )
  writeFileSync(
    path.join(root, 'smoke-results.json'),
    JSON.stringify({ results, failures, serverLog: serverLog.slice(-2000) }, null, 2),
  )
  process.exit(failures === 0 ? 0 : 1)
}

main()
