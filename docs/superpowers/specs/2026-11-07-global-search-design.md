# Day — global search and quick commands

The user asks to continue improving the working app. Preserve the black/white design and all existing records. They have opted out of approval questions; implement within the current codebase.

Add a search trigger in the shared header, accessible on every screen and by Command/Ctrl+K. A compact monochrome Radix dialog searches tasks, habits and food records across dates. Empty query shows four creation commands and existing sections. Matching ignores case, repeated whitespace and е/ё differences, supports words in any order, and ranks exact/prefix title matches first. Search stays on the device and uses only the current provider's data. No stored search history or network calls.

Selecting a record navigates to its existing section, selects its date and opens the existing editor. Recurring tasks use the selected date if scheduled there, otherwise their start date. Food entries keep their own dates; the most recent equivalent meals appear first. Creation commands open existing task/food/water/habit forms on the selected date. All eight sections remain reachable from the empty palette.

Keyboard: focus input on open, Up/Down navigate results, Enter selects, Escape closes; preserve IME composition. Cmd/Ctrl+K toggles the palette, with no repeat/Alt/Shift interception and no interference with an already-open editor. Use a native Radix trigger for focus return. Account changes recreate the search component so previous results/query are not retained.

Use typed local selectors and existing Radix/Lucide primitives, no dependencies, routes or storage changes. Header search becomes an icon on narrow screens. The dialog fits 320px and the viewport height, with a scrollable results list and clear no-results state.
