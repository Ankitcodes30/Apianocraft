# PROJECT_STATUS.md — Apianocraft status dashboard

*Read this first for a quick picture; read AGENT.md for the authoritative context.*

## Snapshot

| Item | State |
|---|---|
| Current phase | **Phase B1 & B2 — Tone Controls & Dual Layering Visual Refinements** |
| Latest Git checkpoint | `04a6cec` `docs: finalize production release readiness` (HEAD, branch `main`) |
| Working tree | Modified files ready for user review (DO NOT commit automatically) |
| typecheck | ✓ (verified 0 errors) |
| lint | ✓ (verified 0 errors, 0 warnings) |
| build | ✓ (verified 0 errors, PWA SW generated) |
| smoke | **363/363 ✓** — verified 3 consecutive runs (0 failures across all 3 runs) |
| Next action | Proceed to Phase C1 & C2 — Master EQ, Reverb/Delay FX Rack & Expressive Controls |
| Next phase | Phase C1 & C2 — Master EQ, Reverb/Delay FX Rack & Expressive Controls |

## Implemented Features

- **Workstation Redesign & Studio Rack Architecture**:
  - **Main Tone & Master FX Bus (Layer A)**: Split into studio rack sub-cards for Primary Sound Controls and Master Effects Chain. Unit readouts and logarithmic badges.
  - **Dual Tone & Layer Balance (Layer B)**: Studio rack sub-cards for Layer B, active status badges, and a **Layer Mix (A ↔ B)** balance slider.
  - **Workstation Inspector Container**: 4-tab workstation inspector drawer (Tone & Layers, FX & Expression, Tools & Presets, System & MIDI) with minimize/expand capability.
  - **Top Performance Dock**: Consolidated 56px dock with brand logo, preset launcher, master volume, sustain toggle, panic button, and status LEDs.
- **38-Key Continuous Chromatic QWERTY Keyboard**:
  - Exactly 38 dedicated physical computer keys mapping directly to continuous MIDI notes 48 (C3) through 85 (C#6).
  - 3-Octave Range Coverage: Lower Range (-1) [C3..B3], Middle Range (0) [C4..B4], Upper Range (+1) [C5..C#6].
  - Direct Playability: Zero Shift, zero CapsLock, and zero octave switching required while playing songs.
  - Black Key Geometry: Dedicated physical keys for all black notes.
  - Sargam Mode: C# = Sa (D#=Re, F=Ga, F#=Ma, G#=Pa, A#=Dha, C=Ni).
- **Expanded Instrument Library (14+ Roland-class workstation categories)**:
  - Trumpet Solo, Brass Section, Saxophone Lead, Oboe Solo, Orchestral Tutti, Acoustic Pluck, Hammered Dulcimer, Bright Concert Grand, Warm Felt Grand, FM Dyno EP, Grand Piano, Electric Piano, Synth Pad, Drawbar Organ, String Ensemble, Synth Brass, Synth Bass.
- **Split Keyboard & Presets**: Independent lower/upper keyboard zones with adjustable split point and zone octave controls. Factory presets and custom user preset storage.
- **Metronome & Real-Time Chord Detection**: BPM control, audio-scheduled metronome, and real-time chord/inversion detection.
- **Mouse Performance Pitch + Modulation Control**:
  - Move laptop/mouse cursor over piano keyboard for delta-relative pitch bend (horizontal ΔX) and modulation (vertical ΔY).
  - Entry position serves as reference point (zero parameter jump on pointer enter).
  - Pointer leave, window blur, or feature disable safely resets pitch bend and modulation to 0.
  - Interactive DOM indicator badge displays real-time expression values with zero React re-renders.
  - Toggle button in header bar allows instant user enable/disable.
- **Performance & Safety**:
  - Adaptive 64-voice pool, zero-alloc note hot path, voice stealing, hold protection.
  - Focus safety: Editable controls (`input`, `textarea`, `select`, `contenteditable`) and modifier combos (Ctrl/Cmd/Alt) ignore piano keys.
  - Blur & Visibility: `blur` and `visibilitychange` automatically release active QWERTY notes.

## Smoke Suite (363 checks)

- `scripts/audio-smoke.mjs` — Master orchestrator (headless Chrome/Edge vs production build, port 5199).
- `scripts/smoke-qwerty.mjs` — 38-key continuous chromatic layout & Sargam checks.
- `scripts/smoke-instruments-keyboard.mjs` — Phase 14 instrument library & multi-range playability checks.
- Outputs: `smoke-results.json` + screenshot.