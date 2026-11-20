# Day — first beta release preparation

User requests ongoing improvements and preparation for release. Continue autonomously using existing Next16/React19/TypeScript/Tailwind/Radix/Motion architecture, monochrome Day identity, user data and existing workflows. No public deployment is requested. No git repository or production credentials are present. Target a tested beta release candidate; explicitly separate local technical readiness from hosted/live-service readiness.

## Scope
1. Data safety: make the existing JSON export useful by adding validated import with a record-count preview, explicit replacement confirmation, durable rollback copy, scope/reset guards and no premature mutations. Import must not change the account, mark a guest account as onboarded, or use another device's photo IDs. Keep this device's current personal photos. Missing photos are explained. Backup files stay local.
2. Offline/runtime reliability: fix the observed service-worker development-chunk cache issue; cache only appropriate public immutable resources, never account/API/auth/HTML responses. Offline fallback and failed-asset handling must be deterministic. Review error boundaries and auth/network failure paths for concrete issues.
3. Release checks: inspect dependency vulnerabilities and production/server configuration, fix reproducible code problems, add a secret-free environment readiness check and one reproducible release verification command/CI workflow. No broad unreviewed dependency updates or fake connected-service states.
4. Verification: scoped regression tests, independent review, complete serial suite/lint/production build, isolated browser backup/restore/error/responsive checks, then rebuild/restart main preview with original data. Prepare release runbook and actual blocker list.

## Boundaries
- Preserve manual cloud snapshot semantics; full automatic sync/push/calendar integrations remain later features.
- Never run test imports or destructive operations on the user's localhost3000 space.
- Service configuration may be inspected only as presence/absence; do not print secrets or invent credentials.
- Do not fabricate legal policies, an operator identity, support contact, or successful OAuth/email/AI integration tests.
- No release claim based solely on build success: report external service and deployment work separately.

## Approach
Improve existing data/network paths and add a recoverable import, rather than expanding the product with multiple unrelated new systems. This gives the first beta a safer everyday experience and concrete release evidence. The user has delegated implementation and previously opted out of design-question loops.
