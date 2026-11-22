# Day — motion, auth and Vercel update

User request: update the existing Vercel project, add polished motion/transitions, finish Google sign-in and registration. Existing preferences establish a professional monochrome style and fast, restrained animation. Continue implementation using those choices.

## Approach

Use existing Motion and CSS rather than add a new animation library. Route content enters once on navigation with a short opacity/vertical transform, without retaining stale route trees or remounting providers. Existing Enter wrappers get subtle, bounded reveal; buttons and dialogs get consistent short transitions. Respect prefers-reduced-motion, focus, scroll and keyboard behavior. Avoid animating height/layout for whole pages and avoid repeated decorative effects.

Keep Supabase OAuth with server PKCE callback and the current user-authored auth changes. Inspect actual provider/redirect configuration before mutation; add only the verified Vercel production origin and exact callback URLs. Google OAuth credentials remain in Supabase; provider keys are never logged or shipped to the client. Do not send registration/reset emails or sign in as a test user without a supplied test identity.

Deploy to the existing Vercel project after checks. Preserve project/environment identity and existing domains. Need connected Vercel account or an existing authenticated CLI; do not create a second project in place of the requested update. Current source uses Next 16.4.5, React 19, motion, TypeScript and @supabase/ssr. No database schema changes required.

## Alternatives and decisions

CSS-only motion is sufficient for simple visual states but does not improve the existing shared Motion components. A full outgoing/incoming page animation risks stale App Router content and form state. Choose a brief entry transition for current content with persistent providers and restrained existing components. These are implementation choices based on the established design, not a newly selected visual direction.

## Verification

Test routing/provider preservation, reduced motion, auth callback errors and redirect safety, plus existing auth/onboarding tests. Run appropriate lint/typecheck/build. Verify deployed environment and Google authorize redirect when access is available; a redirect to Google does not by itself prove completed login.
