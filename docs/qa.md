# Day — verification record

2026-11-05. Unit tests were written and observed failing before domain implementation. New regression cases were likewise observed failing before policy fixes. See `src/lib/*.test.ts`.

## Browser QA

Performed with Codex in-app browser on the production build at a separate origin (`127.0.0.1:3001`) so test entries do not mix with the user's actual `localhost:3000` records.

- Task creation with time and daily recurrence; completion updates Today immediately.
- Water quick-add updates daily totals.
- Food entry with portion, calories, macros and favorite flag updates dashboard.
- Reload preserves task completion, food and water records.
- Habit creation and completion appear in dated calendar history and streak count.
- Simple/advanced nutrition switching keeps the diary and favorite meals intact.
- A 650 kcal calculated estimate shows a range explanation and cannot be applied; a 2759 kcal estimate updates settings, remains after saving and survives reload.
- At 320 px, the nutrition screen has no horizontal overflow. Settings theme controls were found to need wrapping and fixed.
- AI chat with no credentials returns the actual unavailable message and preserves the typed question.

## Final review fixes

Read-only independent review found five substantive issue categories. Fixed: stale cloud responses/draft loss using scope/generation/mutation guards and explicit restore; PKCE recovery callback/update mode; nutrition target validation; stale settings fields after calculator/account changes; completion filters evaluated for each displayed calendar date. Regression tests pass. There are no deferred review findings.

## Integration limits

- No Supabase project or OpenAI credentials were supplied. Live email/auth delivery, PostgreSQL migration execution, RLS with two live accounts, cloud storage and paid AI responses have not been tested against external services.
- Supabase snapshots are saved/restored explicitly. This is not automatic multi-device synchronization. Revisions reject stale writes; auth generation guards reject stale async results.
- The food scanner identifies candidates only. A trusted nutrition database is not connected, so nutritional values require manual verification/entry.
- PWA caches public assets and an offline fallback. An already-open application can use device-local records offline. A cold offline launch of all application routes and conflict-free offline cloud synchronization are not claimed.

## 2026-11-06 — completion components

Integrated the supplied animated checkbox, balloons-js wrapper and six-column stats bento into the actual app. Existing shadcn aliases resolve to `src/components/ui`; Tailwind semantic surface/border/primary-foreground tokens now map to Day's existing theme. No images are required by these components.

New behavior verified with 11 tests observed failing before implementation: native controlled/uncontrolled checkbox, keyboard Space, disabled control, final-task celebration policy, recurrence and seven-day selected-date history. Final full suite: 39/39; lint, TypeScript and production build passed. Independent read-only code review found no material issues.

Browser QA used the isolated localhost:3002 data scope. Verified task undo/completion by keyboard, reload persistence, completion status and loaded balloons element with pointer-events:none, daily habit completion, past-day streak updates and disabled future history. Checked light/dark mobile at 390px, tablet at 768px and desktop at 1440px. Main production app at localhost:3000 refreshed with the user's records, no synthetic test entries. Saved screenshots in `docs/completion-refresh/`.

## 2026-11-06 — monochrome refinement

All active theme tokens, hardcoded UI colors, installed-app icons, focus/selection states and completion effects now use black, white or neutral gray. The bento has quieter corners, functional copy and no decorative diagonal pattern; duplicate progress summary removed. High/low priorities use text labels.

Planner day view now has inline Enter-to-add. Tests cover trim/selected-date values, clearing and retaining focus, rejecting blanks/duplicate Enter, and submitting a draft after the selected date changes. Browser confirmed active filters reset after adding so the new task is visible. Full suite 42/42, lint/types/build clean. Initial build ENOSPC resolved by clearing reproducible Next.js caches only. Static independent review found no material issues.

QA data remains isolated on localhost:3002. Checked mobile layouts down to 320 px, neutral computed colors throughout the main routes, light/dark contrast, populated water chart and grayscale completion effect. Main localhost:3000 refreshed with original profile and records. Proof screenshots: docs/monochrome/day-desktop.png and day-mobile.png.

