# Technical Architecture

## Purpose

This document describes the technical foundation for the System Design Visual Learning Lab. It complements the product requirements; it does not expand the V1 product into a hosted service or a general-purpose simulation platform.

The architecture is deliberately incremental:

1. Make the complete theory source useful and navigable.
2. Add local progress and quizzes behind small domain interfaces.
3. Add simulations only when real lessons require them.
4. Reuse proven primitives across lessons, tools, and design labs.

The design optimizes for conceptual correctness, direct content review, deterministic behavior, and a local-first experience.

## Architectural principles

### Theory is the source of truth

Human-authored indexed lessons live in `theory/` as Markdown-compatible MDX, as decided in ADR-001. Module overviews may remain Markdown. The application may parse frontmatter and build a content index, but it must not copy lesson prose into TypeScript page objects. A theory file should remain understandable in a repository browser or editor without the application.

Metadata identifies a lesson and its relationships. A representative shape is:

```ts
type LessonMetadata = {
  id: string;
  slug: string;
  title: string;
  description: string;
  module: string;
  difficulty: "core" | "advanced" | "deep-dive";
  estimatedMinutes: number;
  prerequisites: string[];
  tags: string[];
  visualizationId?: string;
  quizId?: string;
  relatedLessons: string[];
};
```

The exact schema can grow with the curriculum. Required fields and relationship rules belong in content validation, not in individual route components.

### Server-render static learning surfaces; keep interaction on the client

Next.js Server Components are the default for static theory content, lesson metadata, curriculum navigation, glossary data, route metadata, and build-time index work. Client Components are reserved for stateful behavior: quizzes, simulation controls and renderers, progress interactions, charts, settings, and the architecture canvas.

IndexedDB and `localStorage` are browser APIs. They must not be imported by Server Components or used as an implicit global from route loaders. The server side passes serializable lesson and simulation configuration to a client boundary; the client invokes domain services and repository adapters there.

### Local-first is a domain decision, not a UI shortcut

The learning domain must not depend on a remote API in the first version. Persistence is accessed through an interface so UI code does not know whether data is stored in IndexedDB, memory, or a future remote service:

```ts
interface ProgressRepository {
  getLessonProgress(lessonId: string): Promise<LessonProgress | null>;
  saveLessonProgress(progress: LessonProgress): Promise<void>;
  recordQuizAttempt(attempt: QuizAttempt): Promise<void>;
  exportProgress(): Promise<ProgressExport>;
  importProgress(data: ProgressExport): Promise<void>;
  resetProgress(): Promise<void>;
}
```

The initial adapter is an IndexedDB-backed repository. An in-memory adapter is useful for tests. A future remote-sync adapter should satisfy the same domain contract rather than forcing a rewrite of learning components.

### Simulations are models first and renderers second

A simulation engine should be a deterministic, testable state transition function wherever practical:

```text
initial state + action + seed
        ↓
next state + events + metrics
        ↓
client renderer and explanation panel
```

The engine owns rules, transitions, failure injection, and metrics. React Flow, SVG, Canvas, and charts own presentation only. Logical traffic must be aggregated or sampled; high-QPS scenarios must not create one DOM element per request.

### Abstractions follow evidence

The first simulation should be implemented as a real lesson. After two or three simulations reveal genuinely shared controls or event semantics, extract small primitives such as play/pause/step/reset, scenario presets, event timelines, and metric panels. Do not create a generic simulation DSL, large global store, or broad plugin system in anticipation of every future visualization.

## System shape

```mermaid
flowchart LR
  A["theory/ Markdown-compatible MDX"] --> B["Content loader and validator"]
  B --> C["Build-time lesson index"]
  C --> D["Server-rendered lesson routes"]
  D --> E["Client lesson enhancements"]
  E --> F["Quiz evaluator"]
  E --> G["Simulation registry and renderer"]
  E --> H["Progress repository"]
  H --> I["IndexedDB progress"]
  H --> J["Future remote adapter"]
```

The index is a derived navigation artifact. It may contain parsed metadata, source paths, prerequisite edges, and references to registered quiz/simulation IDs; it does not become a second source of lesson prose.

## Responsibilities and boundaries

The intended responsibilities are:

| Area | Owns | Must not own |
| --- | --- | --- |
| `theory/` | Lesson prose, diagrams, references, quiz seeds, lesson metadata | Browser state, React imports, persistence calls |
| Content loader/index | Parsing, frontmatter validation, slugs, prerequisite graph, internal-link checks | Rendering, quiz scoring, IndexedDB details |
| `src/app/` | Routes, server/client composition, metadata, navigation | Simulation rules or direct storage mechanics |
| `src/domain/` | Lesson state, progress rules, quiz scoring, serializable contracts | React, browser APIs, vendor-specific persistence |
| `src/repositories/` | IndexedDB/in-memory adapters and import/export serialization | UI state, rendering, curriculum prose |
| `src/simulations/` | Pure engines, events, metrics, scenario definitions | DOM layout, route concerns, direct persistence |
| `src/components/` | Accessible presentation and interaction wiring | Hidden business rules duplicated from domain engines |
| `tests/` | Fixtures, contracts, unit/component/integration/e2e tests | Production behavior |

The directories may be introduced gradually. The boundary is more important than the initial number of files.

## Content pipeline

1. A contributor creates or updates a lesson under the dependency-ordered `theory/` tree.
2. Frontmatter and links are validated during the content build/check step.
3. The loader parses metadata and source content into a deterministic index.
4. Server-rendered routes use the index to resolve module and lesson navigation.
5. The lesson renderer displays the authored theory directly and passes only serializable configuration to client enhancements.
6. Optional `visualizationId` and `quizId` values resolve through registries; absent registrations do not make the theory lesson unusable.

This last rule is important during the theory-first period: a lesson can ship with theory and quiz seeds before its interactive implementation exists. The page should describe the future visualization or show a clearly labelled unavailable state rather than silently dropping the theory.

### Content/index invariants

- Lesson IDs and route slugs are unique.
- Prerequisite and related-lesson IDs resolve to known lessons.
- The dependency graph has no cycles unless a deliberate future model explicitly supports them.
- Internal links resolve to known files or routes; external references are kept as authored links.
- Index generation is deterministic for the same source tree.
- A metadata or registry error reports the lesson and field that caused it.

## Server/client boundary

| Server by default | Client only when interaction requires it | Boundary contract |
| --- | --- | --- |
| Theory MDX rendering | Quiz answers, scoring feedback, retry flow | Server sends lesson/question data; client returns domain events to the repository |
| Module and lesson navigation | Play/pause/step/reset and simulation controls | Server sends a `visualizationId` and serializable scenario; client loads the registered engine/renderer |
| Prerequisite graph and glossary index | Progress marks, review actions, export/import/reset | Repository calls stay behind a client-safe adapter |
| Route metadata, breadcrumbs, static references | Charts, architecture canvas, drag/connect interactions | Renderers receive model state; rules remain in domain/simulation code |
| Build-time content validation | Theme and lightweight preferences | Preferences do not become lesson-domain state |

Avoid marking a whole lesson page or layout as `"use client"` just because one tab contains a simulation. Keep the interactive portion behind a narrow client boundary and dynamically import expensive visualizations when that improves initial load.

## Local-first data model

### Progress

Progress follows the product states:

```text
Not Started → Theory Complete → Visualization Complete → Quiz Passed → Mastered
```

The domain may also record quiz attempts, incorrect concept tags, completed scenarios, review dates, and design-lab attempts. State transitions should be explicit and idempotent. A reset is an intentional operation, not an accidental consequence of a failed read or a missing browser store.

### Storage

- IndexedDB stores structured progress, attempts, review data, and design-lab state when those features exist.
- `localStorage` is reserved for small preferences such as theme or reduced-motion preference; it is not the canonical progress store.
- Store names and serialized records are versioned so migrations can be introduced before schema changes reach users.
- Exported JSON includes a schema version and enough data to restore progress without a server account.
- Import validates the envelope before writing. Invalid or unsupported exports must not partially replace existing progress.

No authentication, hosted database, analytics pipeline, or remote synchronization is required for the first version. These can be added as adapters and explicit product decisions later.

## Quiz and simulation separation

Quizzes and simulations are related lesson experiences but different domains.

### Quizzes

Question data is structured and addressable by lesson and concept tags. Evaluation is a pure function that returns correctness, score information, and an explanation reference or explanation text. Answer selection state belongs in the client; attempts and weak-concept signals go through the progress repository.

```ts
type QuizQuestion = {
  id: string;
  lessonId: string;
  type: "single-choice" | "multi-choice" | "numeric" | "architecture";
  prompt: string;
  options?: string[];
  correctAnswer: unknown;
  explanation: string;
  conceptTags: string[];
};
```

