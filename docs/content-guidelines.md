# Theory Content Guidelines

This document defines how lessons are authored, indexed, linked, and reviewed for the System Design Visual Learning Lab. It complements the curriculum and product requirements in [`docs/PRD.md`](PRD.md), the learner-facing composition rules in [`lesson-page-guidelines.md`](lesson-page-guidelines.md), and the operating rules in [`CODEX.md`](../CODEX.md).

## Source and format

- Human-authored lesson source lives under `theory/`.
- Every indexed lesson uses the `.mdx` extension. MDX is used as a Markdown-compatible superset: ordinary prose, lists, code blocks, tables, and Mermaid/ASCII diagrams remain the default.
- MDX components are optional progressive enhancements. A lesson must still explain its concept, behavior, and trade-offs in readable Markdown when the component is unavailable.
- Module overviews or author notes may use `.md` and are not indexed lesson records; indexed lessons must use `.mdx` with `type: lesson` frontmatter.
- Do not duplicate lesson prose in TypeScript objects. The build-time content index contains metadata and source references only; the lesson file remains the source of truth for prose.

The format and indexing decision is recorded in [`ADR-001`](decisions/ADR-001-content-format-and-indexing.md).

## Directory and filename conventions

Use the dependency-oriented module directories from the project guide:

```text
theory/
  00-interview-method/
  01-foundations/
  02-networking/
  03-traffic-and-services/
  04-databases/
  05-caching/
  06-messaging/
  07-distributed-coordination/
  08-reliability/
  09-observability/
  10-security/
  11-building-blocks/
  12-architecture-archetypes/
  13-design-labs/
```

Use a short, lowercase, kebab-case filename such as `consistent-hashing.mdx`. A lesson may live in a subdirectory when it has substantial supporting material; keep one primary lesson file per concept. Numeric filename prefixes are optional because navigation order comes from frontmatter, not from string sorting.

The `module` value in frontmatter is the unnumbered canonical module ID (`databases`, not `04-databases`). The indexer validates that the file path and module ID agree.

## Frontmatter schema

Every lesson starts with exactly one YAML frontmatter block. The metadata below is the contract consumed by the curriculum index, roadmap, search, and lesson routes.

```yaml
---
type: lesson
id: 04-10-consistent-hashing
slug: consistent-hashing
title: Consistent Hashing
description: Distribute keys across changing nodes while minimizing remapping.
module: databases
order: 10
difficulty: core
estimatedMinutes: 25
prerequisites:
  - 01-02-horizontal-vs-vertical-scaling
  - 04-09-partitioning-and-sharding
tags:
  - partitioning
  - caching
  - distributed-systems
objectives:
  - Explain why hash(key) modulo N remaps many keys when N changes.
  - Describe ownership on a hash ring and the purpose of virtual nodes.
  - Choose when consistent hashing is useful and identify its limitations.
visualizationId: consistent-hash-ring
quizId: consistent-hashing
relatedLessons:
  - 04-09-partitioning-and-sharding
  - 05-08-hot-keys
---
```

### Required fields

| Field | Type | Rules |
| --- | --- | --- |
| `type` | literal `lesson` | Distinguishes an indexed lesson from a module README or supporting note. |
| `id` | string | Globally unique, stable, lowercase kebab-case. Use the canonical ID from `docs/curriculum-map.md` when one exists (for example, `04-10-consistent-hashing`). References in prerequisites and links use this ID. Do not change it after publication. |
| `slug` | string | Lowercase kebab-case route segment. Unique within `module`; changing it requires a redirect/alias plan. |
| `title` | string | Learner-facing title; use title case only where natural. |
| `description` | string | One-sentence learner-facing summary; keep it short enough for cards and search results. |
| `module` | enum | One of the canonical module IDs listed above. |
| `order` | positive integer | Stable lesson position within the module. Leave gaps when useful for future insertions. |
| `difficulty` | `core`, `advanced`, or `deep-dive` | Matches the three depth levels in the PRD. |
| `estimatedMinutes` | positive integer | Approximate focused study time, including the theory and intended activity. |
| `prerequisites` | list of lesson IDs | Use `[]` for a first lesson. Every ID must resolve to an indexed lesson; do not include the lesson's own ID. |
| `tags` | list of strings | Lowercase kebab-case concept terms. Do not duplicate tags. |
| `objectives` | list of strings | Prefer 2–6 observable outcomes that describe reasoning or decisions, not vague exposure. |

### Optional fields

| Field | Type | Rules |
| --- | --- | --- |
| `visualizationId` | string or `null` | Registry ID for an interactive visualization. Omit or use `null` until one exists; never put component paths here. |
| `quizId` | string or `null` | Registry ID for structured quiz data. `Quiz Seeds` in the lesson remain required before a quiz exists. |
| `relatedLessons` | list of lesson IDs | Useful consequences, alternatives, or applications that are not prerequisites. Every ID must resolve. Use `[]` when none are known. |
| `aliases` | list of strings | Previously published slugs, only when a route migration is required. Each alias must be unique. |

