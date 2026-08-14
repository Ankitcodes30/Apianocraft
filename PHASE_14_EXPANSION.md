# Phase 14: Instrument-Library & Keyboard-Playability Expansion

## Overview

Phase 14 substantially expands Apianocraft's sound library and laptop playability while preserving all Phase 1–13 low-latency Web Audio performance and safety guarantees.

---

## 1. Instrument Library Expansion

18 instruments covering **14 distinct categories**:

1. **Acoustic Grand Piano**: `grand-piano` (Multisampled FLAC sample set, 60 zones, 2 velocity layers).
2. **Bright Concert Grand**: `bright-grand` (Crisp hammer attack & harmonic brightness).
3. **Warm Felt Grand**: `warm-grand` (Mellow felt hammer strike & fundamental focus).
4. **Vintage Electric Piano**: `electric-piano` (Rhodes-style bell tine EP).
5. **FM Dyno EP**: `fm-epiano` (80s FM metallic tine bell tone).
6. **Drawbar Organ**: `drawbar-organ` (B3 Hammond-style drawbar organ with rotary resonance).
7. **String Ensemble**: `string-ensemble` (Symphonic orchestral strings).
8. **Orchestral Tutti**: `tutti` (Full orchestral hit: brass, strings, sub-octave warmth).
9. **Trumpet Solo**: `trumpet` (Expressive solo brass with focused harmonics & vibrato).
10. **Brass Section**: `brass-section` (Full multi-instrument brass swell).
11. **Synth Brass**: `synth-brass` (80s polyphonic synth brass).
12. **Saxophone Lead**: `saxophone` (Alto/Tenor saxophone with reed harmonics).
13. **Oboe Solo**: `oboe` (Expressive double-reed woodwind).
14. **Hammered Dulcimer**: `dulcimer` (Dual-string metallic hammer strike & shimmer).
15. **Acoustic Pluck**: `pluck` (Fast transient plucked string).
16. **Synth Pad**: `synth-pad` (Ambient warm pad).
17. **Synth Bass**: `synth-bass` (Fat sub synth bass).
18. **Demo Synth**: `demo-piano` (Lightweight oscillator synth).

---

## 2. Full A–Z QWERTY Keyboard Layout & Playability

- **Multi-Octave Piano Mapping**:
  - **Lower Octave (Row 4 Bottom & Row 3 Home)**: `z x c v b n m , . /` (C3..E4) & `s d g h j l ;` (sharps).
  - **Upper Octave (Row 2 QWERTY & Row 1 Numbers)**: `q w e r t y u i o p [ ]` (C4..G5) & `2 3 5 6 7 9 0 =` (sharps).
- **Modifier Layers**:
  - `NORMAL`: Default 2.5 octave chromatic piano range.
  - `SHIFT` (Hold Shift): Transposes **+1 Octave (+12 semitones)** & sets Fortissimo velocity `0.90`.
  - `CAPS LOCK` (Caps Lock On): Transposes **-1 Octave (-12 semitones)** & sets Mezzopiano velocity `0.55`.
- **Keyboard Panel UI Upgrade**:
  - Active modifier badges (`Shift: +1 Oct (v=0.9)`, `CapsLock: -1 Oct (v=0.55)`).
  - Interactive multi-row key map legend.

---

## 3. Verification Summary

- `npm run typecheck`: **PASS** (0 TypeScript errors)
- `npm run lint`: **PASS** (0 ESLint warnings/errors)
- `npm run build`: **PASS** (Production PWA build)
- `npm run smoke` (3 consecutive runs): **PASS 385/385 checks** across all 3 runs.