## 2026-11-07 — global search and commands

Global header search indexes the current provider's tasks, habits and foods locally. Empty input offers four creation commands and eight existing sections; query matches normalize е/ё, case and whitespace, match descriptions/categories and rank precise titles before generic suggestions. Record selection selects its date and opens the existing editor in the existing section. No data/schema/network integration changes.

Observed 11 initial failing tests, then green implementation. Independent review caught mobile dialog positioning inherited from the generic bottom sheet and composing Escape dismissal. Reproduced Escape failure in a new regression test; fixed both. Full suite 54/54; lint, types and production build pass. Reviewer set aside no behaviors; no unresolved findings.

Browser checked Cmd/Ctrl+K, arrows, Enter, Escape focus restoration, guard over active editors, historical task and food dates, food creation, habits, all creation commands, section aliases, empty state and clear. Production dialog bounds fit 320x480, 320x724, 768x700, 1024x600 and 1440x900. Main user's localhost:3000 records remain intact. Synthetic entries are only in localhost:3002. Proof screenshots in docs/global-search/.

## 2026-11-07 — Today Phase 1

Day branding and monochrome preferences retained over the attached template's DAYO/sage defaults. Today now has a personalized time-aware greeting, circular **task-only** progress, week selection, Enter quick add, important filtering, all active rows, completed disclosure, next timed task preview, dated one-off backlog, habits, hydration and compact nutrition access. Mobile has Today / Calendar / central Add / Habits / Profile; desktop sidebar remains collapsible. Other selected dates are explicit and have a return-to-today action. No task truncation or schema changes.

Occurrence model and UI tests were observed RED before implementation. Canonical overdue completion writes the original occurrence date; recurring missed days never accumulate backlog. Keyboard focus follows a completed task into its disclosure and returns to the plan heading on undo. A production browser check found editor Escape focus falling to body because the programmatic Radix dialog has no Trigger. Reproduced in a failing test, fixed opener restoration, then verified the actual mobile Add button regains focus after Escape.

Final verification: **75/75 tests across 12 files**, ESLint, TypeScript and production build exit 0. Browser QA used isolated localhost:3003 records only, with 320px/390px/435px/768px/1440px layouts, light/dark, populated/empty states, quick add, time/priority editor, filtering, task completion/undo, overdue history, reload, water, habits, Add sheet and profile navigation. Main localhost:3000 production refreshed with the original profile and no synthetic records. Proof screenshots in docs/today-refresh; desktop and populated mobile screenshots use QA fixtures, day-mobile.png uses the user's original empty current-day data.

An independent review was requested but the reviewer service failed on its usage limit; a separate manual review was performed instead. No independent-review success is claimed. Server reminders, push subscriptions, delivery/snooze, natural-language capture and full offline synchronization are future phases; the upcoming card only previews actual task time.

## 2026-11-08 — personal appearance

Integrated the supplied Cojeev theme toggle's actual sun/moon geometry, varied-origin organic 12-lobe contour and native page reveal into a focused Day component. Original MIT attribution is retained. The unrelated inlined component library, fonts and colored palette were omitted; existing Day system fonts and monochrome tokens remain. No new dependencies. `src/components/ui` is already the configured shadcn alias target.

The provider owns light/dark/system selection, resolves the device theme and persists it; background changes are handled in a separate effect so they do not cancel theme reveals. Startup/restored preferences and OS changes paint quietly. Validated prepaint theme/background caches avoid appearance flashes. The new defaulted `preferences.background` accepts old version-1 data without rewriting tasks or other records.

Four backgrounds are available in the first Settings panel: classic, soft, mountains, architecture. Public local photos have author/source credits in Settings and public/backgrounds/CREDITS.md. Full-card native radios support pointer/keyboard; grayscale backgrounds have contrast limits and opaque content cards. No custom image uploads, backend changes or new reminder claims.

