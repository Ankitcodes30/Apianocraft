# Apianocraft

Professional low-latency browser piano / digital keyboard workstation.

## Stack

React + TypeScript + Vite, Web Audio API (one persistent `AudioContext`,
AudioWorklet limiter), PWA via `vite-plugin-pwa`. Entirely client-side.

## Commands

```bash
npm install
npm run dev        # dev server
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run build      # tsc + production build to dist/
npm run preview    # serve dist/ locally
npm run smoke      # automated audio engine test against the production build
                   # (requires: npm run build first, and Chrome/Edge installed)
```

## Architecture (Phase 3 — multisampled instruments)

```
Input (mouse/touch today; QWERTY + MIDI in later phases)
  -> AudioEngine.noteOn/noteOff   (React is NOT in this path)
  -> VoiceManager (adaptive polyphony cap, voice stealing)
  -> Voice (per-note AudioBufferSource + gain envelope on the audio clock)
  -> instrument bus
  -> master gain -> analyser (meter tap) -> peak-limiter AudioWorklet -> destination
```

- One persistent `AudioContext` (`latencyHint: 'interactive'`), created on
  first gesture, auto-resumed on visibility change.
- All timing uses `AudioContext.currentTime`/AudioParam automation.
- Voice stealing: release-phase voices first, then sustain-held, then
  longest-sounding. Same-note presses retrigger with a fast release.
- Adaptive polyphony: cap = `min(64, hardwareConcurrency*16)`, halved under
  pressure, restored when healthy.
- Limiter is a custom lookahead peak limiter AudioWorklet with
  DynamicsCompressor fallback.
- UI highlights keys by toggling CSS classes directly from engine events —
  no React re-render on note events.
- Instrument abstraction (`src/audio/instruments/Instrument.ts`): instruments
  are interchangeable providers returning a buffer plus playback parameters
  (pitch, attack trim, gain). The engine never branches on instrument type.
- Multisampled instruments (`src/audio/samples/SampleInstrument.ts`) are
  driven by a manifest (zones, velocity layers, license fields). Loading is
  lazy and progressive: the first note waits only for its own file while the
  rest streams in the background. Caching is three-tier — decoded LRU
  (128 MB budget) -> raw bytes in IndexedDB -> network.
- Instrument picker in the header switches instruments and shows live sample
  load progress.

## Instruments

- **Demo Piano** — procedurally synthesized provider (no assets) used to
  validate the sampler path.
- **Grand Piano** — Salamander Grand Piano V3 subset (Alexander Holm,
  CC BY 3.0): 30 zones across 88 keys x 2 velocity layers, 60 FLAC files,
  ~83 MB. Samples live in `public/samples/grand-piano/`.

## Diagnostics

Status bar shows context state, limiter kind, estimated latency
(`baseLatency + outputLatency`), active/sustained voices, started/steals/
dropped/retrigger counters, pending loads, polyphony cap and FPS. For sampled
instruments it additionally shows load status/progress and, for the most
recent note, buffer acquisition and note-start timing.

## Testing

`npm run smoke` launches headless Edge/Chrome against the production build and
verifies: context running, single-note round trip, 16-note chords, a 400-note
retrigger storm, bounded voice pool, over-cap behavior, same-note retrigger,
sustain pedal hold/release, keyboard render isolation, heap stability and a
clean console — plus the Grand Piano: cold load from network, warm load from
IndexedDB, lazy first note, decoded-cache hits, 88-key zone coverage, and
cache-cleared pending-off storms. Results land in `smoke-results.json` plus a
screenshot.

## Licensing

The Grand Piano samples are the Salamander Grand Piano V3 set by Alexander
Holm, CC BY 3.0 (see `LICENSE.md` and
`public/samples/grand-piano/ATTRIBUTION.txt`). The Demo Piano is synthesized
in-engine and requires no assets.