`theorySections` and `interviewTakeaways` from the PRD are represented by the canonical body headings below rather than duplicated in YAML. The body is the source of truth for explanations; the indexer may derive a heading inventory and summary later. Do not copy a paragraph into frontmatter just to make a card render.

### Canonical module IDs

| Directory | `module` |
| --- | --- |
| `00-interview-method` | `interview-method` |
| `01-foundations` | `foundations` |
| `02-networking` | `networking` |
| `03-traffic-and-services` | `traffic-and-services` |
| `04-databases` | `databases` |
| `05-caching` | `caching` |
| `06-messaging` | `messaging` |
| `07-distributed-coordination` | `distributed-coordination` |
| `08-reliability` | `reliability` |
| `09-observability` | `observability` |
| `10-security` | `security` |
| `11-building-blocks` | `building-blocks` |
| `12-architecture-archetypes` | `architecture-archetypes` |
| `13-design-labs` | `design-labs` |

## Lesson template

Use this structure for every substantial lesson. Keep the headings recognizable so the reader, indexer, and future review tooling can find the same concepts across modules. Omit a context-specific section only when it genuinely does not apply, and explain the omission briefly in the nearest relevant section.

```md
---
# frontmatter from the schema above
---

# Topic Name

> One-sentence thesis: what the learner should remember.

## Why This Exists

What problem or pressure causes this concept to exist? Start with the naive design where useful.

## Mental Model

Give the simplest useful model before introducing implementation vocabulary.

## How It Works

Explain the mechanism, sequence, and important guarantees. Use a small diagram or timeline when it clarifies behavior.

## Example

Work through a concrete backend or system-design scenario.

## Visualization We Eventually Want

Describe the behavior an interactive visualization should expose. Include meaningful controls, metrics, and failure/scenario changes. This is an authoring-only specification and insertion marker, not learner-facing prose and not a request to implement the visualization in the lesson.

## Scaling Behavior

What changes with more traffic, data, tenants, regions, or nodes?

## Failure Modes

What can fail, become a bottleneck, or produce surprising behavior? Explain detection or mitigation where relevant.

## Trade-offs

State what the design improves and what it costs in latency, throughput, consistency, availability, complexity, operations, or money.

## Alternatives

Name credible alternatives and the requirement that would make each one preferable.

## When to Use

Give interview-relevant signals and assumptions that justify introducing this concept.

## When Not to Use

Describe cases where the added complexity or semantics are not justified.

## Common Misconceptions

Correct likely overgeneralizations or technology-name shortcuts.

## Interview Lens

### 30-Second Explanation

Give a concise interview-ready explanation.

### When to Introduce It

Name the requirement, bottleneck, or failure that should trigger this concept.

### Common Follow-Ups

- What changes at a larger scale?
- What happens if a dependency fails?

### Common Candidate Mistakes

Name mistakes and the reasoning that avoids them.

## Summary

Close with the few decisions or invariants worth retaining.

## Quiz Seeds

Add 5–10 question ideas covering recall, trade-offs, failure behavior, architecture choices, and numbers where relevant. These are seeds until a structured quiz is registered.

## Related Topics

- [Prerequisite or consequence](relative/path/to/lesson.mdx)

## References

### Documentation / Articles

- [Title](https://example.com/canonical-source) — why this source is useful.

### Papers

- [Title](https://example.com/paper) — the result or mechanism it grounds.

### Videos

- [Title](https://www.youtube.com/watch?v=example) — author/channel and what it explains well.
```

The core body should normally contain **motivation, mental model, mechanics, example, trade-offs, use/non-use guidance, interview lens, quiz seeds, related topics, and references**. Scaling, failure, alternatives, misconceptions, summary, and visualization details are expected whenever the concept has those dimensions; do not add filler headings to meet a checklist.

The renderer removes `Visualization We Eventually Want` from learner-facing prose. When `visualizationId` is registered, the interactive experience replaces that section at the same teaching position. Without a registered visualization, the surrounding theory remains continuous; roadmap specifications must never appear as a substitute learner experience. See [`lesson-page-guidelines.md`](lesson-page-guidelines.md) for the complete ordering and availability contract.

Follow the PRD's progressive-reveal style when teaching architecture: `naive design → failure or limitation → improvement → new trade-off`. A component should appear because a demonstrated requirement or failure motivates it.

## Writing and diagram rules

