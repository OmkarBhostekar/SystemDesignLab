# System Design Visual Learning Lab

The System Design Visual Learning Lab is a theory-first, local-first learning application for backend and software-engineering system-design interviews. It teaches the reasoning behind an architecture through a repeatable loop:

> **Theory → Visualization → Quiz → Interview Lens → Applied Design**

The project is intentionally being built in increments. The theory curriculum is useful on its own; the application shell, local progress, quizzes, simulations, and design labs are added as the curriculum gives each capability a real use case.

## Current status

The project is at **M0 — repository setup and theory curriculum authoring**. The repository contains the product and technical foundation, the complete dependency scaffold, and 29 completed theory lessons across Modules 00–03. The application and test harness will be introduced in later stages.

Read the [product requirements](docs/PRD.md) for the learning goals, the [curriculum map](docs/curriculum-map.md) for stable lesson IDs and dependencies, the [content guidelines](docs/content-guidelines.md) for authoring conventions, the [architecture plan](docs/architecture.md) for technical boundaries, and the [testing strategy](docs/testing-strategy.md) for risk-based verification.

## Product principles

- Explain the problem before introducing an architectural component.
- Teach each concept as **naive design → limitation or failure → improvement → new trade-off**.
- Prefer vendor-independent concepts; use products as concrete examples only after the underlying idea is clear.
- Keep human-authored theory readable outside the application.
- Keep the core experience usable without sign-in, a server database, or a network connection after the content is available locally.
- Let real lessons and simulations drive reusable abstractions; do not build a speculative framework first.
- Treat failures, capacity, consistency, and trade-offs as first-class learning material.

## Repository map

```text
.
├── CODEX.md                  # Operating guidance and project progress tracker
├── README.md                 # Project orientation
├── docs/
│   ├── PRD.md                # Product requirements and curriculum scope
│   ├── curriculum-map.md     # Canonical modules, lesson IDs, and dependencies
│   ├── content-guidelines.md # MDX schema, lesson template, and reference rules
│   ├── architecture.md       # Technical boundaries and implementation stages
│   ├── testing-strategy.md   # Verification plan
│   └── decisions/            # Durable architecture decisions
├── theory/                   # Human-authored curriculum source
├── src/                      # Next.js application and domain code (when introduced)
└── tests/                    # Automated tests and fixtures (when introduced)
```

The exact source layout can evolve, but responsibilities should remain clear: theory is the source of educational prose, `src/` is the application, and `tests/` verifies content, domain behavior, persistence, and interactive lessons.

## Planned learning experience

Every substantial lesson should help a learner answer:

1. What problem does this solve?
2. What happens as traffic, data, or the number of nodes grows?
3. What happens when a dependency is slow, unavailable, partitioned, or duplicated?
4. What do we gain and pay for each design choice?
5. When would this be a sensible interview decision?

Indexed lessons use Markdown-compatible MDX with registered interactive experiences. A visualization should make behavior observable—such as queue growth, replica lag, remapping, tail latency, or retry storms—not merely animate a finished diagram. Quizzes emphasize reasoning and include answer explanations. Design labs gradually remove guidance and ask the learner to derive an architecture from requirements.

## Implementation sequence

The intended sequence is:

1. Author and validate the curriculum source and metadata.
2. Build a server-rendered theory reader and curriculum navigation.
3. Add a local progress model behind a repository interface.
4. Add quiz data, evaluation, explanations, and attempts.
5. Add simulation engines separately from client-side renderers, starting with a few representative lessons.
6. Add review mode, knowledge-map connections, and design-lab workspaces as the curriculum demonstrates the need.

This sequence keeps theory valuable before all interactive features exist and keeps future remote sync or richer tooling from shaping the initial product unnecessarily.

## Local-first expectations

The first product version should work without authentication. Structured progress belongs in IndexedDB through a `ProgressRepository` abstraction; lightweight preferences may use `localStorage`. Export and import use a versioned JSON format. A future remote repository may be added without changing lesson, quiz, or simulation components.

## Development guidance

Before a substantial change, read `CODEX.md` and the relevant PRD section. Implement the smallest coherent slice, keep content and application concerns separate, and verify behavior at the appropriate test layer. Record an ADR for a decision that constrains several future features or would be expensive to reverse.
