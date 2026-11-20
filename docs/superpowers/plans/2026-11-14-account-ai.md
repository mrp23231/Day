# Account welcome and AI beta implementation plan

> For agentic workers: use subagent-driven-development for independent auth, onboarding UI and assistant work; root owns provider/schema/shell integration.

**Goal:** Deliver real account entry, animated preference onboarding and a clear Day AI beta experience.
**Architecture:** Existing DayProvider remains the source of scoped state. New primitives live in src/components/ui; auth/onboarding/assistant features use existing Supabase and text API boundaries. No new dependencies.
**Spec:** docs/superpowers/specs/2026-11-14-account-ai-design.md

## Global constraints
- Day brand, Russian copy, monochrome palette; preserve all user data and existing auth recovery.
- No fake provider/model/media abilities. Google/email require Supabase; AI requires configured backend.
- Browser QA uses an isolated origin, no fixtures on localhost:3000.

## Review focus
- A delayed cloud response must settle before account onboarding and must not overwrite new preferences.
- Account changes must discard welcome drafts and pending assistant responses.
- Repeated introduction must preserve prior completed state until explicitly saved.
- IME Enter and Shift+Enter must not send a prompt.
- Unconfigured services and auth recovery must remain usable and truthful.

## Tasks
- [x] Auth: test provider selection and OAuth/email/error/recovery; implement button-sign-in and auth form, account card.
- [x] Onboarding: test optional name, focus/pace, back navigation, persistence; implement animated questionnaire and welcome.
- [x] Assistant: test composer and request failures/account-switch; implement expanding ai-chat-input and beta conversation screen.
- [x] Integration: add backward-compatible schema fields, provider auth settling, shell/account-card wiring and first-account prompt. Test restoration gating and data isolation.
- [x] Review: independent code review; fix concrete issues.
- [x] Verify: full serial test suite, lint, production build, isolated responsive browser scenarios. Rebuild/restart main preview and save screenshot.

No git repository is present; no commits/worktrees are created.

Final evidence: 263/263 tests (41 files); after final composer polish, 25/25 assistant/composer tests; after test-type cleanup, onboarding 9/9. ESLint exits 0. Production build including TypeScript exits 0. Main localhost:3000 restarted and visually verified with original Никита profile/theme/background and no console warnings/errors. Proofs: docs/account-ai/. External auth/AI remain configuration-dependent.
