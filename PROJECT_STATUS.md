# PROJECT_STATUS.md — Apianocraft status dashboard

*Read this first for a quick picture; read AGENT.md for the authoritative context.*

## Snapshot

| Item | State |
|---|---|
| Current phase | **Phase 8 — Dual Tone Layering** (implemented, verified 3x, **ready for checkpoint commit**) |
| Latest Git checkpoint | `7d8535f` `chore: checkpoint verified phase 7 audio engine` (HEAD, branch `main`) |
| Working tree | Modified engine/UI/harness files + untracked Dual Tone & QWERTY additions — see below |
| typecheck | ✓ (verified 0 errors) |
| lint | ✓ (verified 0 warnings) |
| build | ✓ (verified 0 errors) |
| smoke | **291/291 ✓** — verified 3 consecutive runs (0 failures across all 3 runs) |
| Next action | Obtain user approval to commit Phase 8 checkpoint |
| Next phase | **Phase 9 — Audio Effects Polish & Mastering** |

## Implemented features

- Grand Piano (Salamander V3 subset: 30 zones × 2 velocity layers, 60 FLAC, ~83 MB, CC BY 3.0)
- Electric Piano & Synth Pad sound presets
- Dual Tone Layering: Dual layer enable/disable, instrument selection, tuning, octave shift, transpose, and dedicated tone chain effects (reverb, chorus, delay)
- Velocity layers, sustain, pitch bend, modulation
- MIDI input, QWERTY input, mouse/touch piano, performance XY pad
- Octave, transpose, fine tuning
- Adaptive polyphony, voice stealing, retrigger handling
- Main Tone & Dual Tone Chains: volume, pan, cutoff, reverb, chorus, delay
- Limiter (AudioWorklet + fallbacks), diagnostics, error handling
- Lazy sample loading + 3-tier cache (decoded LRU ~128 MB → IndexedDB → network)
- PWA

## Smoke suite (291 checks)

- `scripts/audio-smoke.mjs` — orchestrator (headless Chrome/Edge vs production build, port 5199); base engine/MIDI/pad checks
- `scripts/smoke-phase7.mjs` — Main Tone + effects checks
- `scripts/smoke-qwerty.mjs` — QWERTY checks (43), including pending-off sustain regression
- `scripts/smoke-dual-tone.mjs` — Dual Tone checks (19), verifying independent routing, dual voices, layer tuning, effect processing, and sustain coherence
- Outputs: `smoke-results.json` + screenshot

## Uncommitted work (Phase 8 Dual Tone & Phase 7.5 QWERTY)

Untracked:
- `scripts/smoke-dual-tone.mjs`
- `src/components/DualTonePanel.tsx`
- `scripts/smoke-qwerty.mjs`
- `src/components/KeyboardPanel.tsx`
- `src/keyboard/QwertyManager.ts`
- `PHASE_8_DUAL_TONE.md`

Modified:
- `src/audio/effects/MainToneChain.ts` — extracted `ToneChain` class with static IR buffer caching
- `src/audio/VoiceManager.ts` — added custom `out` AudioNode target parameter
- `src/audio/AudioEngine.ts` — dual tone lifecycle, dual voice spawning, layer routing, and parameter getters/setters
- `src/audio/types.ts` — dual tone state diagnostic types
- `src/App.tsx` — DualTonePanel integration & UI layout
- `src/testHarness.ts` — Dual Tone test harness API
- `scripts/audio-smoke.mjs` — wired `runDualTone` test suite
- `scripts/smoke-phase7.mjs` — timing & worklet level measurement stability fixes
- `src/styles/index.css` — dual tone panel styling
- `README.md` — documentation updates

## Next steps

1. Wait for user approval to commit Phase 8 (`git add .` with commit message `chore: checkpoint verified phase 8 dual tone layering`).
2. Begin planning Phase 9 per roadmap.