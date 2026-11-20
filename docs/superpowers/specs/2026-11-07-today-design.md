# Day — Today, Phase 1

Implement the attached reminder-app brief's explicit Phase 1 in the existing Next.js app. Prior direct user preferences take precedence: brand Day; monochrome; Russian; preserve local/account data; continue implementation without design approval questions.

A calm personal planner, with system typography, restrained rounded white surfaces on a neutral canvas, a personal greeting, real date, and circular **task** progress. The main column contains a week selector, existing Enter-to-add composer, an important-task filter, all active tasks, and a collapsed completed list. A separate backlog shows unfinished prior one-off tasks only when viewing the real current day. Completing backlog uses its original occurrence date. Repeating tasks never accumulate missed occurrences. No records are invented or truncated away.

The support column contains the next timed active task (or useful empty state), hydration quick actions, gentle habit summary, and a compact nutrition entry point. Selected historical/future days are labeled explicitly and have a return-to-today action. The next-task preview uses the browser clock; actual notifications are not claimed.

Mobile navigation: Сегодня, Календарь, prominent Добавить, Привычки, Профиль. Add opens the existing accessible task editor. Desktop keeps its collapsible sidebar. Nutrition, water and progress remain reachable through Today, settings, search and desktop navigation. Respect safe areas, keyboard focus, reduced motion, light and dark themes. No schema changes or new dependencies.

Approach: improve the existing product in place. A replacement scaffold would discard working flows; implementing the complete future reminder infrastructure in this phase would exceed the attachment's explicit starting scope. Retain existing shared controls and validated persistence.

Verification: meaningful occurrence/selection tests first, interaction tests for overdue completion and Today filtering; browser checks on isolated origin for populated/empty state, checkbox persistence, quick add, mobile navigation, dark theme and responsive widths. Run full tests, lint, typecheck and production build. Live backend and push tests remain outside Phase 1.
