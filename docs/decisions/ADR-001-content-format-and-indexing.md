# ADR-001: Markdown-Compatible MDX Sources with a Build-Time Content Index

- **Status:** Accepted
- **Date:** 2026-08-18
- **Decision scope:** Theory lesson authoring and curriculum metadata

## Context

The product needs a complete, reviewable theory curriculum before all visualizations and quiz screens exist. Lessons must remain useful as files in a repository while also supporting interactive visualizations, quizzes, search, prerequisite navigation, glossary generation, and future design-lab links.

The PRD and `CODEX.md` establish the following constraints:

- human-authored content lives in `theory/`;
- the curriculum map provides stable planning IDs that lesson metadata and progress records should reuse;
- lesson metadata is data-driven and includes stable IDs, routing fields, prerequisites, tags, objectives, visualization/quiz references, and related lessons;
- the application prefers a build-time content index and should not duplicate prose in TypeScript objects;
- interactive components may enhance theory but must not replace essential explanations;
- static curriculum pages should remain compatible with Next.js Server Components.

## Decision

1. **Use MDX as the lesson source format.** Every indexed lesson uses `.mdx` and is Markdown-first. Plain Markdown syntax is the default; MDX components are opt-in enhancements with a readable Markdown fallback.
2. **Keep educational prose in the source file.** Do not move the theory body, interview explanation, or quiz seeds into page components or a parallel data object. The canonical body headings represent the PRD's `theorySections` and `interviewTakeaways` concepts.
3. **Require a small, typed YAML frontmatter contract.** Required metadata covers identity, route, module, order, difficulty, duration, prerequisites, tags, and objectives. When a lesson is listed in `docs/curriculum-map.md`, its frontmatter `id` reuses that canonical planning ID (for example, `04-10-consistent-hashing`). Visualization and quiz IDs are optional until their registries exist. Relationships use stable lesson IDs, not display titles or component paths.
4. **Generate a normalized lesson index at build/dev-start time.** The indexer scans `theory/**/*.mdx`, parses and validates frontmatter, resolves source paths and relationships, derives heading metadata, and exposes records to navigation, search, roadmap, glossary, and lesson routes. The generated artifact is not hand-edited and does not duplicate lesson prose.
5. **Keep route links derived from metadata.** Source prose uses validated relative links to lesson files for repository readability. The loader maps those links and IDs to canonical `/learn/<module>/<slug>` routes in the application.
6. **Fail fast on structural content errors.** Duplicate IDs, invalid metadata, unresolved local links, missing prerequisites, cycles, and unregistered referenced components are build errors once the relevant registry exists. Reference freshness and context-specific section gaps are warnings until the content tooling is mature.

## Rationale

MDX preserves the direct-editing and review experience of Markdown while allowing a lesson to embed a future simulation or an interactive explanation without inventing a second content language. The fallback rule protects the PRD's content/application separation and keeps lessons understandable in a repository browser.

A build-time index gives the app deterministic navigation and early feedback for bad curriculum relationships. It also keeps the client bundle focused on normalized metadata and the selected lesson rather than scanning files at runtime. Stable IDs make prerequisites, related-topic links, progress records, and future exports resilient to file moves or route changes.

Deriving the body section inventory instead of duplicating prose in frontmatter avoids two sources of truth. A lesson author writes the explanation once; the index can still expose a summary, headings, tags, and registry references for product surfaces.

## Alternatives considered

### Plain Markdown only

Plain `.md` would maximize portability and reduce the rendering toolchain. It is a viable fallback for module overviews, but it makes progressive enhancement with lesson-local interactive components awkward and would force an additional embedding convention later. The project already targets MDX-capable Next.js content and the PRD explicitly permits MDX, so Markdown-only is not selected for indexed lessons.

### MDX with runtime filesystem scanning

Runtime scanning makes local development look simple, but it couples route rendering to filesystem access, delays validation, and is a poor fit for static metadata, search, and Server Components. Build-time indexing gives deterministic failures and a smaller runtime surface.

### Hand-maintained TypeScript lesson objects

This duplicates prose or metadata, creates drift between files and navigation, and makes adding a lesson require editing core code. It conflicts with the PRD's content extensibility requirement and is rejected.

### Fully component-driven lessons

Encoding each section as React components could make interactions convenient, but it would make lessons harder to review outside the app and encourage educational content to depend on UI implementation. Components remain optional enhancements, not the source format.

## Consequences

### Benefits

- Authors get one Markdown-compatible file per lesson with a stable, reviewable structure.
- The app can build routes, curriculum navigation, search, prerequisites, and glossary data without duplicating lesson prose.
- Structural mistakes fail close to authoring time instead of appearing as broken navigation later.
- Interactive content can be introduced incrementally as visualizations become available.
- Progress and future exports can refer to stable lesson IDs rather than file paths.

### Costs and constraints

- The project needs an MDX parser and a frontmatter/indexing step before the full theory reader is complete.
- Authors must maintain valid IDs, relationship metadata, and relative source links.
- MDX files are not rendered as rich lessons by every repository browser; therefore the Markdown fallback and direct-file readability rule are mandatory.
- A build must distinguish missing registries during early theory authoring from genuinely invalid visualization/quiz references.
- Renaming a published slug requires an alias or redirect; changing an ID is a data migration and should be avoided.

## Implementation notes

- Scan only `theory/**/*.mdx` for lesson records. Module `README.md` files and notes can remain plain Markdown unless they intentionally become lessons.
- Validate the schema and relationship graph before generating the index. Keep a deterministic ordering by `module` and frontmatter `order`.
- Normalize each record to include its source path, canonical route, body heading inventory, and resolved prerequisite/related IDs.
- Load the selected MDX body at the lesson route; do not put all lesson bodies in a single generated client bundle.
- Keep visualization and quiz registries separate. `visualizationId` and `quizId` are stable registry keys, never imports or component paths.
- Use Server Components for static metadata and lesson rendering; load interactive MDX components only where the lesson actually needs them.
- Add external URL checks as a separate network-enabled validation command. Local link, schema, duplicate, and dependency-cycle checks should run on every content build.

## Revisit conditions

Reconsider this decision only if one of these becomes true:

- the chosen MDX pipeline cannot preserve accessible Markdown fallbacks for interactive lessons;
- content must be authored by non-technical users in a format that cannot safely expose MDX;
- a runtime content source replaces repository-authored theory;
- a measurable build-time performance problem requires a different index strategy.
