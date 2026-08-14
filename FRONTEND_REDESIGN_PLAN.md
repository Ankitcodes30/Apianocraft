# Apianocraft UI/UX Redesign — Execution Report

## Overview
This document records the complete visual, architectural, and component redesign of **Apianocraft**, migrating from ad-hoc CSS layout to a **shadcn/ui + Tailwind CSS** component design system reconciled with the Discord `DESIGN.md` design tokens.

---

## Shipped Enhancements

### 1. Theme System — Blocking FOUC Fix
- Added a synchronous, blocking inline `<script>` in `index.html` executing before any CSS or React code loads.
- Evaluates `localStorage.getItem('apianocraft-theme')` (with fallback to `prefers-color-scheme`) and sets `class="dark"` and `data-theme` on `<html>` before first paint.
- Suppresses initial transitions via a `.no-transitions` class on `<html>`, removed smoothly after first paint via double `requestAnimationFrame`.
- Added smooth `150ms` theme transition on `body` for manual theme toggling.
- Migrated theme storage key to `apianocraft-theme` while maintaining backward compatibility with legacy `apiano_theme_preference`.

### 2. Light Mode Piano Key Rendering Audit
- Converted all hardcoded hex values in `PianoKeyboard.tsx` styling to theme-driven CSS variables (`--key-white-top`, `--key-white-bottom`, `--key-white-border`, `--key-black-top`, `--key-black-bottom`, `--key-active-top`, `--key-active-bottom`, `--key-label`).
- Added subtle `box-shadow: inset 0 -1px 0 var(--key-white-border), 0 1px 3px rgba(0,0,0,0.08)` on white keys in light mode, ensuring distinct visible edges against light page backgrounds.
- Enhanced piano keyboard container (`.kb`) elevation with theme-aware borders and shadow separation.
- Tuned key active/pressed contrast highlights for maximum legibility in both Light and Dark modes.

### 3. Tailwind CSS v4 + shadcn/ui Component System Migration
- Integrated `@tailwindcss/vite` plugin and configured `@theme` tokens in `src/styles/index.css` matching `discord/DESIGN.md` spacing, border-radius, and color primitives.
- Built reusable shadcn/ui primitives in `src/components/ui/`:
  - `Button` (`src/components/ui/button.tsx`) with workstation variants (`default`, `secondary`, `outline`, `destructive`, `ghost`, `green`, `panic`, `on`).
  - `Card` (`src/components/ui/card.tsx` — `CardHeader`, `CardTitle`, `CardContent`, `CardFooter`).
  - `Select` (`src/components/ui/select.tsx`) wrapping native `<select>` for zero-breakage smoke compatibility.
  - `Slider` (`src/components/ui/slider.tsx`).
  - `Badge` (`src/components/ui/badge.tsx` with `ok`, `warn`, `bad`, `accent` status variants).
  - `Tabs` (`src/components/ui/tabs.tsx` — `TabsList`, `TabsTrigger`, `TabsContent`).
  - `Collapsible` (`src/components/ui/collapsible.tsx`).
- Migrated top performance dock (`App.tsx`), tabbed inspector (`WorkstationInspector.tsx`), tone panels (`MainTonePanel`, `DualTonePanel`, `SplitPanel`), FX panels (`ArpeggiatorPanel`, `PortamentoPanel`, `PerformancePad`, `MasterPanel`), and tools/system panels (`RecorderPanel`, `WorkstationToolsPanel`, `PresetPanel`, `MidiPanel`, `KeyboardPanel`).
- Compacted engine diagnostics (`EngineStatus.tsx`) into a collapsible telemetry drawer while preserving all `.chip` selectors and text values for smoke tests.

### 4. Layout & Hierarchy Polish
- **Dual Tone Empty State**: Added a dedicated placeholder card with a music icon ("Enable a second layer to blend two instruments together") and an "+ Enable Layer B" action button when Layer B is OFF. Collapses panel height when disabled.
- **Brand Logo & Wordmark**: Designed a theme-aware SVG keyboard logo mark (`currentColor`) alongside the styled `Apianocraft` wordmark in the top dock.
- **3-Tier Typography Hierarchy**: Standardized section headers (`text-[11px] font-bold uppercase tracking-wider text-muted-foreground`), control labels (`text-[11px] text-muted-foreground`), and readout values (`font-mono text-[11px] tabular-nums text-foreground`).

---

## Verification Results
- `npm run typecheck`: **PASS (0 errors)**
- `npm run lint`: **PASS (0 warnings, 0 errors)**
- `npm run build`: **PASS (PWA SW & bundle cleanly generated)**
- `npm run smoke`: **PASS (368 / 368 assertions green across 3 consecutive runs)**
