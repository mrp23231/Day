# Day Motion, Auth and Vercel Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans. Root integrates and verifies independent changes.

**Goal:** Refine motion, finish Google/email auth configuration, and update the existing Vercel deployment.
**Architecture:** Existing shared Motion/CSS components and persistent App Router shell; Supabase PKCE auth; existing Vercel project.
**Tech Stack:** Next 16.4.5, React 19, Motion, TypeScript, Supabase, Vercel.
**Spec:** docs/superpowers/specs/2026-11-21-motion-auth-vercel-design.md

## Global Constraints
- Preserve user data, authentication changes, RU/EN/IT and monochrome design.
- Do not expose secrets or create a replacement hosting project.
- Prefer reduced motion, transform/opacity and short transitions; persistent providers survive navigation.

## Review Focus
- Forms/timers/account scope must not reset on incidental renders.
- Reduced-motion must remove decorative movement.
- Auth denial, expired callback and unsafe redirect must leave a retry path.
- Production redirects must return to the verified public app origin.
- No publication claim before deployment and verification succeed.

### 1. Motion
- [ ] Read installed Next docs; inspect shell/shared/dialog styling.
- [ ] Implement route entry, restrained Enter and dialog/button transitions using existing dependencies.
- [ ] Verify provider state, reduced motion and relevant UI tests.

### 2. Auth
- [ ] Inspect current code and public provider settings; verify docs.
- [ ] Pin concrete auth regressions with failing tests, implement minimal fixes, rerun scoped tests.
- [ ] Inspect Supabase/Google configuration, preserve credentials, configure verified production callbacks when available.

### 3. Vercel and verification
- [ ] Connect to and identify the existing project; inspect domains and environment names without logging values.
- [ ] Run combined tests, lint/typecheck/build and review changes.
- [ ] Deploy the checked source to the existing project; verify published routes/auth initiation and document remaining live checks.
