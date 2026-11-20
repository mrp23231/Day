# Day beta release preparation plan

> Agentic workers: subagent-driven-development for independent import, offline and server review tasks; root owns DayProvider transactions, integration, release scripts and verification.

**Goal:** A tested beta candidate with recoverable backups, reliable failure paths and explicit launch requirements.
**Architecture:** Existing scoped DayProvider transactions; local JSON preview/import component; existing Next routes/service worker; CLI checks without secret output.
**Spec:** docs/superpowers/specs/2026-11-14-release-readiness-design.md

## Constraints
Day branding, Russian copy, monochrome UI, no data fixtures on main origin, no fabricated service availability, no external publication or live account creation.

## Review focus
- Import cancellation, malformed/oversized files and quota failure must leave current data untouched.
- Account/reset changes invalidate pending file reads and import previews.
- Guest/account onboarding and device-local photo references must not cross import boundaries.
- Late cloud/auth/network responses must not overwrite newer local state or hang onboarding indefinitely.
- Offline caching must not serve stale mutable scripts or personalized responses.

## Tasks
- [x] Read-only server/auth/SQL/release risk audit; reproduce concrete findings and fix scoped issues.
- [x] Import: failing tests for parser/preview/scope changes; local component/helpers; durable provider replacement + rollback.
- [x] Offline: reproduce stale cache bug in service-worker harness; fix caching and add regression tests.
- [x] Release: inspect dependencies, add configuration preflight/check and serial verify commands; runbook with deployment/migration/rollback/smoke requirements. CI workflow deferred until a remote repository/host is selected.
- [x] Independent review and fixes, scoped and full verification.
- [x] Isolated browser proof, restart main production preview, record tested capabilities and remaining launch blockers in docs/release-verification-2026-11-14.md.

No git operations: workspace has no repository. New low-impact UI-only copy does not need implementation-mirroring tests.
