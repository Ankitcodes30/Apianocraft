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

## Architecture (Phase 13 — Complete Digital Keyboard Workstation)

```
Input (mouse/touch, QWERTY, MIDI)
  -> NoteEventBus (normalized events; input adapters never touch the engine)
  -> AudioEngine.noteOn/noteOff   (React is NOT in this path)
  -> Split / Dual Layer Dispatcher
  -> VoiceManager (adaptive polyphony cap, voice stealing)
  -> Voice (per-note AudioBufferSource + gain envelope on the audio clock)
  -> MainToneChain / DualToneChain -> Master EQ
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
- Dual Tone Layering: run two independent sound generators (with separate tone chains and tuning) simultaneously.
- Keyboard Split Mode: assign independent instrument, volume, octave, and transpose to lower vs upper keyboard zones.
- Workstation Tools: Sample-accurate Audio-Clock Metronome (30–280 BPM) and Real-Time Pitch Class Chord Detector (triads, 7ths, slash inversions).
- Performance Recorder: Capture performance timelines, transport playback, and binary Standard MIDI File (`.mid`) export.
- Mouse Performance Expression Control: Use laptop/mouse cursor movement directly over the piano surface as a real-time expression controller (ΔX = pitch bend, ΔY = modulation) without parameter jumps or note triggers.
- PWA & Error Isolation: Service Worker offline asset caching, network status banner, and React Error Boundaries around UI control panels.

## Computer Keyboard (QWERTY, Phase 7.5)

- `src/keyboard/QwertyManager.ts` is an input adapter like `MidiManager`:
  it emits normalized `NoteEventBus` events (`source: 'keyboard'`) and never
  calls the engine directly.
- Layout: `A W S E D F T G Y H U J` = C4..B4, `Z` = octave down, `X` =
  octave up (QWERTY-local octave, -4..+4). The emitted note flows through
  the existing transpose / octave / tuning / bend / sustain pipeline.
- A computer keyboard has no real velocity, so notes use a fixed velocity
  (0.7, configurable via `QwertyManager.setVelocity`) — nothing fake.
- Safety: OS key-repeat and duplicate keydowns never re-trigger; keys typed
  into `input`/`textarea`/`select`/`contenteditable` never play notes;
  Ctrl/Cmd/Alt combinations are ignored; window blur and tab-hide release
  only the QWERTY-held notes (MIDI/mouse notes are untouched).

## Instruments (8 Instrument Bank)

- **Grand Piano** — Salamander Grand Piano V3 subset (Alexander Holm, CC BY 3.0): 30 zones across 88 keys x 2 velocity layers, 60 FLAC files, ~83 MB.
- **Electric Piano** — Multisampled Rhodes-style electric piano with warm velocity response.
- **Synth Pad** — Polyphonic ambient analog pad synthesizer.
- **Drawbar Organ** — Organ instrument with harmonic drawbars.
- **String Ensemble** — Orchestral string ensemble layer.
- **Synth Brass** — Bright polyphonic brass synthesizer.
- **Synth Bass** — Deep resonant bass synthesizer.
- **Demo Piano** — Procedurally synthesized provider (no assets) used for fast validation.

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
clean console — plus Grand Piano loading, Dual Tone doubling, Split keyboard zones,
presets, instrument switching across all 8 bank sounds, recorder MIDI export, Metronome & Chord Assist,
and PWA offline banner & Error Boundary resilience (356/356 checks passing). Results land in `smoke-results.json` plus a screenshot.

## Licensing

The Grand Piano samples are the Salamander Grand Piano V3 set by Alexander
Holm, CC BY 3.0 (see `LICENSE.md` and
`public/samples/grand-piano/ATTRIBUTION.txt`). The Demo Piano is synthesized
in-engine and requires no assets.
