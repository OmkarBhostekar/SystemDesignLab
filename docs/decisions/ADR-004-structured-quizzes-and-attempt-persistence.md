# ADR-004: Deterministic Structured Quizzes and Immutable Attempts

- **Status:** Accepted
- **Date:** 2026-08-18
- **Decision scope:** Quiz definitions, scoring, retries, progress transitions, and local persistence

## Context

M4 turns selected Markdown quiz seeds into executable retrieval practice without moving theory prose into React or coupling lesson UI to IndexedDB. The rules must be testable without a browser, malformed authored data must fail before presentation, and quiz attempts must extend ADR-003's local-first repository and atomic backup behavior.

## Decision

1. **Keep quizzes in a typed registry separate from theory prose.** Lessons reference stable quiz IDs in frontmatter. Registry construction validates every definition, and content validation checks that lesson references resolve and quiz lesson IDs exist.
2. **Support three question types in M4:** single choice, multiple choice, and numeric estimation. Architecture-canvas and free-text/AI grading remain deferred.
3. **Use deterministic all-or-nothing scoring.** Every question is worth one point. Single choice requires the exact option. Multiple choice uses order-independent exact-set equality with no partial credit. Numeric estimation uses an inclusive authored absolute tolerance and a trimmed, case-insensitive exact unit. A quiz passes when `earned / possible × 100` is at least the authored threshold; the shipped quizzes use the PRD's exact 80% threshold.
4. **Require explanatory, concept-addressable questions.** Stable question and lesson IDs, non-empty prompts and explanations, validated answers/options, and unique concept tags are mandatory. Missing answers score zero. Evaluation returns per-question correctness and explanation plus deterministically sorted incorrect concept tags.
5. **Make attempts immutable and caller-identified.** The client creates one stable `attemptId` per logical submission. Saving the same normalized ID/payload is idempotent. Reusing an ID with different data is rejected. A retry creates a fresh ID, even when its answers match an earlier attempt. Attempts have no implicit timestamps.
6. **Persist learner answers, never hidden answer keys.** An attempt stores its IDs, normalized submitted answers, points, score percent, pass result, and deduplicated incorrect concept tags. Correct options, expected numeric values, and explanations remain authored quiz data.
7. **Advance progress atomically on pass.** Saving a passed attempt and advancing its lesson to `quiz-passed` happen in the same repository operation and IndexedDB transaction. The monotonic transition cannot regress `mastered`. Failed attempts are retained but do not advance lesson progress.
8. **Version both persistence formats.** IndexedDB version 3 adds a `quiz-attempts` store keyed by `attemptId` while preserving the M3 `lesson-progress` store. Export schema version 3 adds `quizAttempts`. Version-1 and M3 version-2 exports migrate in memory with an empty attempt list. Imports validate completely, then atomically replace both stores; unsupported future versions are rejected.
9. **Reset uses one explicit scope across learning progress.** An all reset clears lesson records and quiz attempts. A lesson-scoped reset clears records and attempts for the selected lesson IDs. Preferences in `localStorage` are never changed.

## Rationale

Exact scoring is easy to explain, replay, and test, and it avoids inventing partial-credit weights before real lessons demonstrate a need. Explicit units prevent a numerically similar value from hiding a conversion mistake. Immutable attempts preserve retry history while making repeated commands and imports safe. A separate object store keeps attempt history independent from compact monotonic lesson state and lets one transaction protect the pass transition.

## Consequences

### Benefits

- Quiz evaluation is framework-independent and deterministic.
- Authored mistakes fail during validation rather than during learner interaction.
- UI components receive serializable data and depend only on `ProgressRepository`.
- Failed attempts can drive concept-level review without a separate weak-concept table.
- M3 backups and databases migrate without losing compatible lesson progress.

### Costs and constraints

- Multiple-choice questions cannot award partial credit in M4.
- Numeric alternatives must currently use the exact authored unit after case/whitespace normalization.
- Attempt history has no recency ordering until a later review feature introduces an injected clock and a migration.
- Changing a published question or quiz ID is a content/data migration and should be avoided.

## Alternatives considered

### Store only the latest result per quiz

This is smaller but erases retries and weak-concept history. Immutable attempts retain useful evidence with simple idempotency semantics.

### Derive attempt identity from answers

A content hash would collapse deliberate retries with identical answers and could conflict when authored scoring changes. A caller-generated ID makes one logical submission explicit.

### Partial credit for multiple choice

Several formulas are plausible and can reward selecting extra guesses. Exact-set scoring is the smallest rule that is consistent across lessons; partial credit can be added only with a documented product need.

### Put attempts inside each lesson record

This would mix monotonic summary state with append-like history and make atomic updates, indexing, and reset behavior harder to reason about. Separate records better match the two access patterns.

## Revisit conditions

Revisit when review scheduling needs attempt timestamps, authored questions need weighted or partial scoring, accepted numeric unit conversions become a real content requirement, remote synchronization introduces identity conflicts, or a new question family has deterministic grading rules.
