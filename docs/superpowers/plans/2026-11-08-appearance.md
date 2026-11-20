# Personal Appearance Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans and focused parallel work. Track steps with checkboxes.

**Goal:** A premium source-based theme reveal and persistent background choices in Day.
**Architecture:** The provider owns preferences and resolved theme; isolated theme UI owns only animation. A pure appearance module holds validated preset metadata, resolution and prepaint script. Settings composes these existing app contracts.
**Stack:** Existing Next.js, React, strict TS, CSS, Radix, Motion, Lucide, Zod, Vitest.
**Spec:** docs/superpowers/specs/2026-11-08-appearance-design.md

## Global Constraints
- Day; Russian; monochrome; no new dependencies or fake records.
- Preserve all version-1 records, account isolation and light/dark/system behavior.
- Respect reduced motion and feature-detect native View Transitions.

## Review Focus
- Old saved preferences missing background must not make records unreadable.
- User theme reveal must not be canceled by the provider's persistence effect.
- Rapid toggles, OS theme and restored account state must agree with saved preference.
- Appearance must paint before hydration without trusting malformed cached values.
- Photo backgrounds must not compromise legibility or mobile navigation.

### Task 1: Source theme component
**Files:** src/components/ui/theme-toggle.tsx, theme-toggle.css, theme-toggle.test.tsx.
**Interface:** ThemeToggle controlled mode/onModeChange, applyTheme(mode,quiet?,root?,options?):Promise<void>, ThemeMode, ThemeRevealOrigin exports.
- [x] Extract supplied glyph/contour, adapt to Day and cover interactive/reduced-motion/fallback/cleanup cases RED→GREEN.

### Task 2: Persistent appearance and settings
**Files:** src/lib/appearance.ts, appearance.test.ts; domain.ts; day-provider.tsx; app-shell.tsx; app/layout.tsx; features/settings/appearance.tsx and tests; design-system/appearance.css; public/backgrounds assets/credits.
**Interfaces:** background presets classic/soft/mountains/architecture; provider resolvedTheme and setTheme(theme,origin?). Existing setPreferences handles background updates.
- [x] Write failing migration/bootstrap/resolution and settings interaction tests.
- [x] Implement backward-compatible schema/defaults, prepaint bootstrap, provider-owned theme transitions and background storage.
- [x] Connect source toggle to header and Settings, add preset picker and bundled assets.
- [x] Verify affected tests then browser appearance/reload and mobile navigation on isolated origin.

### Task 3: Verification and handoff
- [x] Full tests, lint, TypeScript, production build.
- [x] Independent review if service available; fix material findings with regression evidence.
- [x] Refresh production, preserve original data, save proof screenshots and report actual scope plus numbered future-feature menu.

## Execution ledger
- Existing project, no git repository. No scaffold, worktree or dependency install needed.
- Root owns app/provider/background integration; theme_component agent owns only its three UI files.

- Source component: 12 RED→GREEN tests; migration/bootstrap 7 RED→GREEN; controller 3 RED→GREEN; Settings 3 RED→GREEN.
- Final verification: 100/100 tests, ESLint, TypeScript and production build exit 0. Independent component/integration reviews: no material findings.
- Native reveal progress/cleanup, keyboard background selection, persisted appearance with task/water records, mobile320 and production desktop1440 verified. Main localhost:3000/settings is open with original Никита profile and classic background retained. QA records isolated on localhost:3004; QA server stopped after tab cleanup. Proof screenshots in docs/appearance/.
