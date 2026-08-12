# DEVELOPMENT_WORKFLOW.md — Standard workflow for every coding agent

Follow this **exactly** for any task in this repository. It prevents wasted work,
broken invariants, and regressions.

## 1. Before touching anything (context loading)

1. Read `AGENT.md` — authoritative context (architecture, rules, history).
2. Read `PROJECT_STATUS.md` — quick status dashboard.
3. Read `AGENT_PLAN.yaml` — roadmap + current phase + spec pointers.
4. If a phase spec exists (e.g. `PHASE_8_DUAL_TONE.md`), read it before
   implementing that phase.
5. `git status` and `git log --oneline -5` — know the uncommitted work and the
   latest checkpoint (`7d8535f` = Phase 7).
6. Inspect the relevant source files (see file map in AGENT.md §4) and the
   relevant smoke scripts (`scripts/audio-smoke.mjs`, `scripts/smoke-phase7.mjs`,
   `scripts/smoke-qwerty.mjs`) before changing anything.

## 2. Understand before changing

- Read the architecture invariants in AGENT.md §§5–8 (audio, input, instruments,
  performance rules) and honor them.
- Existing patterns to copy: engine-agnostic input adapters that emit
  `NoteEventBus` events; `AudioParam` automation; singleton `getX()` modules;
  normalized events/state instead of React driving the engine.
- If you believe an invariant must change, discuss it rather than silently
  breaking it.

## 3. Implement (one phase at a time)

- Implement one phase (or one coherent unit of it) at a time. Never bundle
  unrelated work.
- **Add a regression test for every real bug** before/with the fix, proven to
  fail on the unfixed code and pass on the fixed code (see the Phase 7.5
  pending-off regression pattern in `scripts/smoke-qwerty.mjs`).
- **Never weaken existing tests** to make a run green. A flaky check means a
  timing/measurement problem to be fixed properly, or a genuinely rare failure
  to be understood first.

## 4. Verify (mandatory order — do not skip)

Run from the repository root (Windows PowerShell in this repo):

```powershell
npm run typecheck
npm run lint
npm run build
npm run smoke      # requires: build done first, Chrome/Edge installed
```

- `npm run smoke` must be run against the **production build**; it launches
  headless Chrome/Edge against a local preview (port 5199) and writes
  `smoke-results.json` + a screenshot.
- Fix any failures. Re-run the affected checks.
- For phase completion: **3 consecutive green smoke runs** (repeat the full
  sequence again if any run flakes).

## 5. Repeated regression tests

- After fixing a real bug, run the suite at least twice more to confirm the
  regression test itself is stable and deterministic.
- Prefer deterministic render-thread measurements (limiter worklet
  `clock()`/`level()`, engine diagnostics, voice tables, bus event ring) over
  transient analyser timing, which can stall in headless browsers.

## 6. Review and document

1. Review your diff: `git diff` (and `git diff --cached` after staging).
2. Update documentation for anything user-visible or architectural:
   - `README.md` when features/behavior/commands change;
   - `AGENT.md`, `PROJECT_STATUS.md`, `AGENT_PLAN.yaml` after each major phase
     (per AGENT.md §15);
   - the phase spec of the NEXT phase if the plan changed.
3. Clean up temporary debug scripts before finishing (never leave them
   untracked in the tree; never commit them).

## 7. Commit (only when explicitly appropriate)

- Never commit without an explicit instruction from the user.
- Stage only intended files. Never commit secrets, `node_modules`, `dist`,
  `smoke-results.json`, or temporary debug scripts.
- Commit message style used in this repo: `chore: checkpoint verified phase N ...`.
- One phase = one clean checkpoint commit.
- `git status` before and after; never `reset --hard`, force push, or rewrite
  history; never push unless explicitly instructed.

## 8. Completion report

When a phase/task is done, your report must include:

- what was implemented (files changed/added)
- verification evidence (typecheck/lint/build/smoke results, counts)
- regression proof if a bug was fixed (pre-fix vs post-fix numbers)
- any deviations from this workflow or from the plan, with reasons