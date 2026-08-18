# Visualization Guidelines

These conventions govern interactive curriculum visualizations. They exist to keep behavior, explanations, and accessibility consistent without forcing lesson-specific engines into a generic simulation language.

## Model before renderer

Every visualization starts with a deterministic, serializable model. Lesson-specific engines accept validated state plus an action and return the next state, events, and derived metrics. Engines must not read browser APIs, current time, or ambient randomness. If randomness is educationally necessary, the seed is explicit and test fixtures fix it.

React owns playback timers and presentation only. Reset reconstructs a scenario preset exactly. Large workloads remain logical aggregates: render a sample or summary rather than one DOM element for each request or key.

## Shared simulation shell

Use the shared shell when the behavior needs common controls:

- Play and Pause for a meaningful sequence;
- Step for deterministic inspection and reduced-motion operation;
- Reset to the current scenario's authored initial state;
- speed selection for playback only, never for engine outcomes;
- named scenario presets that explain the behavior they expose;
- a metric panel, bounded event timeline, and text explanation;
- an explicit completion checkpoint after the model's learning condition is met.

Failure controls name the failed resource or protocol state. A failure result must remain visible in text and metrics instead of appearing only as motion or color.

## SVG conventions

Use responsive SVG for compact algorithmic state such as hash rings, token buckets, timelines, and quorum diagrams.

- Set a `viewBox`; let CSS control rendered width.
- Give each graphic `role="img"`, a `<title>`, and a `<desc>`.
- Keep labels readable at narrow widths and provide a table or text summary of the same state.
- Use stable model IDs as React keys; do not use array positions for changing ownership.
- Use shapes, labels, or patterns as well as color for health, ownership, and failure.
- Sample dense logical entities and state the sample size.
- Keep model calculations out of coordinate and path helpers.

## React Flow conventions

Introduce React Flow only for a real service graph, queue topology, or editable architecture where its node/edge interaction provides value. Until then, do not add the dependency.

When introduced:

- domain state remains independent of React Flow node objects;
- adapters translate stable domain node and edge IDs into renderer data;
- layout is deterministic for tests and reset;
- custom nodes use the shared service/storage/queue visual semantics;
- pan and zoom have keyboard-accessible alternatives and never hide the text explanation;
- animation is optional presentation, not the source of state truth.

## Chart conventions

Use charts for time-series or comparative metrics such as QPS, p95/p99, queue depth, ownership distribution, or cache hit rate.

- Axes, units, time windows, and modeled versus measured values must be explicit.
- Preserve exact current values in the metric panel or an accessible table.
- Do not imply statistical precision the engine does not model.
- Cap or sample history so autoplay cannot grow memory without bound.
- Avoid chart dependencies until a real lesson needs interactions beyond a small SVG path or table.

## Accessibility and motion

All controls use native buttons, selects, checkboxes, and ranges with visible labels and focus. Announce user-triggered actions and storage errors, but do not make every autoplay tick a live-region update. Diagrams require text summaries, and color is never the only carrier of ownership, health, or failure.

At `prefers-reduced-motion: reduce`, autoplay is disabled and CSS transitions are removed. Step, Reset, scenario changes, failure injection, metrics, and explanations must produce the same conceptual result.

## Performance and lifecycle

- Load registered client visualizations only on lessons that reference them.
- Clear playback timers on Pause, Reset, scenario change, reduced-motion changes, and unmount.
- Keep event timelines and chart histories bounded.
- Do not persist live frames, timers, queues, or renderer coordinates.
- Persist only an idempotent authored-scenario completion and its monotonic lesson milestone.

## Verification checklist

For each interactive lesson, test deterministic engine transitions and invariants separately from renderer behavior. Then verify native keyboard operation, Play/Pause/Step/Reset, scenario loading, failure and recovery, reduced motion, timer cleanup, text alternatives, storage success/failure, refresh persistence, narrow-width overflow, and a theory-only lesson without a registry entry.
