# Day beta candidate — 14 November 2026

Status: local production candidate verified; not publicly deployed. External cloud release gates remain open.

## Automated evidence

- Full Vitest: **377/377 tests**, 50 files, single worker, no file parallelism.
- Release preflight tests: **9/9**, including Next production environment precedence and secret-free output.
- ESLint: exit 0, no warnings.
- Production build: Next **16.4.5**, TypeScript passed, 15 static pages generated; API/auth routes remain server routes.
- After the deadline helper's type inference correction: typecheck exit 0; provider/deadline regression suite **25/25**; production build and ESLint repeated successfully.
- `npm audit --omit=dev`: **0 known vulnerabilities** (196 production dependencies).
- Strict configuration check: exit **1 as expected**. Missing Supabase URL, public key, server admin key and OpenAI key. No secret values printed.

## Browser evidence

Production app on an isolated `localhost:3010` origin; generated QA records only. No fixtures imported into the user's `localhost:3000` space.

- Created an original profile and task through the UI.
- Invalid JSON rejected without replacing records.
- Valid JSON showed current/incoming counts; import remained disabled before explicit confirmation.
- Confirmed import replaced records and exposed a previous-copy download.
- Reload retained the imported task.
- Downloaded the previous JSON copy; checked that it contained the original QA profile/task.
- Imported that downloaded copy and reloaded: original task restored.
- Stopped only the isolated server and reloaded: service worker displayed the offline fallback. Restarted server: normal app and records returned.
- Browser warning/error log empty in the checked QA session.
- Main production preview opened with original name Никита, dark theme and selected mountains background. No user records/preferences changed during QA.

The first browser download observation timed out; the later native UI click produced a real downloaded file, whose contents and restoration were verified. The timeout was not treated as evidence of app success.

## Review and changes

- Validated import with preview, cancellation, replacement confirmation, scoped stale-read guards and durable previous backup.
- Import/cloud replacement writes primary data only after backup/revision preparation; failed writes restore earlier metadata before committing UI state.
- Cloud restore preserves device photo references and onboarding flags; damaged local source remains available as the raw previous copy.
- Local reset saves the empty primary space before removing backup/photos.
- Account confirmations reset when identity changes; deletion request binds the explicitly confirmed account to authenticated identity. Late results cannot sign out a newly mounted account screen.
- Supabase transport/operations have deadlines; callback failures return a usable retry path.
- Food scanner invalidates/aborts old image reads and requests after photo/account/reset/unmount changes; validates result shape.
- Deterministic loading gate avoids date-dependent route hydration before local state is ready.
- Service worker v4 avoids caching auth/API/personal HTML and mutable development chunks; old Day shell caches are retired.
- Root-level error fallback and repeatable verification/configuration commands added.
- Independent review identified four storage/restore issues; regression tests and fixes added; re-review found no further actionable issue in those changed paths.

## Still required before public cloud beta

Follow [release.md](release.md). Configure real services and domain/HTTPS, apply the migration, verify Google/email/recovery/deletion, two-account RLS and revision conflicts, live AI and quota behavior on staging. Verify installation/update on actual supported devices and browsers. Define real operator/privacy/support information. Presence of configuration, local unit tests and a successful build do not satisfy these live gates.

Cloud snapshots are manual; photo blobs remain in the browser and are excluded from JSON/cloud backups. Web Push and assistant-driven task editing are not released features.
