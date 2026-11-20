# Accounts, avatar and three languages

> Execution: independent agent tasks with shared typed interfaces; root integrates and verifies. User directly requested implementation in the existing Day app.

**Goal:** Configure actual Supabase-backed Google/email access where authorized service access is available; add photo/GIF avatar and complete Russian/English/Italian UI selection.

**Architecture:** Existing Supabase SSR/PKCE auth and account data scopes remain. Locale is a validated preference (`language`, default `ru`), supplied by a client I18nProvider with explicit message lookup and Intl formatting. Existing IndexedDB photo storage gains an avatar target; GIF bytes remain animated, raster photos are prepared locally. No DOM text replacement, URL restructuring or translation of user content.

**Constraints:** Monochrome Day design; original user records/theme untouched in QA. No secret values in chat/logs. No external paid project creation without cost confirmation. Google provider requires the user's Google OAuth client. No simulated auth success. Read installed Next guides before edits.

## Tasks
- [ ] Root: typed i18n dictionaries/context, schema defaults and integration; translate shell, shared components, provider, generic UI, route errors/metadata and backend errors/AI language.
- [ ] Planning agent: translate today/planner/focus/review, dynamic dates/counts and accessibility labels; English/Italian regression.
- [ ] Profile agent: avatar image/GIF validation and scoped storage/UI; translate settings/appearance; language selection and meaningful regressions.
- [ ] Feature agent: translate auth/onboarding/assistant/nutrition/habits/water/progress/search/editors and sign-in components; preserve business values and SDK state guards.
- [ ] Root: discover connected Supabase project, inspect schema before migrations, configure app URL/public key and auth settings within available authorization; document exact remaining external requirements.
- [ ] Review source message coverage and locale switching on all routes, safe GIF/photo behavior, auth failure paths, data preservation and account scope changes.
- [ ] Serial full tests, lint, typecheck/build, isolated browser checks; restart main production preview and record live-auth status accurately.

## Review focus
1. Missing/invalid old language preference defaults to Russian without losing records.
2. No translated internal enum/route/storage keys; user titles, categories and notes remain exact.
3. Language change updates dates, dialogs, accessible labels, toasts and AI response language, not just navigation.
4. GIF content validated and animation preserved; limits and reduced-motion behavior; upload abort/scope changes never leak avatars between accounts.
5. Auth provider secrets never appear client-side, pending or rejected requests settle, OAuth redirect/recovery paths remain valid.
