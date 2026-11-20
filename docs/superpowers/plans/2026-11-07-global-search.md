# Global Search Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. This workspace has no git repository; record verification below.

**Goal:** Make records, sections and creation actions accessible from one keyboard-friendly search.
**Architecture:** Pure search index/selectors in src/lib/search.ts; Radix search dialog + shell integration under src/features/search. Existing DayProvider/router/editor primitives handle selection.
**Tech Stack:** React 19, Next 16, TypeScript, Radix Dialog, Lucide, existing monochrome tokens, Vitest/Testing Library.
**Spec:** docs/superpowers/specs/2026-11-07-global-search-design.md

## Global Constraints
- Brand Day; Russian copy; black/white; preserve existing records and storage schema.
- Local search only; current provider/account data only; no extra dependencies or routes.

## Review Focus
- Search descriptions/category and е/ё without losing exact-title ranking.
- Food and recurring task destinations must retain the correct dates.
- Keyboard selection must remain valid when the query/results change; ignore composition Enter.
- Cmd/Ctrl+K must not open a second dialog over the existing editor.
- Mobile height/width, focus return and current-account data must remain usable.

### Task 1: Search selectors
- [x] Write failing unit cases for normalization, ranking, multiword descriptions, empty suggestions, date targets, repeated foods and distinct record IDs.
- [x] Implement createSearchIndex(data:AppData,date:string):SearchDocument[] and searchDay(index:SearchDocument[],query:string):SearchResult[]; run GREEN.

### Task 2: Search dialog
- [x] Write failing UI cases for initial focus, query changes, Arrow/Enter selection, empty results, Escape and IME Enter.
- [x] Implement SearchDialog as Radix Portal/Content beneath an existing Root; accessible combobox/listbox and monochrome CSS.
- [x] Run tests, retaining real Radix behavior.

### Task 3: Shared integration
- [x] Implement GlobalSearch with Radix Root/Trigger, Cmd/Ctrl+K and existing router/provider actions. Key it to current account. Integrate header and stylesheet.
- [x] Verify tests, lint/types/build, independent code review, browser keyboard/actions/record dates and mobile/dark UI on isolated localhost:3002.
- [x] Refresh localhost:3000 with original records, save proof screenshots and leave it open.

## Verification ledger

- RED: all 11 initial selector/UI tests failed against their stubs. Initial implementation then exposed a tie between matching creation commands and records; record ties now rank before generic commands.
- GREEN: selectors and UI passed; full suite 53/53 before independent review.
- Final review: two material findings, no declined behaviors and no deferred issues. Fixed composing Escape after reproducing it with a failing test. Full suite now 54/54. Fixed mobile inherited left/bottom and subtracted the desktop/mobile top offsets from maximum height.
- Browser geometry RED: mobile left=-148/right=148 at width 320. Verified production GREEN: left=12/right=308, top=16/bottom=704 at 320x724. Also fits 320x480, 768x700, 1024x600 and 1440x900.
- Browser workflows: Meta+K and Ctrl+K, ArrowUp wrap and scroll, Escape focus restoration, editor hotkey guard, old task date and editor, food creation through command, food search from another day, habit editor, all four creation commands, settings navigation by alias, empty results and clear. Light/dark tested.
- Production build, TypeScript and ESLint passed. Production server at localhost:3000 restarted with new build. User records kept separate from localhost:3002 QA data.
- QA note: existing production service worker can cache development asset URLs; verify final styles against the production build. Next 16 blocks 127.0.0.1 dev-resource requests by default; use a fresh localhost dev port rather than weakening origin restrictions.
