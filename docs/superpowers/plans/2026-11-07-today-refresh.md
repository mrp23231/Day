# Today Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Deliver a polished, responsive and functional Day Today screen.
**Architecture:** Pure occurrence selectors feed the existing provider and a redesigned Today view. Existing task controls gain an explicit occurrence date. A mobile navigation component uses current routes and existing editor actions.
**Tech Stack:** Existing Next.js, React, TypeScript, CSS tokens, Motion, Radix, Lucide, Vitest.
**Spec:** docs/superpowers/specs/2026-11-07-today-design.md

## Global Constraints
- Day, Russian, monochrome, existing records and schemas preserved.
- No new dependencies, fake user records, notification delivery claims or backend changes.
- Local browser dates; future and historical dates labeled; reduced motion respected.

## Review Focus
- A past one-off completion must use its original occurrence date.
- Recurrence may not generate unbounded overdue copies.
- A selected future date must not label earlier future tasks overdue.
- All task rows must remain available beyond five entries and after filtering.
- Mobile navigation and sheets must remain reachable at 320px and above, in both themes.

### Task 1: Occurrence model and controls
**Files:** Create src/features/today/today-model.ts and today-model.test.ts; modify src/components/shared.tsx; create src/components/task-row.test.tsx.
**Interfaces:** selectDayTasks(tasks: Task[], date: string, today: string) returns scheduled, active, important, completed, overdue arrays; nextTimedTask(tasks: Task[], date: string, now: Date) returns Task | undefined. TaskRow gains occurrenceDate?: string.
- [x] Write failing tests for correct recurrence, overdue, completion date, important exclusions, upcoming time boundaries and selected dates.
- [x] Run tests and observe intended failures.
- [x] Implement selectors and explicit occurrence-date checkbox behavior.
- [x] Run tests; expect PASS.

### Task 2: Today screen and mobile navigation
**Files:** Rewrite src/features/today/overview.tsx; create src/features/today/today.css and overview.test.tsx; create src/components/mobile-nav.tsx; modify app-shell.tsx and app/layout.tsx.
**Interfaces:** Consume selectors, useDay provider and existing QuickTaskForm, Ring, TaskRow, NeonCheckbox. MobileNav receives pathname, onAdd and disabled.
- [x] Add failing integration tests for important filtering/completed disclosure and overdue completion.
- [x] Implement greeting, task progress, next timed task, week/date state, all task groups, habits/water/nutrition, real empty/loading states.
- [x] Implement floating five-item mobile nav, safe-area spacing, light/dark and reduced-motion styles.
- [x] Verify in browser on isolated origin, without changing user records. Exercise quick add, completion/undo/reload and central Add.

### Task 3: Delivery verification
- [x] Run full tests, lint, typecheck and production build.
- [x] Request one independent code review, resolve material findings with regression evidence.
- [x] Run production app, capture desktop/mobile screenshots and document actual implemented scope.

## Execution ledger
- Repository has no .git; worktree/commit/review-package scripts do not apply. Use filesystem review and this ledger.
- Task 1 selectors feed Task 2; explicit occurrence date must survive into all overdue controls.
- Task 1 complete: model RED 8 assertion failures → GREEN 13/13; occurrence control RED wrong selected date → GREEN 2/2.
- Task 2 complete: Overview RED 4/4 → GREEN 4/4; keyboard focus regression RED body instead of disclosure → GREEN; currently 74 total tests.
- Browser: isolated localhost:3003 records only. Enter quick add, timed/high priority editor, filtering, completion/undo, canonical overdue history, reload, habits, water and mobile Add verified. 320px/390px/768px bounds fit. Dark/light inspected.
- Review: independent reviewer dispatch failed because service usage was exhausted. Performed a separate manual code review of selectors, occurrence dates, context/persistence boundaries, cleanup, hydration, styles and navigation. No independent-review success is claimed. Removed server-side date-dependent week rendering until hydration to avoid cross-timezone initial markup differences.

- Task 3 complete: 75/75 tests, lint, types and production build exit 0. Production localhost:3000 running; main-user records intact. Final mobile browser verification: editor Escape restores focus to Add. Screenshots and actual integration limits recorded in docs/qa.md.
