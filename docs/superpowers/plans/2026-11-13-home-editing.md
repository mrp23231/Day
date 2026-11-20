# Home editing implementation plan

> **For agentic workers:** Use superpowers:executing-plans or subagent-driven-development. Checkbox steps track progress.

**Goal:** Direct home-screen card/photo editing and smooth colorful celebrations.
**Architecture:** Root owns sortable home composition and integration; independent workers own balloon rendering and reusable inline photo dialog/reveal/cache. Existing DayProvider is the only preference writer. No Git repository is present; work remains in the authorized workspace without commits.
**Tech Stack:** Next16, React19, TS, dnd-kit core/sortable, Motion/CSS, current IndexedDB.
**Spec:** docs/superpowers/specs/2026-11-13-home-editing-design.md

## Constraints/review focus
- Long press must not intercept task buttons, text editing or normal scrolling.
- Cancel/release/blur/unmount before activation must not reorder; active drag cancellation preserves order.
- Hidden slots stay stable, reorder uses current preferences and cannot duplicate/drop cards.
- Edit-mode content is inert; accessible move controls are available; photo dialog cannot cause Escape to exit underlying editing.
- Scope/reset/unmount invalidates uploads; unchanged object URLs remain stable; reduced motion remains usable.

## Tasks
- [x] Balloons: diagnose installed renderer, red lifecycle tests, bounded colorful effect, focused green tests. Worker owns balloons.tsx/CSS/tests and exact obsolete grayscale rule only.
- [x] Photo editor/reveal/cache: red target upload/remove/caching tests, PhotoEditor({target:PhotoTarget,onClose}), PhotoSurface load reveal, stable URL cache, focused green tests. Worker owns appearance/photo-editor* and personal-photos* only.
- [x] Home layout: red order and gesture/keyboard/edit-state tests, implement TodayLayoutEditor({cards:Record<TodayCard,ReactNode>}) + scoped CSS + pure visible-order helper, wire Overview toolbar and existing slots. Root owns these files/package manifests.
- [x] Independent read-only review and fix substantive findings.
- [x] Full serial tests, lint/types, production build; isolated browser longpress/drag/reorder/reload/photo/color/lifecycle QA, 320/390/1440 widths; preserve main user data and restore localhost3000.

## Ledger
- Ruling: no additional design questions — current user specifies gesture and asks implementation; previous opt-out persists. Added explicit button/move alternatives for discoverability/accessibility.
- Balloons evidence: installed library renders viewport-sized SVG/filter layers for 25–30s; text path repeatedly measures and lacks root cleanup. Global grayscale rule explains lost colors. Worker owns isolated correction.
- Pre-flight shared interfaces: root consumes PhotoEditor target/onClose and unchanged PhotoSurface; worker preserves current photo context API. Balloon API remains launchAnimation():Promise<void>.
- Root red stubs produced five behavioral failures; order/editor implementation then passed. Touch tests use the original touched node, matching the sensor listener target.
- Review P2 reproduced red: hold/move/blur/release could commit an old sensor. Supported Escape cancellation now detaches listeners without remounting card drafts; sentinel preserves editing. Independent recheck passes.
- Review P2 reproduced red: tall-card gap drop selected the original upper card. Compact overlay and fallback collision rectangle now follow the pointer, retaining original keyboard geometry. Independent recheck passes.
- Photo replacement red/green: keep the visible layer while its replacement URL loads, retain unrelated URLs. No schema/backend changes.
- Removed unused balloons-js; installed dnd-kit core/sortable/utilities. Full serial suite208/208 across34 files; ESLint and TypeScript exit0. Final production verification complete on2026-11-14; see docs/qa.md and docs/home-editing/.

- Browser Escape follow-up: consumed dismissal could exit underlying editing after modal unmounted. Prevented-event regression failed, defaultPrevented guard fixes it; real production recheck passes.
