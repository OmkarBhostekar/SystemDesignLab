# ADR-003: Versioned Local Progress Behind a Repository Boundary

- **Status:** Accepted
- **Date:** 2026-08-18
- **Decision scope:** Lesson-progress state, local persistence, and portable exports

## Context

The complete theory reader needs durable progress without introducing an account, backend, or remote synchronization. The PRD defines a monotonic lesson path from not started through theory, visualization, quiz, and mastery. M3 must implement the lesson portion now while leaving quiz attempts and simulation completion to the milestones that define those domains.

IndexedDB is browser-only, but theory routes remain statically rendered Server Components. Saved records also become user-owned data: malformed imports, future schema changes, and storage failures must not silently erase or report progress that was not saved.

## Decision

1. **Keep progress rules framework-independent.** `src/domain/progress/` owns stable lesson IDs, the ordered progress stages, pure transitions, curriculum summaries, reset scopes, export-envelope types, and the `ProgressRepository` interface. It imports no React, Next.js, DOM, or IndexedDB code.
2. **Represent not started by absence in persistence.** Domain helpers can construct a `not-started` value, but repositories return `null` for an unsaved lesson. Every saved transition is monotonic: repeating a milestone is idempotent and an ordinary save cannot regress a later stage.
3. **Keep M3's repository contract limited to lesson progress.** It supports read/list, monotonic save, atomic milestone application, export, import, and reset. Quiz attempts, weak-concept tags, scenarios, and lab attempts are added when their schemas and behavior exist; M3 does not invent placeholder records or a speculative quiz contract.
4. **Provide interchangeable memory and IndexedDB adapters.** Both run against one contract suite. IndexedDB is resolved lazily by the client adapter so importing a Server Component does not touch browser globals. The app accesses the adapter only from narrow client progress components.
5. **Use a deterministic version-2 JSON envelope.** Exports contain `format`, `schemaVersion`, and a lesson array sorted by stable lesson ID. Records intentionally omit wall-clock timestamps in M3 because no product behavior consumes them and implicit clocks would make state and tests nondeterministic.
6. **Define migration and import behavior before data ships.** Version 1 is a documented legacy map from lesson ID to stage and migrates to version 2 in memory. Unsupported versions, unknown stages, extra or missing envelope fields, malformed IDs, and duplicate lesson entries fail before any write. Import replaces the progress set in one transaction rather than merging it; repeating the same import is idempotent.
7. **Make curriculum validation and reset scope explicit.** The repository validates portable record structure. The application boundary additionally checks imported IDs against the current curriculum before mutation. Reset accepts either all progress or an explicit lesson-ID selection and never touches `localStorage` preferences.
8. **Surface failures.** Browser/API/request/transaction failures become actionable `ProgressStorageError` failures. A failed read is not interpreted as an empty repository, and a failed write is not reported as success.

## Rationale

A small domain contract keeps UI components independent of IndexedDB and leaves room for a future remote adapter. Monotonic transitions match the current learning model and prevent repeated clicks, imports, or stale UI saves from corrupting counts or undoing mastery. Timestamp-free records keep the first schema minimal and deterministic.

Replace-on-import gives export/import a clear backup-and-restore meaning. Full validation before the single replacement transaction ensures invalid or partial data cannot leave a mixture of old and imported records. A concrete version-1 migration proves the migration boundary before real users depend on it, while rejecting future versions avoids guessing at semantics.

## Alternatives considered

### Call IndexedDB directly from progress components

This is initially shorter, but it couples product behavior to a browser API, makes deterministic tests harder, and would force learning components to change for remote sync. It also increases the chance that browser-only code leaks into static routes.

### Persist timestamps and event history immediately

Recency may eventually improve continue-learning and review ordering, but M3 has no requirement that consumes it. Adding clocks and event history now would create migration and conflict semantics without product evidence.

### Merge imports with existing data

A stage-wise maximum merge could preserve local work, but it makes backup restoration surprising and cannot generalize safely once attempts and review data exist. M3 uses explicit replacement; a future merge mode must be a separate user choice with its own domain rules.

### Add quiz-attempt methods now

The planning example included quiz attempts, but the quiz schema, scoring, deduplication key, and retry semantics belong to M4. A placeholder method would either accept unvalidated data or constrain that later design, so it is deferred deliberately.

## Consequences

### Benefits

- Repositories can be tested through one deterministic contract.
- Static theory rendering remains independent of browser storage.
- Repeated milestone commands cannot duplicate records or regress progress.
- Export/import has a portable, validated, migration-ready format.
- Storage and import failures remain visible and preserve the prior data set where the platform transaction can do so.

### Costs and constraints

- Client components must handle asynchronous loading and failure states.
- IndexedDB tests require a standards-compatible fake implementation.
- Curriculum-aware import validation lives at the application boundary because repository adapters do not import the content index.
- A later non-monotonic action, quiz attempt model, or synchronization strategy requires an explicit contract extension and migration.

## Revisit conditions

Revisit this decision when:

- M4 defines quiz-attempt identity, scoring, and retry behavior;
- review features require timestamps or event history;
- learners need a distinct merge-import workflow;
- remote synchronization introduces conflicts, identities, or deletion semantics;
- the stored record shape changes and requires an IndexedDB or export migration.
