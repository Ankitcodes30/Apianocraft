# AGENT.md — Apianocraft Development Context (authoritative)

**Read this file first. Then read `PROJECT_STATUS.md` and `AGENT_PLAN.yaml`.**
**Then inspect the repository yourself — where this file and the repository differ, THE REPOSITORY IS AUTHORITATIVE.**

---

## 1. Project purpose

Apianocraft is a low-latency browser piano/digital keyboard workstation for laptops and PCs.

Primary goals (all client-side, Web Audio API):

- Play piano through computer keyboard (QWERTY), mouse, touch and MIDI.
- High-quality multisampled, velocity-sensitive instruments.
- Low-latency Web Audio playback with one persistent `AudioContext`.
- Sustain, octave, transpose, fine tuning, pitch bend, modulation.
- Main-tone and Dual-tone effects (volume, pan, cutoff, reverb, chorus, delay).
- Dual tone layering, split keyboard, multiple instruments, presets, recording/MIDI export, PWA/offline, production deployment.

**Priorities:** playability, audio timing, performance, memory safety and architectural cleanliness over unnecessary UI complexity.

## 2. Stack (verified in `package.json`)

- React 19 + TypeScript 5.8 + Vite 6 (`vite-plugin-pwa` for PWA).
- Web Audio API: one persistent `AudioContext`, custom lookahead peak-limiter AudioWorklet.
- Node >= 20 required. `puppeteer-core` drives real headless Edge/Chrome for smoke tests.
- Entirely client-side; no backend.

Commands:

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm run build       # tsc --noEmit && vite build -> dist/
npm run preview     # serve dist/ locally
npm run smoke       # node scripts/audio-smoke.mjs — full suite (build FIRST, needs Chrome/Edge)
```

## 3. Implementation status (see `PROJECT_STATUS.md` for the dashboard)

Status labels: **COMPLETED** (checked in / verified with typecheck+lint+build+smoke), **IN PROGRESS** (implemented, possibly unverified or uncommitted), **NEXT** (planned next phase), **FUTURE** (roadmap only).

### COMPLETED

- **Phase 4A — Audio engine:** one persistent `AudioContext` (`latencyHint: 'interactive'`), voice pooling, adaptive polyphony, voice stealing, sustain, retriggering, velocity layers, octave, transpose, tuning, performance diagnostics.
- **Phase 5 — MIDI input:** `MidiManager` → normalized `NoteEventBus` (MIDI never touches the engine directly).
- **Phase 6 — Performance XY pad:** pitch bend + modulation, pointer and keyboard access, render throttling.
- **Phase 7 — Main Tone controls + effects:** volume, pan, cutoff, reverb (cached procedural IRs), chorus, delay, bypass-gated sends, limiter worklet + fallbacks.
- **Phase 7.5 — QWERTY computer keyboard:** `QwertyManager` adapter on the same bus.
- **Phase 8 — Dual Tone Layering:** Dual layer enable/disable, instrument selection, tuning, octave shift, transpose, and dedicated tone chain effects (reverb, chorus, delay). Fully verified with 291/291 smoke checks across 3 consecutive runs.

Verified checkpoints (typecheck ✓ lint ✓ build ✓ smoke ✓, clean tree at each):

| Phase | Commit | Smoke |
|---|---|---|
| 4A | (earlier commits) | 99/99 × 3 |
| 5 | (earlier commits) | 152/152 × 3 |
| 6 | (earlier commits) | 177/177 × 3 |
| 7 | `7d8535f` "chore: checkpoint verified phase 7 audio engine" | 230/230 |
| 7.5 | **uncommitted** | 272/272 |
| 8 | **uncommitted** | **291/291** (verified 3 consecutive runs in this session) |

### IN PROGRESS

- Phase 8 is *implemented and verified* (291/291 checks) but **not committed** — awaiting user approval to commit.

### NEXT

- **Phase 9 — Audio Effects Polish & Mastering / Split Keyboard.**

### FUTURE (provisional roadmap)

- **Phase 9 — Split keyboard.**
- **Phase 10 — Additional instruments** (Strings, Flute, Harmonium, Trumpet, Brass, Piccolo, Banjo, Saxophone, Violin; Grand Piano already in). Only mark an instrument complete after real licensed/high-quality sample assets are integrated and tested.
- **Phase 11 — Recording / MIDI export / performance recording.**
- **Phase 12 — Presets / chord tools / metronome / scale tools / advanced performance features.**
- **Phase 13 — Production hardening / PWA / offline behavior / deployment.**

Roadmap is provisional; update it when architecture or product requirements change.

## 4. Core architecture

```
Input (QWERTY, mouse/touch, MIDI, performance pad)
  -> NoteEventBus (normalized events; input adapters NEVER touch the engine)
  -> engine adapter (App.tsx: bus -> AudioEngine methods)
  -> AudioEngine.noteOn/noteOff   (React is NOT in this path)
  -> VoiceManager (bounded pool, adaptive cap, voice stealing, retrigger)
  -> Voice (per-note AudioBufferSource + gain envelope, audio-clock automation)
  -> mainTone.input / dualTone.input -> ToneChain -> masterGain -> meter (analyser)
  -> peak-limiter AudioWorklet -> destination
