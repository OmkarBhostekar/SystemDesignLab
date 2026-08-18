# Testing Strategy

## Purpose

The lab combines authored content, a generated curriculum graph, local persistence, quizzes, deterministic models, and interactive visualizations. Testing should protect the learning contract and the failure behavior that the product is meant to teach. It should be risk-based rather than a pursuit of an arbitrary coverage percentage.

The most valuable checks are those that catch:

- a lesson that disappears from the index or has an invalid prerequisite,
- a diagram or route that teaches a different rule from the theory,
- progress lost on reload or corrupted by import,
- quiz scoring or explanations that disagree with the answer,
- a simulation transition that violates its model,
- a client-only feature accidentally pulled into server rendering,
- an inaccessible control or a visualization that fails when animation is reduced.

## Quality principles

- Test pure rules without a browser whenever possible.
- Use contract tests so every persistence adapter behaves like the domain expects.
- Use deterministic seeds for simulations involving randomness.
- Test transitions and invariants, not snapshots of incidental animation frames.
- Prefer a few representative end-to-end journeys over many brittle UI scripts.
- Treat content validation as a build-quality gate, not a manual cleanup task.
- Keep a text explanation and accessible status model testable alongside visual output.

## Test layers

| Layer | Primary target | Examples | When to add |
| --- | --- | --- | --- |
| Content checks | Theory source and derived index | Metadata, unique IDs, links, prerequisites, reference paths | With the first lesson and every content change |
| Unit tests | Pure domain and calculation rules | Progress transitions, quiz evaluation, capacity math | With each domain feature |
| Simulation engine tests | State transitions and invariants | Queue growth, remapping, retries, leader failure | Before or alongside each simulation renderer |
| Repository contract tests | Persistence behavior | Save/read, export/import, reset, schema versioning | Before IndexedDB is used by UI |
| Component tests | Interactive boundaries | Quiz controls, progress actions, keyboard behavior | When client components appear |
| Integration tests | Feature composition | Lesson index → route, quiz → repository, simulation → explanation | For each completed learning slice |
| End-to-end tests | Critical learner paths | Read lesson → visualize → quiz → reload | Once the theory reader and progress exist |
| Accessibility/performance checks | Usability and loading | Focus order, reduced motion, lazy bundles, large-simulation rendering | For every interactive lesson family |

## Content and curriculum validation

The content pipeline should fail with a lesson path and field-specific error, not a generic parse exception. Validate at least:

1. required metadata fields and allowed difficulty/module values,
2. unique lesson IDs and slugs,
3. valid prerequisite and related-lesson IDs,
4. absence of circular prerequisite dependencies,
5. deterministic ordering and index output,
6. internal links to existing lessons, files, and anchors where supported,
7. local asset links and reference URLs in the formats the repository accepts,
8. visualization and quiz IDs against their registries when those registries exist,
9. lesson source that remains renderable without the interactive enhancements.

Include fixtures for a valid lesson, duplicate ID, missing prerequisite, cycle, broken internal link, malformed frontmatter, unknown registry ID, and an intentionally theory-only lesson. The theory-only fixture ensures the app does not require a visualization or quiz to publish useful content during the theory-first phase.

Index tests should assert both shape and behavior: the same source tree produces the same index, all expected modules are present, prerequisite edges are preserved, and a malformed lesson prevents a misleading partial index.

## Domain and progress tests

Progress rules should be pure and explicit. Cover:

- a new lesson starts as `Not Started`,
- completion events move a lesson to the correct next state,
- repeated completion events are idempotent,
- quiz pass thresholds are applied consistently,
- failed attempts record incorrect concept tags without falsely marking mastery,
- review state derives from attempts and completion without losing unrelated fields,
- reset clears intended records and leaves unrelated preferences alone,
- unknown lesson IDs are rejected or reported clearly.

Test boundary cases such as an empty curriculum, a zero-question quiz, a score exactly at the pass threshold, repeated imports, and an attempt containing duplicate concept tags. If the product later allows a learner to move backward or manually reset a state, encode that transition explicitly rather than assuming the progress graph is permanently monotonic.

## Repository contract tests

Run the same contract suite against an in-memory repository and the IndexedDB adapter. The suite should verify:

