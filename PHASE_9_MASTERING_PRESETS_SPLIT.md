# Phase 9: Master Bus Processing, Presets & Split Keyboard Mode

## Overview
Phase 9 expands Apianocraft's digital keyboard workstation capabilities with three major production features:
1. **Master Bus Processing & 3-Band Parametric EQ**: Global master output gain stage and 3-band EQ (Low shelf 100 Hz, Peaking Mid 1 kHz, High shelf 8 kHz) feeding the peak limiter worklet with live visual metering.
2. **Split Keyboard Mode**: Dual zone keyboard splitting with independent lower zone instrument, octave shift (-4..+4), transpose (-12..+12), volume/pan, dedicated lower tone chain, and pedal sustain governance.
3. **Workstation Preset System**: Factory presets (`Concert Grand`, `Piano & Warm Pad Dual`, `Split Bass & Piano`, `Vintage EP Chill`) plus complete LocalStorage persistence for user preset creation, loading, and deletion.

---

## Architectural Summary

```
Input (QWERTY, Mouse, Touch, MIDI)
  └─► NoteEventBus
        └─► AudioEngine
              ├─► Lower Zone (note < splitPoint when Split ON)
              │     └─► lowerTone (ToneChain) ──┐
              ├─► Main Zone (note >= splitPoint)│
              │     ├─► mainTone (ToneChain) ───┼─► masterGain
              │     └─► dualTone (ToneChain) ───┘      │
              │         (if Dual ON)                    ▼
              │                                    masterEqLow (100 Hz)
              │                                         │
              │                                    masterEqMid (1 kHz)
              │                                         │
              │                                    masterEqHigh (8 kHz)
              │                                         │
              │                                    Peak Limiter Worklet
              │                                         │
              │                                     Destination
```

---

## Implementation Verification

- **TypeScript Typecheck**: PASS (0 errors)
- **ESLint Linting**: PASS (0 errors, 0 warnings)
- **Vite Production Build**: PASS (Clean PWA build)
- **Automated Smoke Tests**: **310/310 passed across 3 consecutive runs** (19 new Phase 9 checks covering Master EQ, Split Mode, sustain pedal coherence across split zones, factory presets, and LocalStorage user preset lifecycle).
