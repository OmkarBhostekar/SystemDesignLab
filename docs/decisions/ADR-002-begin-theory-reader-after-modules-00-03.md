# ADR-002: Begin the Theory Reader After Modules 00–03

- **Status:** Accepted
- **Date:** 2026-08-18
- **Decision scope:** Application milestone timing

## Context

The theory-first strategy originally recommended completing the full curriculum before prioritizing the application. Modules 00–03 now provide 29 complete lessons spanning interview method, foundations, networking, and traffic/service architecture. Together they exercise the real content schema: cross-module prerequisites, related lessons, long-form prose, tables, code blocks, diagrams, references, and varied metadata.

Waiting for Modules 04–13 would postpone validation of the content contract and reading experience until substantially more prose depended on them. Starting the entire interactive product now would create the opposite risk: speculative simulations, quizzes, persistence, and lab abstractions without enough evidence.

## Decision

Begin a narrowly scoped application milestone now. Build only a production-quality, server-first theory reader and deterministic content pipeline for the 29 completed lessons in Modules 00–03.

The milestone includes validated content indexing, `/learn` routes, MDX rendering, curriculum navigation, metadata, references, authored diagrams, accessible responsive reading, and explicit theory-only states. It excludes simulations, structured quizzes, progress persistence, knowledge maps, design labs, interview mode, authentication, remote storage, analytics, and AI features.

## Rationale

Four contiguous modules are enough to prove the important boundaries without inventing demo content. They include both within-module and cross-module relationships and enough rendering variety to expose schema, link, navigation, readability, and accessibility problems early. A data-driven reader also supports continued theory authoring: adding a lesson should update validation and navigation without editing application components.

This timing preserves the theory-first strategy because theory remains the source of truth and application scope is limited to reading it. It also follows the incremental-app principle by validating one real learning surface before progress, quizzes, or simulations shape the architecture.

## Alternatives considered

### Wait for the entire curriculum

This would maximize the content fixture set but allow schema and rendering assumptions to spread across many more lessons before automated validation and route behavior are proven.

### Build the broader MVP from the PRD

The broader MVP includes interactive lessons and design labs. That work is deliberately deferred because the current milestone should establish the reading and indexing contract before adding stateful domains.

### Build validation without a reader

Validation alone would reduce content risk, but it would not test whether the authored structure produces a comfortable, accessible learning experience or whether source links map correctly to application routes.

## Consequences

- The project adopts and maintains a current stable Next.js, React, strict TypeScript, Tailwind CSS, ESLint, and test toolchain earlier than the original full-curriculum sequence suggested.
- Modules 00–03 become production integration fixtures; no duplicate demo lessons are introduced.
- Application architecture must remain data-driven and server-first so continued theory authoring does not require navigation changes.
- Missing visualization and structured quiz registrations are valid and must render as a clear theory-only state.
- Later milestones remain responsible for progress, quizzes, simulations, knowledge maps, labs, and interview mode.

## Revisit conditions

Revisit only if the theory reader begins constraining authoring in a way that conflicts with ADR-001, or if later lesson families reveal a schema or rendering requirement that the current fixtures could not represent.