- save then read returns equivalent normalized data,
- multiple lesson records remain isolated,
- quiz attempts append or update according to the documented rule,
- export contains a schema version and all required records,
- an exported payload can be imported into an empty repository,
- invalid or unsupported import data fails before partial replacement,
- reset removes progress and attempts but does not silently change preferences,
- storage failures surface as actionable errors rather than being treated as success,
- schema migrations preserve compatible data when a version is introduced.

Use a fake IndexedDB implementation or browser-capable test environment for adapter tests. Do not let component tests mock away the repository contract so thoroughly that serialization and migration behavior are never exercised.

M4 runs the shared contract against `InMemoryProgressRepository` and `IndexedDbProgressRepository` for both lessons and immutable quiz attempts. Adapter tests use the standards-compatible `fake-indexeddb` development dependency and isolated database names to verify cross-instance persistence, the M3 database-version-2 to version-3 migration, corrupted records, lazy browser access, surfaced failures, two-store rollback, and scoped reset. Pure serialization tests cover version-1 and M3 version-2 imports into version 3 plus strict rejection of partial, duplicate, malformed, and unsupported exports. Client-boundary tests inject repositories so learner-visible pending, success, failure, retry, and reset states stay deterministic; serialization and persistence remain covered separately rather than mocked away.

## Quiz evaluation tests

Quiz scoring is independent of answer-selection UI. Test each supported question type:

- single choice with correct, incorrect, and missing answers,
- multi-choice with order independence and partial-selection rules,
- numeric estimates with the documented tolerance and unit handling,
- malformed questions that fail validation before presentation.

Every result should identify why an answer is correct or incorrect and expose concept tags for review. Tests should catch mismatches between `correctAnswer`, displayed options, score, and explanation. A question with no explanation should be rejected if the UI promises explanatory feedback.

M4 intentionally excludes architecture-choice grading. Its focused evaluator suite covers exact single choice, order-independent all-or-nothing multiple choice, inclusive numeric tolerance and exact normalized units, missing answers, the exact 80% boundary, malformed definitions and answers, zero-question rejection, explanations, deterministic output, and deduplicated incorrect tags. Component tests cover native keyboard-operable controls, pending and storage-error announcements, feedback, scoring, and weak-concept retry.

## Simulation engine tests

Simulation tests should use the model/action API, not animation timing. For every engine, cover:

- initial state and reset,
- each supported control/action,
- step determinism with a fixed seed,
- play/advance equivalence to repeated step where the model promises it,
- scenario preset loading and validation,
- failure injection and recovery paths,
- metric updates and event ordering,
- invalid or out-of-range controls,
- invariant preservation after long or repeated runs.

Useful invariants include:

- queue depth never becomes negative,
- admitted plus rejected work matches the modeled input where applicable,
- replicas do not acknowledge data before the configured replication rule allows it,
- a hash-ring key belongs to one valid owner and remapping counts are reproducible,
- retry attempts remain bounded,
- a token bucket never emits more tokens than capacity permits,
- a quorum result reflects the configured `N`, `R`, and `W`,
- a state machine has only documented transitions,
- aggregated traffic metrics remain consistent with sampled visual entities.

Use small fixed fixtures for readable assertions and property-based or randomized runs only with recorded seeds so failures can be replayed. Do not assert exact pixel positions or animation frame counts in engine tests.

## Component and integration tests

Focus component tests on behavior visible to a learner:

- lesson navigation preserves the active lesson and step,
- a theory-only lesson still renders its prose and an appropriate unavailable state,
- quiz controls work by keyboard and expose feedback after submission,
- progress actions show pending, success, and failure states,
- simulation controls update the accessible status text as well as the visual model,
- reset returns controls and explanation state to the initial scenario,
- reduced-motion mode removes or shortens animation without removing state changes,
- client-only storage is not touched during server rendering.

Integration tests should exercise the seams that are easy to get wrong:

1. content index resolves a lesson route and its previous/next/prerequisite links;
2. lesson metadata resolves a quiz and simulation registration when present;
3. a quiz pass writes progress and a failed attempt writes weak-concept data;
4. a simulation scenario can be loaded, advanced, reset, and completed without a second source of rules;
5. export/import restores a learner's state across a fresh repository instance.

