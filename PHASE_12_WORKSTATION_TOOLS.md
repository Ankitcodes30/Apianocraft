# Phase 12: Workstation Tools (Metronome & Real-Time Chord Assist)

## Overview
Phase 12 completes Apianocraft's performance and practice workstation tools with two core features:
1. **Sample-Accurate Audio-Clock Metronome (`src/audio/tools/Metronome.ts`)**:
   - Web Audio lookahead scheduler using `AudioContext.currentTime` (guarantees zero timing jitter even under heavy UI load).
   - Procedural wooden click impulses (1500 Hz accented beat 1 vs 1000 Hz normal beats).
   - Configurable BPM (30..280 BPM), time signatures (`2/4`, `3/4`, `4/4`, `6/8`), beat 1 accent toggle, metronome volume slider, and Tap Tempo calculator.
2. **Real-Time Chord Detector & Scale Harmony Guide (`src/audio/tools/ChordDetector.ts` & `src/audio/tools/ScaleProvider.ts`)**:
   - Pitch class set matching algorithm for real-time chord detection (Triads, 7ths, Diminished, Augmented, Sus2/Sus4, Add9, and slash-chord inversions e.g. `C/E`).
   - Scale degree highlight mapping for 10 scale modes (Major, Minor, Pentatonic, Blues, Dorian, Mixolydian) rendered directly on the `PianoKeyboard` (`data-scale-highlight="root"` / `degree`).

---

## Verification Results

- **TypeScript Typecheck**: PASS (0 errors)
- **ESLint Linting**: PASS (0 errors, 0 warnings)
- **Vite Production Build**: PASS (Clean PWA build)
- **Automated Smoke Tests**: **349/349 passed across 3 consecutive runs** (8 new Phase 12 checks covering metronome scheduler state, BPM updates, tap tempo, and real-time chord detection).