- Write for a backend engineer preparing for an interview, not for a vendor certification.
- Define jargon before relying on it. Prefer a concrete request, record, queue, or failure over a dictionary definition.
- Make assumptions and units explicit in examples. Use illustrative numbers without implying universal benchmarks.
- Explain guarantees and boundaries: what the mechanism does **not** guarantee is as important as what it does.
- Keep vendor names subordinate to the underlying concept; introduce a product only as an implementation example.
- Use Mermaid or ASCII diagrams when they clarify flow, state, ownership, or failure. A diagram must have nearby prose explaining how to read it.
- Do not copy external prose or diagrams. Synthesize in original language and attribute sources through links.
- Keep essential meaning in Markdown. An unavailable visualization or MDX component must not make the lesson incomplete.
- Treat `Quiz Seeds` as reasoning prompts, not trivia questions.

## Reference rules

Every substantial lesson includes a `References` section. Aim for **3–8 strong sources** during research, with at least one authoritative documentation or engineering source. Two good sources are preferable to a padded list; do not add a video or paper merely to satisfy a count.

Prefer, in order:

1. official specifications and documentation;
2. original research papers;
3. engineering material from organizations operating the relevant systems;
4. respected university material and high-quality educational explanations;
5. an individual conference or YouTube explanation when it adds visual or intuitive value.

For each reference:

- link directly to the canonical page, paper, or video;
- use the page title as link text and add one sentence explaining why it is useful;
- use `https://` and avoid search-result URLs, link shorteners, tracking-heavy URLs, and generic homepages;
- prefer stable permalinks and note a publication/update year in prose when freshness affects the claim;
- distinguish an original result from a tutorial or implementation description;
- cite the source near a specific claim when a claim could be disputed, not only in a large undifferentiated list.

Video references are optional when no strong video materially improves the lesson. When included, prefer a specific lecture, talk, or tutorial over a channel landing page.

## Link conventions

Use two identifiers for two different jobs:

- **Frontmatter relationships** (`prerequisites`, `relatedLessons`) use stable lesson `id` values. These are machine-validated and survive a file move or route rename.
- **Prose links** use relative links to the source `.mdx` file, so the lesson remains navigable in an editor or repository browser. The content loader resolves those links to the canonical `/learn/<module>/<slug>` route in the app.

Example:

```md
See [replication](../../04-databases/replication.mdx) before comparing quorum choices.
```

Rules for local links:

- Resolve the path from the current file; do not rely on the current working directory.
- Link to a lesson source file, not to an implementation component or generated index.
- Use lowercase kebab-case paths and `.mdx` for lesson sources.
- Use normal Markdown anchors (`#lowercase-heading-slugs`) only for stable headings in the same lesson.
- Do not hard-code an app route in a lesson when a relative source link can express the same relationship.
- Keep the frontmatter ID and prose link in agreement; a link validator must resolve both.

Rules for external links:

- Use direct `https://` Markdown links with descriptive text.
- Never use `javascript:`, `file:`, local absolute filesystem paths, or bare URLs in lesson prose.
- Keep reference links in the `References` section unless they are needed inline to support a particular claim.

## Build-time index and validation expectations

The content toolchain scans `theory/**/*.mdx` at build/dev-start time, parses frontmatter, validates it, and produces a normalized lesson index. The index contains metadata, source path, heading/relationship information, and registry IDs; it does not contain duplicated lesson prose. Lesson routes and navigation read from this index rather than maintaining a second hand-authored catalog.

Validation should be incremental and risk-based:

### Errors

- malformed YAML or more than one frontmatter block;
- missing required fields or wrong scalar/list types;
- unknown `module` or `difficulty` value;
- invalid ID/slug/tag format;
- duplicate lesson IDs, `(module, slug)` pairs, aliases, or orders;
- a prerequisite or related lesson ID that does not resolve;
- a prerequisite cycle or self-reference;
- path/module mismatch;
- an unresolved local lesson link or malformed external URL;
- a present `visualizationId` or `quizId` that is not registered once the corresponding registry exists.

### Warnings

- missing context-specific body sections such as scaling or failure behavior;
- fewer than the target number of references;
- a lesson without a useful visualization specification when the concept has observable behavior;
- untagged concepts or objectives that are not actionable;
- heading/link text that is ambiguous for screen readers;
- external URLs that redirect, are unavailable, or appear unstable.

The validator should check local links on every content change. External URL checks may run in a separate network-enabled command so offline authoring remains possible; a failed network check must not silently mark a source as verified. Do not build a complex validator before enough content exists to justify it, but establish the schema and error categories before the first module is indexed.

## Author checklist

Before calling a lesson ready for review, confirm:

- [ ] Frontmatter parses and all required fields are present.
- [ ] `id`, `slug`, prerequisites, and related IDs are globally consistent.
- [ ] The concept starts from a motivating problem or naive design.
- [ ] Mental model, mechanics, example, trade-offs, and use/non-use guidance are clear.
- [ ] Scaling and failure behavior are covered when relevant.
- [ ] Interview Lens and 5–10 reasoning-oriented quiz seeds exist.
- [ ] Related topics use valid relative source links and/or IDs.
- [ ] References are direct, authoritative, and annotated; links have been checked.
- [ ] Essential teaching content remains understandable without interactive components.