Prefer accessible queries and user-level events. Avoid asserting implementation-specific class names or internal React state.

## Critical end-to-end journeys

Once the application shell exists, keep a small smoke suite for:

### Theory-only path

```text
Open roadmap → open lesson → read theory → follow prerequisite → return to lesson
```

This protects the value delivered before every visualization exists.

### Complete interactive lesson

```text
Open lesson → mark theory complete → run a scenario → answer quiz → pass → reload → verify progress
```

Use one simple simulation and one stateful simulation as representatives; add more only when their route or persistence behavior differs materially.

### Local-first recovery

```text
Complete lesson → export JSON → reset progress → import JSON → verify state and attempts
```

Include a malformed import case and confirm existing progress remains intact.

### Failure and accessibility path

```text
Inject a documented failure → observe state/explanation → enable reduced motion → repeat with keyboard only
```

The output should remain understandable without relying on color or animation.

## Accessibility verification

For each interactive lesson, verify:

- all controls and tabs are keyboard reachable,
- focus is visible and not trapped unexpectedly,
- buttons have meaningful names and current state is announced where needed,
- diagrams have text summaries or status panels,
- color is not the only indicator of success, failure, ownership, or state,
- reduced-motion preferences are honored,
- contrast and text resizing remain usable,
- error and loading states are announced and recoverable.

Automated accessibility checks are useful for baseline violations, but they do not replace keyboard walkthroughs and a review of the visual explanation against the theory.

## Performance verification

Performance checks should protect the desktop-first reading experience:

- static theory routes should not load unrelated simulation bundles,
- heavy visualizations should load lazily where practical,
- content-index generation should remain deterministic and bounded as lessons grow,
- a high-QPS scenario should aggregate or sample entities rather than render thousands of DOM nodes,
- roadmap rendering should remain responsive with the full planned topic graph,
- play/step controls should not leak timers or continue updating after unmount/reset.

Measure representative scenarios instead of setting an arbitrary global score. Record regressions when a visualization changes its rendering strategy or logical entity count.

## Fixtures and test data

Keep fixtures small, named by behavior, and independent of external services. At minimum maintain:

- a miniature curriculum with prerequisites and related lessons,
- a theory-only lesson,
- a lesson with a quiz and a simulation ID,
- valid and invalid progress exports,
- deterministic simulation scenarios for normal load, skew, and failure,
- quiz questions covering every supported type,
- an empty and a partially completed learner profile.

Do not use production learner data in tests. If examples include large numbers or realistic payloads, label them as illustrative and keep the arithmetic explicit.

## Delivery gates by implementation stage

### Content foundation

- content validation passes,
- index is deterministic,
- broken links and dependency cycles fail clearly,
- theory-only lessons render.

### Theory reader

- server rendering works without browser storage,
- navigation and references resolve,
- a representative lesson has a readable keyboard path.

### Local progress

- repository contract passes for memory and IndexedDB adapters,
- reload retains progress,
- export/import/reset are covered,
- storage errors do not silently discard learner state.

### Quiz

- evaluator tests cover supported types,
- explanations and concept tags are present,
- pass/fail state is persisted correctly,
- retrying weak concepts does not mutate unrelated progress.

### First simulations

- engine transitions are deterministic with fixed seeds,
- invariants and failure paths are covered,
- renderer exposes accessible state,
- reduced motion and reset are verified,
- a lesson remains coherent if the renderer is unavailable.

### Labs and review

- design-lab state has domain-level tests,
- reference and learner designs remain separate,
- review prioritization is deterministic for the same progress data,
- critical journeys remain green after adding new lesson families.

## Continuous integration expectations

When project scripts exist, CI should run the smallest complete set of checks for every change: formatting/linting, type checking, content validation, unit/domain tests, repository contract tests, component/integration tests, and a focused end-to-end/accessibility smoke suite. Full browser and performance suites may run on a broader cadence, but failures in content/index validation or domain tests should block merges.

The exact commands and tooling should be chosen when the Next.js project is initialized; this document intentionally does not assume a package manager or test runner that does not yet exist.
