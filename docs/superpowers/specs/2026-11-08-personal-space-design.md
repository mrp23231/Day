# Day: focus, personal space and daily review

Extend the existing Day app without replacing its architecture or records. Keep the neutral black/white design, existing theme animation, accessible controls and mobile layouts.

## Focus
One existing task occurrence at a time. A focus dialog offers duration, a live countdown until a scheduled task, explicit start now/start after countdown, pause/resume, end session and explicit task completion. Persist device-local session timestamps per guest/account; calculate remaining time from timestamps, including after backgrounding/reload. Timer completion never silently completes a task. A compact dock keeps the active session reachable across routes. Empty task list links to the existing editor. Removing a task or switching account invalidates the session safely.

## Personal space
Upload actual local JPEG/PNG/WebP/AVIF photos (max 20 MB input), decode and resize to at most 2000px, save compressed raster blobs in IndexedDB per guest/account, not AppData/cloud JSON. Individual targets: app background, navigation/sidebar and Today information cards. Maintain legibility with monochrome treatment and overlays. Photo replace/remove, loading/error feedback and defaults must work. No remote upload. Existing four presets remain. Old records default to no personal photos.

Optional user clarification is pending for Today card visibility/reordering; implement photos independently and only add ordering/hiding after explicit answer or stated conservative assumption.

## Daily review
An accessible dialog from Today shows actual task, habit, water and food totals for the selected non-future day. User can save a mood and a note of up to 2000 characters, revisit and edit it. Reviews default to [] in v1 AppData and participate in existing export/cloud snapshot. No automatic task mutation or rollover.

## Notifications
Install the requested @yusufceng1z/ding-react package. One shared src/components/ui/ding-toast.tsx host follows resolved Day theme and uses top-center position. Preserve notify(message) calls, extend with optional kind/description/action; use real success/error feedback, safe action callbacks and no demo controls. These are in-app notifications; background push is outside this scope.

## Verification
Behavioral tests for timestamp timer, pause/reload/scope, local photo validation/storage races, review schema/backwards compatibility and saved note, real toast actions/theme. Full serial tests, lint, typecheck and production build, then desktop/mobile browser evidence on an isolated origin. Do not seed records on the user's localhost:3000.
