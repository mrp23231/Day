# Day — restrained product design refresh

2026-11-06. User asks to directly improve the existing app: professional, minimal and less generic. The earlier instruction to execute without further design questions remains in effect. This is an existing code target; preserve records, routes and interactions.

## Captured evidence

1. Planner at mobile width: small labels, layered card chrome and duplicated date navigation make basic planning feel indirect.
2. Planner at 1440 px: oversized rounded frame and empty area compete with tiny controls; the title describes a mood rather than the destination.
3. Today at 1440 px: a large slogan banner and four individually framed summaries consume the first screen; actions and actual records are pushed down.

Screenshots: `01-planner-mobile-before.png`, `02-planner-desktop-before.png`, `03-today-desktop-before.png`. Screenshots establish visual issues; they do not establish complete accessibility compliance.

## Chosen direction

Agent design decision: a quiet, practical workspace. White main canvas, pale neutral sidebar, charcoal typography, restrained olive accent, tabular figures. Body 14–15 px; captions at least 11–12 px. Radius 8–12 px, thin separators, no decorative shadows. Remove quote banners, promotional copy, repeated icons and unnecessary pills. Prefer real list/table structure over nested cards. Keep both appearance themes and the user's selected theme.

Today becomes a concise date heading, an unframed summary strip, a prominent agenda and a secondary nutrition/water rail. Planner becomes one calendar workspace with a single period control and quieter filters. Other sections inherit the same typography, spacing and controls; their headings and empty states become direct and functional.

## Implementation and verification

- [x] Update shared tokens, shell, navigation, forms, typography and surfaces.
- [x] Recompose Today and planner; tighten headings and secondary screens.
- [x] Run TypeScript, lint, existing domain/API tests and production build.
- [x] Inspect 1440, 768, 390 and 320 px; verify theme, dialogs and key interactions using isolated local test records. Keep the user's records intact.

## Verified result

TypeScript and ESLint pass; 28/28 existing domain, policy and API tests pass. Production build succeeds. In-app browser checks: all seven main sections fit 320 px without horizontal overflow; Today checked at 768 and 1440 px; planner task creation/completion, day/week views and theme toggle checked in the separate localhost:3002 QA space. Main production interface at localhost:3000 displays the original profile after refresh. Independent static review found no Important/Critical regressions. Screenshot comparison confirms removal of the banner and individual metric boxes, larger type, reduced ornament, and the continuous calendar surface.

Final captures: `05-today-production-after.png`, `06-planner-production-after.png`.