```

Key files:

- `src/audio/AudioEngine.ts` — engine singleton (`getEngine()`), all scheduling, dual tone layer management, diagnostics.
- `src/audio/VoiceManager.ts` — voice pool, stealing, custom `out` routing, sustain held bookkeeping, `stats`.
- `src/audio/Voice.ts` — one voice: source + gain envelope; states `idle|attack|release`.
- `src/midi/NoteEventBus.ts` — normalized bus (`getNoteEventBus()`), events: note-on/off, sustain, pitch-bend, modulation, panic.
- `src/midi/MidiManager.ts` — Web MIDI adapter (emits bus events only).
- `src/keyboard/QwertyManager.ts` — QWERTY adapter (emits bus events only).
- `src/audio/effects/MainToneChain.ts` — shared `ToneChain` class with static IR buffer caching.
- `src/audio/effects/Limiter.ts` — worklet limiter + fallbacks.
- `src/audio/instruments/Instrument.ts`, `InstrumentBank.ts`, `SynthInstrument.ts` — instrument abstraction.
- `src/audio/samples/SampleInstrument.ts`, `decodeCache.ts`, `idbCache.ts` — multisampled instruments + caching.
- `src/App.tsx` — wires engine, bus, managers, UI; subscribes the bus to the engine.
- `src/testHarness.ts` — `window.__apiano` API used by smoke tests; must never change semantics of the app.
- `src/components/*` — UI panels (PianoKeyboard, MainTonePanel, DualTonePanel, PerformancePad, MidiPanel, KeyboardPanel, EngineStatus, SampleStatus, ErrorBanner, ErrorBoundary).

## 5. Audio architecture

ToneChain (reusable effect chain, no per-note effect nodes):

```
volume -> pan -> low-pass cutoff -> chorus -> dry/reverb/delay sum -> output
```

- Reverb and delay are **bypass-gated sends** (unwired when at 0).
- Reverb IRs are **procedurally synthesized once and cached statically across all chain instances** (`ToneChain.irCache`); preset switches swap a cached buffer.
- All parameter changes use `AudioParam` automation (`setTargetAtTime` etc.) on the audio clock; **no effect node rebuilds**.
- Limiter: custom lookahead peak-limiter AudioWorklet; falls back to DynamicsCompressor, then a plain gain node. The worklet reports per-window `samples`/`peak` — headless-browser analyser timing can be unreliable, so use `limiter.level()`/`limiter.clock()` (render-thread ground truth) for metering in tests.
- Meters: pre-limiter analyser (`engine.analyser`, fftSize 512) and post-limiter analyser (`engine.outputAnalyser`, fftSize 2048).
- Envelope config: attack 0.004 s, decay 0.25 s, sustainLevel 0.8, release 0.3 (user-adjustable 25 ms release `0.03` for cut-off tails, `retrigger` uses `release*0.25`).
- All voice starts are scheduled at `ctx.currentTime + 0.004` (`SCHEDULING_LEAD_MS = 4`).

## 6. Input architecture (mandatory)

- Every input source emits normalized `NoteEventBus` events. Input adapters **never** call `AudioEngine` directly.
- The **only** place bus events reach the engine is the adapter in `App.tsx` (`bus.subscribe(...)`).
- MIDI must not directly manipulate the engine. QWERTY must not directly manipulate the engine. **Any future input source must follow the same rule.**
- QWERTY specifics (`src/keyboard/QwertyManager.ts`):
  - Layout `A W S E D F T G Y H U J` = C4..B4; `Z` octave down, `X` octave up (QWERTY-local octave, -4..+4); fixed velocity 0.7 (no true keyboard velocity), configurable via `setVelocity`.
  - Safety: key-repeat and duplicate keydowns ignored; keys typed into input/textarea/select/contenteditable never play; Ctrl/Cmd/Alt combos ignored; window blur and tab-hide release **only QWERTY-held notes** (other adapters' notes untouched).
- The engine applies transpose + octave + tuning centrally, so every source is automatically tuned.

## 7. Instrument & caching architecture

- Instrument abstraction: interchangeable providers returning a buffer + playback parameters. The engine never branches on instrument type.
- Instruments: **Demo Piano** (procedural synth, no assets), **Grand Piano** (Salamander Grand Piano V3 subset by Alexander Holm, CC BY 3.0: 30 zones × 2 velocity layers, 60 FLAC files, ~83 MB, `public/samples/grand-piano/`; manifest carries licensing), and preset synth models.
- Loading: lazy and progressive (first note waits only for its own file; rest streams in background).
- Caching (three tiers, through the `Instrument`/`SampleBank` abstraction — never bypass):
  1. Decoded LRU — `DecodeCache`, ~128 MB budget (`DEFAULT_MAX_DECODED_BYTES`).
  2. Raw bytes in IndexedDB (`idbCache`, DB `apiano-samples`).
  3. Network.
- Decoded buffers are immutable and shared across voices and across tone chains. **Same-instrument layering (Main + Dual both using Grand Piano) decodes sample buffers once and shares them without memory duplication.**

## 8. Performance rules (mandatory)

1. One persistent `AudioContext`; never create a second one (except on dispose→recreate).
2. Engine must remain independent of React; React must NOT run on the note hot path.
3. No unnecessary per-note audio nodes (one source + one gain per voice only).
4. No effect-chain rebuilds when parameters change — use `AudioParam` automation.
5. Use `AudioContext.currentTime` for scheduling; never JS timers for audio timing.
6. **No arbitrary sleeps to solve audio timing problems** — wait on engine state (`isBusy()`, `pendingLoads`, voice counts) instead.
7. Preserve pending-load/pending-off correctness. Dropped/pending notes must never become stuck or accidentally sustained.
8. Voice pooling stays bounded (`baseCap = min(64, max(8, hardwareConcurrency*16))`); adaptive cap halves under drops/steals, doubles back when healthy.
9. Sample buffers shared via the decode cache; never decode the same file twice.
10. UI communicates through normalized events/state abstractions (`EngineEvent`, `NoteEventBus`, engine getters/diagnostics), never by driving the engine directly from components.

## 9. Testing rules (mandatory)

- `npm run smoke` runs the full suite headlessly against the **production build** (run `npm run build` first). Results written to `smoke-results.json` + a screenshot.
- **Never weaken existing assertions.**
- Add a regression test for every real bug before/with the fix.
- Prefer deterministic render-thread measurements (limiter `level()`/`clock()`, engine diagnostics, voice tables, bus event rings) over fragile transient analyser timing in headless browsers.
- Historical checkpoints: 99/99 (4A) ×3, 152/152 (5) ×3, 177/177 (6) ×3, 230/230 (7), 272/272 (7.5 — QWERTY), 291/291 (8 — Dual Tone).
- Smoke counts (291 current): base engine + MIDI + XY pad + Main Tone + QWERTY + Dual Tone checks.
- Scripts: `scripts/audio-smoke.mjs` (orchestrator, port 5199), `scripts/smoke-phase7.mjs`, `scripts/smoke-qwerty.mjs`, `scripts/smoke-dual-tone.mjs`.
- Before declaring a phase complete: typecheck, lint, build, full smoke, **then 3 consecutive green smoke runs** (re-run if any flake occurs).

## 10. Coding rules

- No comments unless they add real context.
- Follow existing patterns: engine-agnostic input adapters, AudioParam automation, singleton modules (`getX()`), normalized events, bounded sets/maps for bookkeeping.
- Keep test harness (`src/testHarness.ts`) additive-only; never change app behavior to satisfy tests.
- TypeScript strict (tsc `--noEmit`); ESLint with react-hooks + react-refresh configs.

## 11. Git rules

- Current `HEAD`: `7d8535f` (`chore: checkpoint verified phase 7 audio engine`). Branch `main`.
- Working tree has **uncommitted Phase 7.5 and Phase 8 work**; do not commit unless explicitly instructed by the user.
- Before commits: `git status`, `git diff`, `git diff --cached`.
- After commits: `git status`.
- One phase = one clean checkpoint commit with a message like `chore: checkpoint verified phase N ...`.

## 12. Before coding anything

1. Read `AGENT.md`, `PROJECT_STATUS.md`, `AGENT_PLAN.yaml`, `DEVELOPMENT_WORKFLOW.md`.
2. `git status` and `git log --oneline -5` — know the uncommitted work and the latest checkpoint.
3. Read the relevant source files and smoke scripts before touching anything.
4. Understand the architecture invariants before changing anything.
5. Follow `DEVELOPMENT_WORKFLOW.md` step by step.