TDD evidence: source component 12 failures → 12 passes; migration/bootstrap/resolution 7 failures → 7 passes; controller 3 failures → 3 passes; settings 3 failures → 3 passes. Final suite: **100/100 across 16 files**, serial execution; ESLint and TypeScript exit 0. Initial concurrent suites were resource-constrained; they are superseded by the complete successful serial run. Independent source-component and integration reviews found no material issues.

Browser QA on isolated localhost:3004: both theme controls agree, native reveal progress appears and cleans up, rapid changes settle without a retained snapshot, system/manual option, photo background selection, native radio ArrowRight, reload persistence, opaque light/dark cards, no horizontal overflow at 320px. A QA task and 150ml water survive reload with the chosen appearance; no synthetic records on localhost:3000. Actual OS preference changes and reduced-motion are covered by unit tests, not by modifying the user's OS settings.

Production build also passed. Final production preview is running on localhost:3000/settings with the original Никита profile and default classic background; no appearance preference was forcibly selected for the user. Source screenshot uses isolated QA preferences. Proof: docs/appearance/day-appearance-desktop.png, day-appearance-mobile.png and day-appearance-main.png.


## 2026-11-12 — focus, personal photos, daily review and Ding

Implemented the selected features in the existing Day app. Focus keeps one eligible task occurrence, timestamp-derived countdown/work time, pause/resume, early explicit task completion and a persistent cross-route dock. Countdown expiry waits for the user's start; timer expiry never auto-completes the task. Local focus state is account-scoped and validated; sessions older than24h expire.

Personalization supports photos for app background, desktop/mobile navigation and each Today card, plus card order/visibility and a default-order reset. Native JPEG/PNG/WebP/AVIF picker accepts inputs up to20MB; canvas resizes raster data to2000px, strips source metadata and stores compressed blobs in scoped IndexedDB. AppData contains only UUID references. Async generation guards prevent writes from a prior account/reset. Photos stay local and are excluded from JSON/cloud snapshots; missing photos on another device fall back safely. Existing theme and presets remain available.

Daily review displays actual occurrence-specific task/habit totals, water and food entries, with mood and a2000-character editable note. Future dates cannot be saved; date/account changes close unsaved drafts. Version1 defaults preserve old records. Independent review confirmed a cloud RPC omission of top-level reviews; fixed with tested encodeCloudState/decodeCloudState mapping to the existing preferences JSON envelope, without SQL migration. Reviewer rechecked the fix with no remaining material findings. Live Supabase execution was not possible without credentials; contract-level round-trip tests cover the existing RPC shape.

Ding React0.0.3 is installed and hosted once under DayProvider with resolved theme, Russian accessible labels and monochrome styling. Shared notify supports errors/descriptions/actions. Actual water addition has scoped undo; completed focus offers an open action. Action failures report errors and stale callbacks cannot overwrite newer notifications or act in the next account. These are in-app toasts, not background Web Push.

Final verification: **143/143 tests across25 files**, serial run after build processes exited; ESLint and TypeScript clean; production build exit0. Earlier overlapping build/test run had one Today interaction timeout (1 failed/139 passed); it was superseded by the complete successful serial run, without raising timeouts. TDD includes early completion, photo validation/storage/scope guards, schema migration, review persistence and the cloud omission regression.

Browser QA used isolated localhost:3005 records. Verified real upload of bundled test photos to space/navigation/water, persistence across reload and a four-day browser restart, photo overlays, reordering/hiding/restoring cards, countdown before23:59, running/pause/reload state24:55, early task completion, current-day review save/reopen, real water undo and light/dark views. Checked320px settings/Today (scrollWidth320),390px focus/review and1440px desktop. Final production browser console contained no warnings/errors. Proofs in docs/personal-space: focus-countdown.png, focus-mobile.png, personalization-mobile.png, review-mobile.png, day-desktop.png. Fixtures and photo choices are only on the QA origin.

Main localhost:3000 is running the final production build with the original Никита profile and records, no synthetic tasks/photos imposed. Temporary QA tab/server closed; viewport override reset. Main application tab left open.

## 2026-11-13 — animated day closure

