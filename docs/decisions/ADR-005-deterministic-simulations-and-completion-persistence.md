# ADR-005: Deterministic simulations and scenario-completion persistence

- Status: Accepted
- Date: 2026-08-18

## Context

M5 introduces the first real curriculum visualizations: a comparatively simple horizontal-scaling model and a stateful consistent-hashing model. They need shared playback and explanation affordances without creating a speculative simulation language. Completing a meaningful scenario must also survive reload, export/import, and scoped reset while leaving transient animation state out of learner data.

## Decision

Simulation rules are lesson-specific pure TypeScript engines. Given validated serializable state and an action, an engine deterministically returns the next state, events, and metrics. Engines do not use React, browser APIs, time, ambient randomness, or persistence. Horizontal scaling uses aggregate QPS and queue calculations; consistent hashing uses a fixed documented 32-bit FNV-1a hash and deterministic keys/tokens. High-volume scenarios render sampled or aggregated entities.

Lessons reference stable visualization IDs through a validated registry. Static lesson routes resolve a serializable definition and render one narrow client boundary. The two initial engines prove only presentation-level shared primitives: Play/Pause/Step/Reset, speed, scenario selection, metric panels, bounded event timelines, text explanations, completion status, and reduced-motion behavior. There is no generic simulation DSL or global client store.

Transient engine state is not persisted. After an engine-specific learning condition is satisfied, the learner explicitly saves this immutable record:

```ts
type SimulationCompletion = {
  completionId: string;
  visualizationId: string;
  lessonId: string;
  scenarioId: string;
};
```

`completionId` is deterministically derived as `visualizationId + "--" + scenarioId`. Saving the same normalized record is idempotent; conflicting reuse fails validation. Saving a new completion and advancing its lesson monotonically to `visualization-complete` happen in one repository operation and, in IndexedDB, one read/write transaction.

Portable progress moves from schema version 3 to version 4 by adding required `simulationCompletions`. Versions 1–3 migrate in memory with an empty completion set. Version-4 imports validate every lesson, attempt, and completion before atomically replacing all stores; completion records reconcile their lessons to at least `visualization-complete`. IndexedDB moves from version 3 to version 4 with a separate `simulation-completions` store keyed by `completionId`, preserving the M4 lesson and quiz-attempt stores. Selected reset clears completions for those lessons; all reset clears all three learning stores and never preferences.

## Consequences

- Simulation outcomes and failure behavior are testable without a browser.
- Renderers cannot silently invent domain rules or hidden completion conditions.
- Scenario completion is portable and queryable without saving large or unstable frame state.
- The progress repository and migration surface grow by one explicit record family and database store.
- A lesson can have multiple scenario completions while its summary stage stays compact and monotonic.
- React Flow and chart libraries remain deferred until a real visualization needs their interaction model.

## Alternatives considered

### Persist the entire engine state

Rejected because timers, queues, ring rollout internals, and renderer evolution would create a large migration burden. M5 needs durable learning evidence, not frame restoration.

### Store only `visualization-complete` on the lesson

Rejected because it loses which authored scenario was completed and cannot support later scenario-aware review without guessing.

### Build a generic simulation framework first

Rejected because two engines do not provide enough evidence for a shared event/state language. Only visible shell primitives are shared.

### Persist completion automatically on the first action

Rejected because opening or casually changing a control is not evidence that the learner observed the intended behavior. Each engine defines a deterministic condition, followed by an explicit save action.

## Revisit conditions

Revisit when resumable labs require versioned engine snapshots, three or more engines prove a stable shared transition contract, remote synchronization introduces identity conflicts, or scenario history needs completion timestamps supplied by an explicit clock.
