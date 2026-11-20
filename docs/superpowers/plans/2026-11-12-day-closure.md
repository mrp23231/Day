# Day closure implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Beautiful animated day closure with safe rescheduling, stars/reflection and real hold confirmation.
**Architecture:** Root owns composed full-screen flow/styles. Independent workers own primitives and pure model/schema. All task moves and review persistence happen in one validated update after confirmation; snapshots stabilize closed history.
**Tech Stack:** Next16, React19, TS, Zod, Motion, Radix, Ark RatingGroup, Vitest.
**Spec:** docs/superpowers/specs/2026-11-12-day-closure-design.md

## Global constraints
- Day branding; black/white/neutral gray; preserve previous preferences and data.
- Old v1 records must validate, rating/note can be edited after closure, transfers apply once.
- Task repetition survives occurrence transfer and later series edits.
- No re-scaffold, new photos, live cloud changes or user-data fixtures.

## Review focus
- Repeated confirmation/reopening cannot duplicate moves.
- Recurring task moved to an existing series day must be a separate task.
- Concurrent completion/deletion must not be undone by a transfer.
- Hold release/blur/unmount must cancel; keyboard and touch must work.
- Date/account/reset change must discard draft, and past-day transfer cannot target the past.

### Task1 — primitives (delegated)
Files: src/components/ui/rating-group.tsx, motion-hold-to-confirm.tsx and scoped CSS/tests; package manifests.
Interfaces: BasicRating({value:number,onValueChange:(value:number)=>void,disabled?:boolean,readOnly?:boolean,label?:string}); HoldToConfirm({onConfirm:()=>void|Promise<void>,disabled?:boolean,label?:string,confirmedLabel?:string,durationMs?:number,className?:string}). Default duration2000ms; no automatic demo surfaces in app.
- [x] Verify current official APIs and install @ark-ui/react.
- [x] Write failing meaningful keyboard/half-rating and hold cancellation/callback tests.
- [x] Implement supplied patterns in monochrome and verify focused tests.

### Task2 — persistence/model (delegated)
Files: src/lib/domain.ts; src/features/review/review-model.ts and tests; narrow TaskForm metadata preservation in editors.tsx.
Interfaces: ReviewSummary existing shape; ReviewSnapshot = ReviewSummary + completedTasks:{id,title}[]; CloseDayInput={date:string,rating:number,note:string,transfers:{taskId:string,toDate:string,newTaskId:string}[]}; closeDay(data:AppData,input:CloseDayInput,today:string,nowISO:string):AppData. Throws invalid date/rating/transfer bounds; stale deleted/completed tasks skip safely. Already closed review only edits rating/note and retains snapshot/transfers/closedAt.
- [x] Red tests for legacy review/task data and transfer behavior.
- [x] Extend optional schema fields, pure atomic closure, occurrence exclusion and editor metadata preservation.
- [x] Green focused tests including idempotency and stable historical summary.

### Task3 — composed screen (root)
Files: src/features/review/daily-review.tsx, review-flow.tsx, review-stats.tsx and review.css/tests.
- [x] Replace old form tests with failing step/draft/confirmation/reopen tests.
- [x] Implement full-screen accessible flow, real animated stats, completed list, per-task date controls, stars/reflection, hold and success state.
- [x] Apply prepared deterministic IDs at confirmation and handle validation errors without partial updates.

### Task4 — review and verification
- [x] Independent review: fix the P2 provider finding so the atomic update returns validated data; independent recheck complete.
- [x] Full serial tests: 180/180 across 29 files; lint and TypeScript clean after a narrow test-capture typing fix.
- [x] Final production build exits 0.
- [x] Final production browser pointer/keyboard/short hold/long hold/task moves/reopen at 320/390/1440 px; proofs saved and main preview restored. Physical touchscreen unavailable; pointer contracts covered by component tests.

Isolated browser interaction checks on localhost:3006 are recorded in docs/qa.md. Final production verification and screenshot evidence are complete; see docs/qa.md and docs/day-closure/.
