# Completion Components Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. Track verification here; no git repository exists in this workspace.

**Goal:** Integrate animated completion controls, last-task balloons and a real daily bento into Day.
**Architecture:** Reusable UI in src/components/ui; pure date-aware selectors in src/lib/completion.ts; existing DayProvider coordinates mutations and celebration.
**Tech Stack:** Next 16, React 19, TypeScript, Tailwind 4, lucide-react, balloons-js, Vitest/Testing Library.
**Spec:** docs/superpowers/specs/2026-11-06-completion-design.md

## Global Constraints
- Brand Day; Russian UI; no invented personal data.
- Keep storage schema and per-date recurrence semantics.
- Honor reduced motion and keyboard interaction.

## Review Focus
- Controlled checkbox must not diverge from persisted state.
- Native keyboard Space and disabled behavior must work.
- Celebration only follows today's incomplete-to-complete final task.
- History is seven actual days including the selected day, no future completion leak.
- Empty/over-goal numbers and narrow/dark layouts remain usable.

### Task 1: Reusable checkbox
- [x] Add meaningful controlled/uncontrolled, keyboard and disabled tests; run RED.
- [x] Implement src/components/ui/animated-check-box.tsx and scoped CSS. Run GREEN.
- [x] Replace TaskRow and habit completion controls, preserving editing and date labels.

### Task 2: Completion celebration
- [x] Test a pure shouldCelebrateTasks(tasks,id,date,today) policy for final-task, undo, unrelated dates and empty lists; run RED.
- [x] Implement policy and typed src/components/ui/balloons.tsx with lazy loading and reduced-motion suppression.
- [x] Wire the existing provider's task action, outside state updater, with a per-scope/day session guard. Verify GREEN.

### Task 3: Real daily bento
- [x] Test taskCompletionHistory(tasks,date) for zero history and recurring dated records; run RED.
- [x] Implement src/components/ui/stats-bento.tsx with DayData props and replace Today metrics. Add missing shadcn semantic Tailwind mappings.
- [x] Verify full tests, lint, typecheck, desktop/mobile/dark/browser task and habit interactions, production build. Request read-only final review; address material findings. Rebuild and refresh localhost:3000.

## Verification ledger

- RED: completion/history stubs produced four expected assertion failures; checkbox stub produced four missing-control failures. npm's initial test dependency installation failed with ECONNRESET; retry succeeded.
- GREEN: 39/39 tests; ESLint clean; TypeScript clean; production build passed.
- Final review: independent read-only review of the integration found no material issues; reviewer reran all 11 new tests successfully.
- Browser QA on localhost:3002: task completion by Space; undo; persisted completion on reload; completion status and balloons DOM with pointer-events:none; habits created/completed; past-day history updates streak; future completion disabled; mobile light/dark at 390px and tablet at 768px have no horizontal overflow. Corrected primary-card text contrast found visually.
- Main user records remain on localhost:3000; synthetic QA records are isolated on localhost:3002.