During theory authoring, `Quiz Seeds` may remain in the lesson until a quiz implementation exists. The seed is not a substitute for answer data and evaluation rules.

### Simulations

Each simulation has a stable ID, an engine, render configuration, scenario presets, and an explanation model. The lesson references the ID rather than importing a component from prose. A registry resolves IDs to dynamically loaded client experiences:

```text
lesson metadata: visualizationId = "consistent-hash-ring"
        ↓
visualization registry
        ↓
engine + renderer + scenario presets
```

Engines should expose enough state for a text explanation and accessible status panel. Reduced motion must not change the conceptual result of a simulation.

## Rendering strategy by visualization family

Use the simplest renderer that communicates the behavior:

- React Flow for architecture graphs, service relationships, queues, and design-lab canvases.
- SVG for hash rings, token buckets, timelines, quorum diagrams, and compact algorithmic state.
- Canvas only when many moving entities make DOM rendering impractical.
- Charts for QPS, latency percentiles, queue depth, cache hit rate, shard distribution, and error-budget burn.

All families consume the same model/event contract only after repeated implementations prove that sharing is useful.

## Routing and loading

The target route shape follows the PRD:

```text
/                 dashboard
/roadmap          dependency graph
/learn/[module]/[lesson]
/labs/[lab]
/interview
/review
/search
/settings
```

Optional standalone tools should reuse lesson visualizations rather than fork them. Static lesson metadata and content can be generated at build time. Heavy client simulation bundles should load lazily so reading a lesson does not pay for every visualization.

## Staged implementation

### Stage 0 — Content foundation (current)

Deliver:

- dependency-ordered `theory/` structure,
- authoring conventions and lesson metadata,
- deterministic content index,
- internal-link/reference validation,
- theory that remains useful without an app.

Exit when a new lesson can be added without changing navigation code and the core curriculum can be browsed as source.

### Stage 1 — Theory reader

Deliver:

- Next.js shell and server-rendered lesson routes,
- curriculum navigation, breadcrumbs, metadata, references, and previous/next links,
- MDX rendering and static diagrams,
- clear unavailable states for visualizations or quizzes not implemented yet.

Exit when theory can be read comfortably on a fresh session without client-side application state.

### Stage 2 — Local progress

Deliver:

- progress domain types and transitions,
- `ProgressRepository` contract,
- in-memory and IndexedDB adapters,
- mark theory complete, continue-learning display, export/import/reset,
- persistence tests.

Exit when a learner can close and reopen the browser and retain progress without a server.

### Stage 3 — Quiz system

Deliver:

- structured question schema and registry,
- pure evaluation for initial question types,
- answer explanations, scoring, concept tags, retries, and attempt persistence,
- an end-to-end theory → quiz → progress path for one or two lessons.

Exit when quiz behavior is testable without React and a learner can identify weak concepts from an attempt.

### Stage 4 — First simulation experiences

Start with one simple and one more stateful visualization from the PRD (for example, horizontal scaling and consistent hashing). Keep engines separate from renderers. Extract shared controls only after the implementations expose true duplication.

Exit when simulation state transitions are deterministic and tested, controls are keyboard accessible, reduced motion is supported, and a lesson remains understandable with the visual disabled.

### Stage 5 — Reuse and design labs

Add the simulation shell, event timeline, metric panel, scenario presets, knowledge-map connections, review mode, and design-lab workspace in response to validated curriculum needs. Reuse registered lessons and domains; avoid a second set of rules for standalone tools or labs.

## Explicitly deferred

The following are not part of the foundation and should not shape early interfaces:

- mandatory accounts or a server database,
- remote synchronization,
- AI tutoring or grading,
- a production-accurate Raft or distributed-system implementation,
- a generic simulation language,
- all planned visualizations at once,
- vendor-specific infrastructure as the primary domain model.

If one of these becomes necessary, document the scope and trade-off in an ADR before broad implementation.

## Architecture change triggers

Create or update an ADR when a decision:

- changes the source-of-truth or content format,
- introduces a persistence or synchronization contract,
- affects multiple visualization families,
- changes Server/Client boundaries,
- adds a dependency that is difficult to replace,
- requires migration of saved learner data.

Small component choices and lesson-specific presentation details can remain in code review and do not need an ADR.
