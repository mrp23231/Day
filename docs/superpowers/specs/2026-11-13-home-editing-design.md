# Day — edit the home screen in place

The user requests colorful, smoother celebration balloons and iPhone-like card editing directly on Today. Existing monochrome app and local photo storage remain; color is explicitly restored only for balloons. Prior authorization favors implementation without another design approval loop.

Long hold (550ms, movement tolerance) on a card's noninteractive area enters editing and lifts that card for dragging. All visible cards show a restrained wiggle, selected card stands out, and content interactions are suspended while editing. Dropping reorders visible cards, preserving hidden-card slots. Mouse, delayed Touch and keyboard sensors support the two-column grid and one-column phone. A visible `Настроить главную` button is an alternative entry point. Normal scrolling and task controls stay usable outside editing.

Each editing card offers a drag handle, `Изменить`, adjacent-position buttons for keyboard/assistive use, and hide (at least one card remains). A bottom toolbar has `Готово`, photo background/navigation access and restore-hidden access. Escape cancels an active drag first, exits editing when no modal is open. Changes save after drop/actions through existing preferences. Upload/remove uses the current scoped IndexedDB pipeline. Photo dialog offers choose/replace/remove and shared original/monochrome tone. New loaded photos fade/settle in; reduced motion removes wiggle/reveal, retaining controls.

Approach: use documented @dnd-kit/core + sortable grid rather than HTML drag (poor touch support) or a custom gesture engine (scroll/collision/accessibility complexity). DragOverlay stays compact so a tall task card does not cover the screen. No new data schemas/backend work. Object URL cache must retain unchanged images and revoke removed/orphaned/unmounted resources.

Balloons: investigate installed engine, replace expensive rendering if evidence supports. Bounded colorful sprites, transform/opacity only, finite lifecycle, no overlapping launch, cleanup/unmount and reduced motion. Do not change task completion semantics or user records.