Replaced the compact daily review with a three-stage full-screen flow: real animated statistics and completed task titles, optional per-task transfers, then a half-star day rating and optional note. Closure saves the original day's snapshot before moving tasks. Reopening a closed day edits its rating/note while retaining the snapshot and transfer log; transfers are not repeated.

Verification: **180/180 tests across 29 files** in the full serial suite. Independent review found a P2 race: the confirmation receipt used stale rendered data while validation ran later inside a React updater. The provider now validates synchronously against its current state and returns the exact committed data; closure uses that receipt and catches transaction errors. Fixed and independently rechecked. ESLint is clean; TypeScript passed after a narrow typing fix for a test's captured callback. Review metadata round-trips through the existing cloud RPC JSON envelope in contract tests; no live Supabase credentials were available.

Browser interaction checks used isolated localhost:3006 records. Actual keyboard and pointer holds of about 2.3 seconds confirmed closure; a short click cancelled without saving. Keyboard rating selected 4.5. Verified a one-off task transfer and a single daily recurring occurrence transfer, plus a custom November 15 destination entered through the native date input with the keyboard. Reopening and editing retained the original 1/3 task snapshot and did not repeat moves.

Playwright's native date `fill` through the in-app browser did not dispatch the React change event correctly and is not counted as a successful date-input check; the actual native keyboard date interaction worked. No QA fixtures were added to main localhost:3000.

Final production build exits 0. Final focused checks after copy/accessibility and test-typing cleanup: 12/12 tests; final ESLint exits 0. Production browser QA confirms a 650ms hold releases without saving and a 2.3s pointer hold saves; half-star keyboard input works. Checked light/dark layouts at 320/390/1440px with no horizontal overflow. Escape returns focus to the opener. Browser production warning/error logs are empty. Physical touchscreen input was not available; pointer cancellation and keyboard behavior have dedicated component tests.

Proofs: `docs/day-closure/results-desktop-dark.png`, `results-mobile-320-light.png`, `reflection-desktop-light.png`, `confirmation-mobile-light.png`, `saved-mobile-light.png`, `main-current-day.png`. Rich-data screenshots use only isolated QA records. Main localhost:3000 runs the new production build with the original Никита profile, selected theme and records; opened and closed the new review without saving. QA tab/server closed, temporary viewport reset, original main tabs preserved.

## 2026-11-13 - direct home editing and colorful balloons

Home cards enter edit mode after a stationary 550ms noninteractive hold or the visible button. Separate Mouse/Touch sensors preserve normal controls and early scrolling. Handles, keyboard dragging and adjacent-position buttons provide alternate input. Content is inert while editing. Dropping saves the current visible order without changing hidden slots; at least one block stays visible. Hidden blocks can be restored from the dock. Inline PhotoEditor reuses local scoped storage for each card, space and navigation. Decoded photos reveal with opacity/scale; the old image stays visible while a replacement URL loads and unrelated cached URLs remain stable. Reduced motion removes wiggle/reveal/drop animation.

Balloons investigation: global grayscale plus viewport-sized SVGs with multiple blur/shadow layers lasting 25-30s. The replacement renders ten small colorful WAAPI sprites using only transform/opacity, at most 3.5s plus 4s fallback cleanup. No forced layout/per-frame JS, overlapping launches or persistent roots. Unmount/live reduced-motion cancellation is covered by seven lifecycle tests. Removed unused balloons-js.

Independent review reproduced two P2 issues, each pinned red then green: blur/remount left an old sensor able to commit on release, and a compact overlay's old collision rectangle mis-targeted gap drops for tall cards. Supported Escape cancellation now detaches sensors without remounting local card drafts. Pointer-centered fallback matches the preview, retaining keyboard geometry. Independent rechecks report no remaining findings. Production browser then caught consumed Escape also exiting the underlying editor; a prevented-event regression reproduces it and the editor now respects event.defaultPrevented.

