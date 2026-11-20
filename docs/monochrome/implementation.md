# Day — monochrome refinement

User explicitly requests black and white, removal of the green accent, and further app improvements. Preserve the current app and records. Earlier request to implement without design approval questions still applies.

- [x] Make the existing light/dark design tokens neutral, remove remaining hard-coded hues, use monochrome installed-app icons and celebration effects.
- [x] Refine the existing bento: plain black/white primary surface, functional copy, quieter chrome, no diagonal decoration or duplicate progress summary.
- [x] Add inline task creation in the planner's day view: trim the title, create on Enter for the selected date, clear only after adding, reset active filters so the new task is visible. Keep the full task editor available.
- [x] Give high/low task priority a text label, because color no longer distinguishes it.
- [x] Verify keyboard, selected date and empty-title behavior with failing tests first. Run full tests, lint, types and production build. Inspect main pages, themes and mobile widths on an isolated origin. Refresh localhost:3000 and save final screenshots.

No new routes, storage schema changes, external services or image dependencies are needed. The icon is exported from the existing Day wordmark as a code-native vector.

## Verification

- Three quick-add tests observed failing against the initial stub, then passing. Full suite: 42/42; ESLint and TypeScript clean.
- Production build initially hit ENOSPC. Stopped the dev server, deleted only reproducible `.next/cache` and `.next/dev`, then rebuilt successfully. Production server restarted on localhost:3000.
- Browser QA on isolated localhost:3002 confirmed Enter creation, trimmed title, filter reset, explicit high-priority label, checkbox completion and grayscale celebration (`filter: grayscale(1)`, pointer-events:none).
- Light/dark visual checks at 1440 and 390 px; planner at 320 px. Nutrition, habits, progress, settings, water and Day AI at 320 px had no horizontal overflow. Computed foreground/background/border/SVG colors were neutral.
- Independent read-only review found no material issues; reviewer reran the three new tests successfully.
- User's profile and records remain in the main localhost:3000 data scope. Final screenshots: day-desktop.png and day-mobile.png.
