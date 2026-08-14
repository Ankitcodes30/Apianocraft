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

- **Phase 14 — Instrument Library Expansion & 38-Key QWERTY Redesign:** 38-key continuous chromatic layout (C3..C#6), Sargam mode (C#=Sa), 10 expressive instrument classes. Verified 360/360 smoke checks.
- **Frontend Redesign Plan:** Detailed in `FRONTEND_REDESIGN_PLAN.md` (Implementation-ready blueprint for digital piano workstation UI redesign).

Roadmap is provisional; update it when architecture or product requirements change.

## 4. Complete Project Architecture

Apianocraft is designed as a decoupled, zero-React-hot-path, client-side digital piano workstation. The architecture separates input event routing, real-time audio synthesis, signal processing, parameter scheduling, state presentation, and multi-tiered caching.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       INPUT LAYER (Adapters)                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌───────────────────────┐  │
│  │   MIDI Manager  │    │ QWERTY Manager  │    │ Mouse/Touch UI  │    │  Arpeggiator Engine   │  │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘    └───────────┬───────────┘  │
└───────────┼──────────────────────┼──────────────────────┼─────────────────────────┼──────────────┘
            │                      │                      │                         │
            ▼                      ▼                      ▼                         ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   NORMALIZED INPUT EVENT BUS                                     │
│                                    (src/midi/NoteEventBus.ts)                                    │
│       Events: note-on, note-off, sustain, pitch-bend, modulation, panic                          │
└────────────────────────────────────────────────────────┬─────────────────────────────────────────┘
                                                         │
                                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     AUDIO ENGINE (Facade)                                        │
│                                    (src/audio/AudioEngine.ts)                                    │
│   • Central tuning: Transpose (-12..+12), Octave (-5..+5), Fine Tuning (-100..+100 cents)        │
│   • Performance: Portamento / Pitch Glide, Pitch Bend Cents, Retriggering                        │
│   • Layering: Main Tone Layer, Dual Tone Layer, Split Keyboard Zone                              │
│   • Input state tracking: inputActiveNotes (zero visual latency for DOM Piano Keyboard)          │
└─────┬───────────────────────────────┬───────────────────────────────┬────────────────────────────┘
      │                               │                               │
      ▼                               ▼                               ▼
┌───────────┐                   ┌───────────┐                   ┌───────────┐
│ Main Zone │                   │ Dual Zone │                   │ Split Zone│
└─────┬─────┘                   └─────┬─────┘                   └─────┬─────┘
      │                               │                               │
      ▼                               ▼                               ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 VOICE MANAGER & POOLING TIER                                     │
│                                   (src/audio/VoiceManager.ts)                                    │
│   • Dynamic polyphony cap (baseCap = min(64, max(8, hardwareConcurrency * 16)))                  │
│   • Intelligent voice stealing (release-phase -> sustain-held -> oldest active)                 │
│   • Retriggering with short release tails                                                        │
└────────────────────────────────────────────────────────┬─────────────────────────────────────────┘
                                                         │
                                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    VOICE SYNTHESIS & AUTOMATION                                  │
│                                        (src/audio/Voice.ts)                                      │
│   • One AudioBufferSourceNode + GainNode per voice                                               │
│   • Audio-clock automation (gain attack/decay/sustain/release & playbackRate pitch glide)       │
└────────────────────────────────────────────────────────┬─────────────────────────────────────────┘
                                                         │
                                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 DSP TONE CHAINS & MASTER BUS                                     │
│   ┌──────────────────────────────────────────────────────────────────────────────────────────┐   │
│   │ ToneChain (src/audio/effects/MainToneChain.ts):                                          │   │
│   │ Volume -> Pan -> Cutoff Biquad -> Chorus -> Dry/Reverb/Delay Send Sum                    │   │
│   │ • Procedural Reverb IR Cache (Room, Hall, Stage, Cathedral)                              │   │
│   └─────────────────────────────────────────────┬────────────────────────────────────────────┘   │
│                                                 │                                                │
│   ┌─────────────────────────────────────────────▼────────────────────────────────────────────┐   │
│   │ Master Bus EQ (Low Shelf, Peaking Mid, High Shelf) & Master Gain                         │   │
│   └─────────────────────────────────────────────┬────────────────────────────────────────────┘   │
│                                                 │                                                │
│   ┌─────────────────────────────────────────────▼────────────────────────────────────────────┐   │
│   │ Peak-Limiter AudioWorklet (src/audio/worklets/limiter.worklet.ts)                        │   │
│   │ • Lookahead peak limiting; prevents clipping digital distortion                          │   │
│   └─────────────────────────────────────────────┬────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┼────────────────────────────────────────────────┘
                                                  │
                                                  ▼
                                       [ Audio Destination ]
```

### Architectural Principles & Data Flow

1. **Input Decoupling & Normalization**:
   - All physical input controllers (MIDI keyboards via `MidiManager`, QWERTY computer keys via `QwertyManager`, mouse/touch glissando via `PianoKeyboard`, and programmatic triggers via `Arpeggiator`) convert raw signals into normalized `NoteBusEvent` objects.
   - Input adapters **never** invoke `AudioEngine` methods directly. Subscriptions in `App.tsx` and `Arpeggiator.ts` listen to `NoteEventBus` and forward normalized requests to the engine.

2. **Audio Hot Path & Zero-Render Architecture**:
   - The React component tree (`App.tsx`, `WorkstationInspector.tsx`, `MainTonePanel.tsx`, etc.) is strictly separated from the audio synthesis path.
   - Parameter adjustments (volume, pan, filter cutoff, reverb send, chorus, delay) execute audio-clock ramps directly on `AudioParam` interfaces. No React state updates or component re-renders occur during performance or continuous slider manipulation.
   - Active visual key highlighting on `PianoKeyboard.tsx` bypasses React state entirely by manipulating DOM element classes (`.ap-key--active`) directly when `input-notes` events fire on `AudioEngine`.

3. **Multi-Tiered Asset & Decode Caching**:
   - **Tier 1 (Decoded LRU Cache)**: `DecodeCache` holds decoded `AudioBuffer` objects in memory up to 128 MB (`DEFAULT_MAX_DECODED_BYTES`). Decoded buffers are immutable and shared across sounding voices and multi-tone layers (e.g. Main + Dual both using Grand Piano).
   - **Tier 2 (Raw Byte Cache)**: IndexedDB database (`apiano-samples`) stores raw compressed audio binary payloads locally to allow offline instantiation.
   - **Tier 3 (Network Streaming)**: Lazy and progressive loading via `SampleInstrument.ts`. The initial note download fetches only its specific velocity zone; remaining zones stream asynchronously in background queues with concurrency bounds (`CONCURRENCY = 3`).

4. **Appearance & Customization Architecture**:
   - `ThemeManager.ts` manages `'light' | 'dark' | 'system'` modes and persists preference in `localStorage`.
   - Listens to `window.matchMedia('(prefers-color-scheme: dark)')` to adapt dynamically to OS theme changes without page reloads.

---

## 5. Complete File Structure

Below is the directory tree of the entire project with exact responsibilities for every file and module:

```
Apianocraft/
├── .agents/                        # Workspace customization root & rules
│   └── AGENTS.md                   # Workspace agent guidelines
├── public/                         # Static production assets
│   ├── favicon.svg                 # Application favicon
│   ├── manifest.webmanifest        # PWA web application manifest
│   ├── icons/                      # PWA application icons (192x192, 512x512)
│   └── samples/                    # Multisampled instrument assets
│       └── grand-piano/            # Salamander Grand Piano V3 sample set
│           ├── manifest.json       # Velocity-layer mapping & zone definitions
│           ├── ATTRIBUTION.txt     # Sample asset license (CC BY 3.0)
│           └── *.flac              # Compressed sample audio files
├── scripts/                        # Automated smoke test suite & dev tools
│   ├── audio-smoke.mjs             # Master Puppeteer smoke test orchestrator
│   ├── smoke-phase7.mjs            # Audio engine & Main Tone smoke suite
│   ├── smoke-qwerty.mjs            # QWERTY keyboard smoke suite
│   ├── smoke-dual-tone.mjs         # Dual Tone layer smoke suite
│   ├── smoke-phase9.mjs            # Master EQ, Split Keyboard & Presets smoke suite
│   ├── smoke-phase10.mjs           # Instrument Bank smoke suite
│   ├── smoke-phase11.mjs           # Performance Recorder & MIDI Export smoke suite
│   ├── smoke-phase12.mjs           # Metronome & Chord Detector smoke suite
│   ├── smoke-phase13.mjs           # PWA & Offline deployment smoke suite
│   ├── smoke-instruments-keyboard.mjs # Phase 14 Instrument & 38-Key smoke suite
│   ├── smoke-phase15-features.mjs  # Theme, Arp, Portamento & Latency smoke suite
│   ├── debug-voice.mjs             # Diagnostic helper for voice debugging
│   ├── fetch-grand-piano.mjs       # Downloader script for piano sample assets
│   └── gen-icons.ps1               # PowerShell PWA icon generator
├── src/                            # Application source code
│   ├── main.tsx                    # React application entry point & root mount
│   ├── App.tsx                     # Top-level workstation viewport layout & bus wiring
│   ├── vite-env.d.ts               # Vite TypeScript type declarations
│   ├── testHarness.ts              # E2E test interface (window.__apiano)
│   ├── audio/                      # Audio Engine & DSP core
│   │   ├── AudioEngine.ts          # Facade singleton: scheduling, layers, tuning, diagnostics
│   │   ├── VoiceManager.ts         # Bounded voice pool, adaptive cap, voice stealing
│   │   ├── Voice.ts                # One sounding voice: source, gain envelope, pitch glide
│   │   ├── errors.ts               # Custom AudioEngineError class & error codes
│   │   ├── types.ts                # Audio engine interfaces, snapshots, & event definitions
│   │   ├── effects/                # Audio DSP effect chains
│   │   │   ├── MainToneChain.ts    # ToneChain: volume, pan, cutoff, chorus, reverb, delay
│   │   │   └── Limiter.ts          # Worklet limiter wrapper & compressor fallback
│   │   ├── instruments/            # Instrument abstractions & synth models
│   │   │   ├── Instrument.ts       # Core Instrument interface & tuning helpers
│   │   │   ├── InstrumentBank.ts   # Registry bank for synths & sample instruments
│   │   │   ├── SynthInstrument.ts  # Demo Piano synth implementation
│   │   │   ├── SynthEPianoInstrument.ts # FM Electric Piano synth model
│   │   │   ├── SynthPadInstrument.ts    # Ambient Pad synth model
│   │   │   ├── SynthOrganInstrument.ts  # Drawbar Organ synth model
│   │   │   ├── SynthStringsInstrument.ts# String Ensemble synth model
│   │   │   ├── SynthBrassInstrument.ts  # Synth Brass model
│   │   │   ├── SynthBassInstrument.ts   # Synth Bass model
│   │   │   ├── TrumpetInstrument.ts     # Trumpet synth model
│   │   │   ├── BrassSectionInstrument.ts# Brass Section model
│   │   │   ├── SaxophoneInstrument.ts   # Saxophone synth model
│   │   │   ├── OboeInstrument.ts        # Oboe synth model
│   │   │   ├── TuttiInstrument.ts       # Orchestral Tutti model
│   │   │   ├── PluckInstrument.ts       # Plucked synth model
│   │   │   ├── DulcimerInstrument.ts    # Dulcimer synth model
│   │   │   ├── BrightGrandInstrument.ts # Bright Grand Piano model
│   │   │   ├── WarmGrandInstrument.ts   # Warm Grand Piano model
│   │   │   └── FmEPianoInstrument.ts    # Vintage FM E-Piano model
│   │   ├── samples/                # Sample loading & caching infrastructure
│   │   │   ├── SampleInstrument.ts # Multisampled manifest-driven instrument provider
│   │   │   ├── decodeCache.ts      # In-memory LRU AudioBuffer decode cache
│   │   │   ├── idbCache.ts         # IndexedDB raw audio byte storage (apiano-samples)
│   │   │   └── types.ts            # Manifest & sample zone type definitions
│   │   ├── recorder/               # Recording, Transport & Export
│   │   │   ├── PerformanceRecorder.ts # Event recorder for MIDI performance capture
│   │   │   ├── MidiEncoder.ts      # Standard MIDI File (.mid) binary encoder
│   │   │   └── WavEncoder.ts       # AudioBuffer WAV (.wav) audio recorder tap
│   │   ├── tools/                  # Workstation music tools
│   │   │   ├── Metronome.ts        # Audio-clock precision metronome scheduler
│   │   │   └── ChordDetector.ts    # Real-time chord & harmony analyzer
│   │   └── worklets/               # Web Audio Worklets
│   │       └── limiter.worklet.ts  # Lookahead peak limiter AudioWorkletProcessor
│   ├── components/                 # React UI components
│   │   ├── PianoKeyboard.tsx       # 38-key continuous chromatic virtual piano surface
│   │   ├── WorkstationInspector.tsx# Tabbed studio drawer (Tone, FX, Tools, System)
│   │   ├── MainTonePanel.tsx       # Primary sound source & master FX bus controls
│   │   ├── DualTonePanel.tsx       # Secondary sound layer B controls & balance slider
│   │   ├── SplitPanel.tsx          # Keyboard split point & lower zone configuration
│   │   ├── ArpeggiatorPanel.tsx    # Real-time Arpeggiator rate, direction, octave & gate
│   │   ├── PortamentoPanel.tsx     # Portamento glide speed & toggle controls
│   │   ├── MasterPanel.tsx         # 3-band Master EQ (Low, Mid, High) & master volume
│   │   ├── RecorderPanel.tsx       # Record, play, clear, WAV export, MIDI export
│   │   ├── PresetPanel.tsx         # Factory & user workstation preset manager
│   │   ├── WorkstationToolsPanel.tsx # Metronome & Real-Time Chord Detector
│   │   ├── MidiPanel.tsx           # Physical MIDI device discovery & port connection
│   │   ├── KeyboardPanel.tsx       # QWERTY 38-key layout map & reference guide
│   │   ├── ThemeSelector.tsx       # Light / Dark / System Default theme dropdown
│   │   ├── EngineStatus.tsx        # Voice count, latency & engine status badge
│   │   ├── SampleStatus.tsx        # Sample loading & cache download progress badge
│   │   ├── ErrorBanner.tsx         # Floating alert banner for engine errors
│   │   ├── ErrorBoundary.tsx       # React error boundary wrapper for UI resilience
│   │   └── OfflineBanner.tsx       # PWA offline connection status badge
│   ├── keyboard/                   # Computer QWERTY input mapping
│   │   └── QwertyManager.ts        # Continuous 38-key chromatic QWERTY input adapter
│   ├── midi/                       # Web MIDI API integration
│   │   ├── MidiManager.ts          # Web MIDI input device scanner & CC controller
│   │   └── NoteEventBus.ts         # Normalized input event bus singleton
│   ├── performance/                # Real-time performance controllers
│   │   ├── Arpeggiator.ts          # Pattern arpeggiator (Up, Down, Up/Down, Random)
│   │   ├── PerformanceControls.ts  # Performance controller engine bridge
│   │   └── MousePerformanceAdapter.ts # Delta-relative mouse pitch + mod controller adapter
│   ├── theme/                      # Theme management & persistence
│   │   └── ThemeManager.ts         # Light/Dark/System preference & listener singleton
│   ├── hooks/                      # Custom React hooks
│   │   └── useThrottledState.ts    # Performance throttling hook for UI updates
│   ├── styles/                     # Global CSS styling
│   │   └── index.css               # Design system tokens, light/dark themes, layout grid
│   └── utils/                      # Helper utilities
│       └── ErrorBus.ts             # Application-wide error message dispatcher
├── index.html                      # HTML5 template, title, meta SEO, SW registration
├── package.json                    # Project dependencies, scripts, metadata
├── tsconfig.json                   # TypeScript compiler configuration
├── tsconfig.app.json               # Application TypeScript compiler config
├── tsconfig.node.json              # Node build scripts TypeScript config
├── vite.config.ts                  # Vite bundler, PWA plugin, & Worklet configuration
├── README.md                       # Product introduction, features, & documentation
├── AGENT.md                        # Authoritative development context & architecture
├── PROJECT_STATUS.md               # Implementation dashboard & progress snapshot
├── AGENT_PLAN.yaml                 # Structured agent roadmap & verification criteria
├── RELEASE_READINESS_REPORT.md     # Production release verification report
└── FINAL_RELEASE_CHECKLIST.md      # Final manual QA & deployment checklist
```

---

## 6. Audio architecture

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

## 7. Input architecture (mandatory)

- Every input source emits normalized `NoteEventBus` events. Input adapters **never** call `AudioEngine` directly.
- The **only** place bus events reach the engine is the adapter in `App.tsx` (`bus.subscribe(...)`).
- MIDI must not directly manipulate the engine. QWERTY must not directly manipulate the engine. **Any future input source must follow the same rule.**
- QWERTY specifics (`src/keyboard/QwertyManager.ts`):
  - Primary 38-key continuous chromatic layout (C3..C#6 = MIDI 48..85 across 3 rows: Lower `Z..m`, Middle `A..'`, Upper `1..]`).
  - Playable directly without Shift, CapsLock, or modifier keys.
  - Sargam mode supported (C# = Sa).
  - Safety: key-repeat and duplicate keydowns ignored; keys typed into input/textarea/select/contenteditable never play; Ctrl/Cmd/Alt combos ignored; window blur and tab-hide release **only QWERTY-held notes** (other adapters' notes untouched).
- The engine applies transpose + octave + tuning centrally, so every source is automatically tuned.

## 8. Instrument & caching architecture

- Instrument abstraction: interchangeable providers returning a buffer + playback parameters. The engine never branches on instrument type.
- Instruments: **Demo Piano** (procedural synth, no assets), **Grand Piano** (Salamander Grand Piano V3 subset by Alexander Holm, CC BY 3.0: 30 zones × 2 velocity layers, 60 FLAC files, ~83 MB, `public/samples/grand-piano/`; manifest carries licensing), and 16+ preset synth & sampled models (Electric Piano, Strings, Organ, Brass, Flute, Pluck, Dulcimer, etc.).
- Loading: lazy and progressive (first note waits only for its own file; rest streams in background).
- Caching (three tiers, through the `Instrument`/`SampleBank` abstraction — never bypass):
  1. Decoded LRU — `DecodeCache`, ~128 MB budget (`DEFAULT_MAX_DECODED_BYTES`).
  2. Raw bytes in IndexedDB (`idbCache`, DB `apiano-samples`).
  3. Network.
- Decoded buffers are immutable and shared across voices and across tone chains. **Same-instrument layering (Main + Dual both using Grand Piano) decodes sample buffers once and shares them without memory duplication.**

## 9. Performance rules (mandatory)

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

## 10. Testing rules (mandatory)

- `npm run smoke` runs the full suite headlessly against the **production build** (run `npm run build` first). Results written to `smoke-results.json` + a screenshot.
- **Never weaken existing assertions.**
- Add a regression test for every real bug before/with the fix.
- Prefer deterministic render-thread measurements (limiter `level()`/`clock()`, engine diagnostics, voice tables, bus event rings) over fragile transient analyser timing in headless browsers.
- Historical checkpoints: 99/99 (4A) ×3, 152/152 (5) ×3, 177/177 (6) ×3, 230/230 (7), 272/272 (7.5 — QWERTY), 291/291 (8 — Dual Tone), 356/356 (13 — Production PWA), 360/360 (14 — 38-Key QWERTY), 368/368 (15 — Workstation Features), 368/368 (16 — Redesign), 369/369 (17 — Main Tone Wiring), 370/370 (18 — Split Lower Zone Fix), 371/371 (19 — Brand Logo & Theme UI), 372/372 (20 — Scale Guide Removal), 381/381 (21 — Mouse Performance), **364/364 (22 — Pitch Bend & Modulation UI Removal)**.
- Smoke counts (**364 current**): base engine + MIDI + Main Tone + QWERTY + Dual Tone + Master EQ/Split/Presets + Bank + Recorder/Transport + Metronome/Chord + PWA/Offline + 38-Key QWERTY + Theme/Arp/Portamento/Latency + Main Tone Dropdown + Lower Zone Instrument Dropdown + Brand Logo Mark + Unquantized Note Integrity + Mouse Performance Suite + Obsolete Pitch/Mod Pad Removal Assertion.
- Scripts: `scripts/audio-smoke.mjs` (orchestrator, port 5199), `scripts/smoke-phase7.mjs`, `scripts/smoke-qwerty.mjs`, `scripts/smoke-dual-tone.mjs`, `scripts/smoke-phase9.mjs`, `scripts/smoke-phase10.mjs`, `scripts/smoke-phase11.mjs`, `scripts/smoke-phase12.mjs`, `scripts/smoke-phase13.mjs`, `scripts/smoke-instruments-keyboard.mjs`, `scripts/smoke-phase15-features.mjs`, `scripts/smoke-mouse-performance.mjs`.
- Before declaring a phase complete: typecheck, lint, build, full smoke, **then 3 consecutive green smoke runs** (re-run if any flake occurs).

## 11. Coding rules

- No comments unless they add real context.
- Follow existing patterns: engine-agnostic input adapters, AudioParam automation, singleton modules (`getX()`), normalized events, bounded sets/maps for bookkeeping.
- Keep test harness (`src/testHarness.ts`) additive-only; never change app behavior to satisfy tests.
- TypeScript strict (tsc `--noEmit`); ESLint with react-hooks + react-refresh configs.

## 12. Git rules

- Current `HEAD`: `04a6cec` (`docs: finalize production release readiness`). Branch `main`.
- Before commits: `git status`, `git diff`, `git diff --cached`.
- After commits: `git status`.
- One phase = one clean checkpoint commit with a message like `chore: checkpoint verified phase N ...`.

## 13. Before coding anything

1. Read `AGENT.md`, `PROJECT_STATUS.md`, `AGENT_PLAN.yaml`, `DEVELOPMENT_WORKFLOW.md`.
2. `git status` and `git log --oneline -5` — know the uncommitted work and the latest checkpoint.
3. Read the relevant source files and smoke scripts before touching anything.
4. Understand the architecture invariants before changing anything.
5. Follow `DEVELOPMENT_WORKFLOW.md` step by step.