Development browser QA used only localhost:3007 test records: real 700ms hold enters editing without reorder; pointer drag changes visible positions; Space/ArrowUp/Space moves water before plan. Order/photo survive reload. Real inline uploads of bundled mountains.jpg and architecture.jpg are stored and reach the loaded visible state. At 320/390px, hide/restore and photo controls fit with no horizontal overflow. No test data or photo preferences imposed on main localhost:3000. Final verification and screenshots recorded below.

Final verification (completed 2026-11-14): 208/208 tests across 34 files, complete serial run; final ESLint exits0, production build including TypeScript exits0. Earlier repeated suites/builds were superseded after actual review/browser findings, without increasing timeouts. Final production browser confirms Escape closes photo and preserves edit mode; 320/390/1440px layouts have no horizontal overflow. Real large-plan pointer drop reorders correctly. Today's last test task launches exactly ten sprites in six colors; all celebration roots disappear afterwards. Production warning/error logs are empty. This is rendering/lifecycle evidence, not an FPS benchmark. Touch activation/early-scroll cancellation are covered by component tests; no physical touchscreen was available.

Proofs in docs/home-editing/: edit-desktop-light.png, edit-mobile-dark.png, edit-mobile-320-dark.png, photo-editor-mobile-dark.png, balloons-desktop.png. Only isolated localhost3007 records/photos appear in rich proofs. Main localhost3000 has been reloaded with the new build and original Nikita profile/records; existing planner tab retained, no fixtures or photo/order choices imposed. QA production tab/server closed, temporary viewport reset. The browser's temporary connection-error tab is unmarked and eligible for normal turn cleanup.

## Account welcome and Day AI beta — 2026-11-14

- Profile now begins with the account card and Google/email choice. Unconfigured Google shows an honest inline message; email offers local mode and a return to provider choices.
- Three animated welcome questions tested in browser on a separate origin (`localhost:3008`): chosen name, habits focus, flexible rhythm. Back/final save, personal welcome and return to Today worked; greeting used the saved name. Checked dark desktop and 390/320 px mobile; no horizontal overflow at 320 px.
- AI beta clearly separates current text advice from upcoming task creation/media. Suggestion fills and focuses the expanding composer; the composer scrolls into view above mobile navigation. Context sharing begins unchecked. No external messages were sent.
- Independent review found and fixed recovery intent lost on INITIAL_SESSION and manual onboarding opening before remote restoration. Regression tests cover both.
- Automated suite: 263 tests in 41 files passed. An earlier host-suspended run timed out in the pre-existing focus test; the focused rerun and complete rerun passed without timeout changes. Lint clean.
- Auth forms/OAuth/cancellation and chat request/retry/account isolation tested against mocked service boundaries. Live Google/email delivery and AI response are not claimed: Supabase/OpenAI configuration is absent locally.
- Screenshots in `docs/account-ai/`. All questionnaire fixtures and preferences used the isolated QA origin; main user data was not seeded or replaced.
- For development QA, use a fresh port: the prior production service worker on 3007 cached development chunks and produced a stale hydration mismatch. Fresh 3008 had no console errors. This cache observation is separate from the verified production build.

Final production verification: Next build including TypeScript exits 0; final assistant/composer 25/25 and onboarding 9/9 pass after final copy/scroll/test-type changes. Build needed the authorized non-sandboxed compiler run. Main localhost3000 restarted with original Никита profile, dark theme and mountain background; profile provider split and AI beta verified. Production warning/error logs empty. Proofs: docs/account-ai/profile-production.png and day-ai-production.png. No records or preferences were imposed on the main origin.

## Settings simplification — 2026-11-14

Removed the duplicate PersonalizationSettings panel from Settings; home photo/order/visibility editing remains in TodayLayoutEditor. Scoped ESLint and production build (including TypeScript) exit 0. Main localhost3000 restarted; browser confirms zero headings named «Личное пространство» in Settings and the existing «Настроить главную» entry on Today. Original Никита profile, theme and background preserved. Browser warnings/errors empty. Proof: docs/account-ai/settings-simplified.png. No new tests for this reversible panel removal; no data-model or behavior changes.
