# Personal space implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Add usable focus sessions, local photo personalization, daily reviews and Ding notifications to Day.
**Architecture:** Independent feature modules consume the existing validated Day context. Root owns schema, local photo repository/provider and integration; delegated workers own focus, review and notifications files. Use local timestamps for focus and IndexedDB blobs for photos; keep serializable review notes in AppData.
**Tech Stack:** Next 16, React 19, TypeScript, Tailwind 4, Zod, IndexedDB, Radix Dialog, Ding React, Vitest.
**Spec:** docs/superpowers/specs/2026-11-08-personal-space-design.md

## Global constraints
- Brand Day; black/white/neutral gray.
- Preserve v1 local and cloud data; default added fields.
- Never upload personal photos, automatically complete tasks or seed the user's records.
- Existing code target and continuous implementation are authorized; no extra approval gate. No Git repository is present, so no worktree or commits.

## Review focus
- Background/reload timer drift: timestamp model tests.
- Account switch while async photo save/load is pending: scope/generation tests and safe hook lifecycle.
- Invalid/oversized/undecodable photos: validation and previous image preservation tests.
- Completed/deleted task during focus: session eligibility guard and explicit completion only.
- Old imported data and future review dates: schema defaults and UI tests.

### Task 1: Schema and photos (root)
Files: src/lib/domain.ts, src/lib/personalization.ts, src/features/appearance/personal-photos.tsx, src/features/settings/personalization.tsx, appearance CSS/tests.
Interfaces: preferences.personalPhotos = record of target (space/navigation/plan/habits/water/food/next) to asset UUID; reviews = {date,note,mood,updatedAt}[]; PersonalPhotosProvider and usePersonalPhotos expose ready, urlFor(target), savePhoto(target,file), removePhoto(target).
- [x] Add failing schema migration and photo validation/repository tests; verify red.
- [x] Implement scoped IndexedDB blobs and raster processing; verify green.
- [x] Add local upload/remove settings and photo surfaces, preserving readable content.

### Task 2: Focus (delegated)
Files: src/features/focus/* (only).
Interfaces: FocusProvider wraps AppShell; FocusLauncher({task?, occurrenceDate?, className?}); FocusDock mounted inside provider. Uses existing useDay user/ready/data/toggleTask/notify/openModal.
- [x] Write timestamp/pause/restore eligibility tests and verify red.
- [x] Implement model/provider/dialog/dock, per-scope local storage and explicit completion; verify focused tests.

### Task 3: Daily review (delegated)
Files: src/features/review/* (only).
Interface: DailyReview({date:string}) renders review card and dialog using data.reviews and update.
- [x] Write real summary and save/reopen/future guard tests; verify red.
- [x] Implement review form and compact card; verify focused tests.

### Task 4: Ding notifications (delegated)
Files: src/components/ui/ding-toast.tsx, src/lib/notifications.ts, notification CSS/tests, package manifests; limited provider notify replacement.
Interface: notify(message:string, options?:NotifyOptions):void; NotifyOptions kind/description/action(label,onClick). Follow resolved Day theme.
- [x] Verify primary package docs/types and install requested dependency.
- [x] Add meaningful host/action tests, verify red then implement centralized real notifications.

### Task 5: Integration and verification (root)
Files: app layout, AppShell, Today, settings, global style imports, README/QA docs.
- [x] Integrate providers/entry points and optional layout controls based on user answer.
- [x] Independent code review of data/scope/timer risks; fix findings.
- [x] Run full suite serially, lint, typecheck, production build.
- [x] Browser verify focus, photo upload/remove/persist, review save/reopen, toast/theme and mobile layout; save screenshots.

## Execution ledger
- User explicitly chose photo + order + visibility; implemented all three. Default card order is plan, next, habits, water, food, review; DOM order matches configured order.
- No repository/worktree/commits. Existing version1 schema defaults maintain compatibility; photo blobs remain outside AppData.
- Root added resetVersion to invalidate pending upload/focus/review views on local reset. Native photo input, local rasterization, per-scope IDB and async epoch guards.
- Focus supports early explicit completion, validated by an observed red/green regression test.
- Independent review identified cloud RPC omission of top-level reviews. Fixed using encodeCloudState/decodeCloudState with existing preferences JSON envelope; 3 regression tests, two actual red failures then green. Reviewer rechecked fix with no remaining material findings. Live Supabase execution requires credentials and was not claimed.
- Initial Nov12 full suite had one Today interaction timeout while production build/TypeScript shared host resources. Final verification runs serially after those processes exit; no timeout values were raised to hide the failure.

- Final Nov12 verification:143/143 tests across25 files, clean lint/types, production build exit0. Production QA320/390/1440px screenshots in docs/personal-space, main records preserved; QA cleaned up.
