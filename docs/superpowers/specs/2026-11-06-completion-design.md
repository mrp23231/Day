# Day — completion and daily bento

Integrate the three user-supplied component references into the working Day app. Keep Russian copy, existing records and the minimal neutral/olive visual system. The user requested implementation and previously opted out of design approval questions.

Use an accessible animated native checkbox for tasks and habit completion, with controlled and uncontrolled support, visible keyboard focus, disabled states and reduced motion. Adapt the supplied neon frame to Day colors, retaining a finite check/glow/particle effect. History dates remain visible beside habit checkboxes.

Add the supplied balloons-js wrapper with a correctly typed imperative handle and client-only loading. Celebrate only a user action completing the last scheduled task today, once per account/day during the session. Undo, past/future completion, hydration and date changes must not launch it. Reduced motion gets the same status message without balloons.

Replace the Today metric row with the supplied 6-column bento composition: daily progress, tasks with seven days of actual completion history, habits and water. Derive all numbers from existing records. Empty data remains zero; no invented trends, awards, ratings or images. Cards link to the corresponding working sections. Responsive layout and both themes are required.

Approach: integrate reusable components under src/components/ui (the configured shadcn alias), with pure completion/history selectors in src/lib. A disconnected demo would not improve the actual app. A new global state library is unnecessary because DayProvider owns persistence already.
