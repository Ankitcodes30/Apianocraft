# PHASE_8_DUAL_TONE.md — Implementation Specification & Completion Report

> **Status:** COMPLETED & VERIFIED (291/291 smoke checks passing across 3 consecutive runs).

## 1. Goal

Allow **two instruments to play simultaneously**: the existing Main Tone chain
and a new Dual Tone chain. Both chains feed the same master output and obey the
same voice-management envelope.

## 2. Architecture (Implemented)

```
                   ┌── Main Tone Chain ──┐
Note Event ────────┤                     ├── Master (meter -> limiter -> destination)
                   └── Dual Tone Chain ─┘
```

- Main and Dual share: `SampleBank`/decode cache (no duplicate decoded buffers),
  the `AudioContext`, master output, performance-level input events
  (note-on/off, velocity, sustain, pitch bend, modulation), and voice management.
- Each chain has **independent** tone parameters (volume, pan, cutoff, reverb,
  chorus, delay) and its own instrument selection.
- Refactored `MainToneChain` into a reusable `ToneChain` class (`src/audio/effects/MainToneChain.ts`) with static impulse response (IR) buffer caching across all chain instances (`ToneChain.irCache`).
- Voice routing: `VoiceManager.start()` supports an optional `out?: AudioNode` target parameter to route main voices to `mainTone.input` and dual voices to `dualTone.input`.

## 3. Dual Tone features

| Control | State |
|---|---|
| ON/OFF | Implemented & verified |
| Instrument selection | Implemented (lazy loading & shared decode cache) |
| Dual Volume | Implemented & verified |
| Dual Pan | Implemented & verified |
| Dual Octave | Implemented & verified |
| Dual Transpose | Implemented & verified |
| Dual Tune | Implemented & verified |
| Dual Cutoff | Implemented & verified |
| Dual Reverb | Implemented & verified |
| Dual Chorus | Implemented & verified |
| Dual Delay | Implemented & verified |

- Main Tone controls remain **fully independent**.
- Dual instrument loading is **lazy**: no Dual sample loads until Dual is enabled or selected.
- **Same-instrument Main + Dual share decoded sample buffers** (one decode per file across both chains).

## 4. Performance behavior

- **Velocity:** Main and Dual receive the same normalized velocity; each layer resolves its velocity zone independently.
- **Sustain:** coherent for both layers (pedal on/off holds/releases both chains).
- **Pitch bend:** applies coherently to both layers.
- **Modulation:** performance modulation state remains shared.
- **Voice management:** a single musical note produces two voices (one per chain) when Dual is ON.
- **Polyphony:** capped at bounded pool size (64), adaptive polyphony halves under pressure and recovers.

## 5. Automated Verification & Smoke Suite (291 checks)

- `scripts/smoke-dual-tone.mjs` verifies:
  - Dual OFF (1 voice per key) vs Dual ON (2 voices per key)
  - Same-instrument cache sharing (no buffer duplication)
  - Layer-specific pitch offsets (octave, transpose, tuning)
  - Dedicated Dual Tone effect parameters (volume, pan, cutoff, reverb, chorus, delay)
  - Sustain pedal holding and releasing both layers
  - Peak limiter safety under dual polyphony

## 6. Acceptance Gate Verification

1. `npm run typecheck` ✓ (0 errors)
2. `npm run lint` ✓ (0 errors)
3. `npm run build` ✓ (0 errors)
4. `npm run smoke` ✓ (291/291 passing)
5. **3 consecutive green smoke runs** ✓ (Run 1: 291/291, Run 2: 291/291, Run 3: 291/291)