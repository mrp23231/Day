# Day — account welcome and AI beta

Build the requested profile account choice (Google/email), an animated first-account welcome, and a polished beta assistant using the supplied sign-in split and expanding input references. Continue in the existing Next/React/TypeScript/Tailwind/shadcn structure. User has delegated implementation decisions and previously opted out of design approval loops.

## Decisions
- Keep the established monochrome Day visual language. Adapt reference motion, not global demo CSS or fictitious provider/model options. Both AI attachments are identical.
- Google OAuth and email registration/login use the existing Supabase PKCE callback. No credentials exist locally: show honest configuration states, never simulate authentication.
- First authenticated account onboarding runs after account scope restoration has settled; guest introduction never counts as completed account onboarding. Three optional preference steps: chosen name, planning/habits/balance, gentle/structured/flexible rhythm, then personal welcome. No demographic, contact, health or location questions. Can resume after dismissal; repeat introduction remains available in settings. Preferences are scoped to the current account and survive reload. Existing records must not be overwritten by a late cloud response.
- Day AI is visibly Beta. Current capability: advice and plan suggestions through the existing authenticated text API; task creation and photo/voice input are upcoming, not working-looking fake actions. Use an expanding, auto-growing composer, clear busy/error/retry behavior and optional daily context. Avoid fake model menus and microphone recording with no transcription.
- Reduced-motion, keyboard focus, IME composition, 320px layout, cancellation and account-switch isolation are required.

## Alternatives
Rebuilding authentication or the design system adds unnecessary risk. Copying full demo code would expose unsupported providers/models/media features. The chosen approach adapts the two relevant interactions into real existing service contracts without new dependencies.

## Validation
Component tests for auth provider/error/recovery, onboarding validation/persistence/back-navigation, composer keyboard/disabled behavior, assistant request failures/cancellation/account switches; provider hydration gating tests. Full tests, lint, Next production build, browser QA on an isolated origin and production visual proof. External signup/OAuth/AI cannot be live-tested without service configuration.
