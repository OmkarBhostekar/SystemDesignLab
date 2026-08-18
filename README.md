# System Design Visual Learning Lab

The System Design Visual Learning Lab is a theory-first, local-first learning application for backend and software-engineering system-design interviews. It teaches the reasoning behind an architecture through a repeatable loop:

> **Theory → Visualization → Quiz → Interview Lens → Applied Design**

> [!IMPORTANT]
> This is an in-progress project. The complete theory curriculum, reader, and local lesson-progress workflow are usable today, while structured quizzes, interactive simulations, search, and other learning tools are still under development. APIs, content organization, and UI details may change between releases.

The project is intentionally being built in increments. The theory curriculum is useful on its own; the application shell, local progress, quizzes, simulations, and design-lab workspaces are added as the curriculum gives each capability a real use case.

## Current status

The project has completed **M3 — the local progress model and `ProgressRepository` abstraction**. The repository contains 135 completed theory lessons across all 14 modules, including 20 Markdown-first design labs, a validated deterministic lesson index, a server-rendered Next.js reader at `/learn`, and local progress backed by IndexedDB.

The current reader includes routes for all modules and lessons, curriculum navigation, breadcrumbs, metadata, previous/next links, GFM tables, highlighted code, Mermaid diagrams, references, responsive light/dark reading styles, and explicit theory-only states. Learners can mark theory complete, see a curriculum summary, continue with the first incomplete lesson, export/import versioned JSON, and reset local progress. Structured quizzes, simulations, search, knowledge maps, the interactive design-lab workspace, and interview mode remain deliberately deferred.

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
├── scripts/                  # Content validation commands
├── src/                      # Next.js application and deterministic content pipeline
└── tests/                    # Content, route, and reading-shell tests
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

The first product version works without authentication. Structured progress belongs in IndexedDB through a `ProgressRepository` abstraction; lightweight preferences may use `localStorage`. Exports use a deterministic version-2 JSON format, imports validate fully and atomically replace the saved progress set, and compatible version-1 exports migrate on import. Invalid or unsupported data leaves existing progress unchanged. A future remote repository may be added without coupling lesson, quiz, or simulation components to browser storage.

## Run the project locally

### Prerequisites

- [Git](https://git-scm.com/) for cloning the repository.
- [Node.js](https://nodejs.org/) **20.9.0 or newer**.
- npm, which is included with Node.js. The committed `package-lock.json` is the canonical dependency lockfile.

No database, container runtime, external service, account, API key, or environment-variable setup is required for the current theory reader.

### Clone and install

```bash
git clone <repository-url>
cd <cloned-directory>
npm ci
```

Replace `<repository-url>` with the HTTPS or SSH URL of your fork or the published repository. Use `npm ci` for a reproducible install from the lockfile; use `npm install` only when intentionally changing dependencies.

### Start the development server

```bash
npm run dev
```

Open [http://localhost:3000/learn](http://localhost:3000/learn) in a browser. Next.js will reload the application as local source or curriculum files change.

### Run the verification suite

Validate lesson metadata, prerequisites, relationships, dependency cycles, paths, and local documentation links:

```bash
npm run validate:content
```

Run the automated tests, strict TypeScript checks, and ESLint:

```bash
npm test
npm run typecheck
npm run lint
```

Create and serve an optimized production build:

```bash
npm run build
npm start
```

The production server also uses [http://localhost:3000](http://localhost:3000) by default.

## Environment variables and local data

The current application does not require a `.env` file and does not persist accounts or server-side learner data. Files matching `.env*` are ignored by Git, except for a future sanitized `.env.example` template.

If a future contribution introduces configuration:

- document every required variable in a committed `.env.example` using placeholder values;
- keep real credentials in an ignored local environment file;
- never place secrets, access tokens, personal data, or machine-specific absolute paths in source, fixtures, lesson content, screenshots, or logs.

## Contributing

Contributions are welcome while the project evolves. A suggested workflow is:

```bash
git checkout -b <short-feature-name>
# make and verify the change
git commit
```

Before opening a pull request:

- read [`CODEX.md`](CODEX.md) and the relevant section of the [`PRD`](docs/PRD.md);
- follow the [`content guidelines`](docs/content-guidelines.md) for curriculum changes;
- preserve the stable lesson IDs and dependencies in the [`curriculum map`](docs/curriculum-map.md);
- keep theory prose in `theory/` and application code in `src/`;
- run `npm run validate:content`, `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`;
- explain the problem, scope, verification, and any intentionally deferred work in the pull request.

For larger architectural changes, open a discussion or issue first and add an ADR when the decision constrains several future features or would be expensive to reverse.

## Project maturity and roadmap

The theory and local-progress milestones are complete, but the broader learning product is not. The next planned milestone is the structured quiz system: validated question data, pure evaluation, explanations, attempts, and one complete theory-to-quiz learning slice. Later milestones cover simulation engines and renderers, review tools, knowledge-map connections, and interactive design-lab workspaces. See [`CODEX.md`](CODEX.md) for the active tracker and [`docs/architecture.md`](docs/architecture.md) for the staged implementation plan.

Bug reports and focused improvements are useful now; consumers should not yet rely on undocumented internal APIs or a stable release cadence.

## License

An open-source license has not yet been added. Until a `LICENSE` file is committed, copyright law reserves reuse and redistribution rights even if the repository is publicly visible. Choose and add an appropriate license before announcing the project as generally reusable open-source software.
