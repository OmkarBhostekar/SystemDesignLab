# Module 00 — System Design Interview Method

**Status:** Theory complete. Interactive visualizations and structured quizzes remain future work; each lesson includes a visualization specification and quiz seeds.

## Purpose

Give the learner a repeatable way to turn an ambiguous system-design prompt into requirements, estimates, an architecture, failure analysis, and explicit trade-offs. This module comes first because every later concept is introduced as a response to a requirement or a demonstrated bottleneck.

## Depth classification

All planned lessons in this module are **Core**. The module is expected knowledge for most backend system-design interviews, regardless of the eventual depth of the design.

## Prerequisites

No curriculum prerequisites. The PRD assumes basic programming, HTTP APIs, basic SQL, data structures, and familiarity with a server and a database. Those assumptions are not full lessons in this module.

## Intended lesson order

The lessons are authored in this dependency order:

1. [`00-01-interview-signals`](./interview-signals.mdx) — What system-design interviews measure: clarification, decomposition, scale reasoning, trade-offs, reliability, and communication.
2. [`00-02-requirements`](./requirements.mdx) — Functional versus non-functional requirements, including scale, latency, consistency, availability, durability, security, cost, and geography.
3. [`00-03-estimation`](./estimation.mdx) — Back-of-the-envelope estimation: DAU/MAU, QPS, peak QPS, read/write ratio, storage, bandwidth, connections, cache size, and replication overhead.
4. [`00-04-interview-framework`](./interview-framework.mdx) — The canonical workflow: clarify, identify NFRs, estimate, define APIs, model data, draw the high-level system, find bottlenecks, deep dive, handle failures, discuss trade-offs, summarize.

The capacity calculator is a cross-lesson tool attached primarily to `00-03-estimation`; it should teach orders of magnitude rather than fake precision.

## Downstream connections

- All concepts in [`01-foundations`](../01-foundations/README.md) are selected and explained inside this interview frame.
- The framework remains available from every lab in [`13-design-labs`](../13-design-labs/README.md).
- Requirement clarification and estimation are prerequisites for every architecture archetype in [`12-architecture-archetypes`](../12-architecture-archetypes/README.md).
- The module's canonical IDs and dependency edges live in [`docs/curriculum-map.md`](../../docs/curriculum-map.md).

## Authoring boundary

The authored lessons follow the theory template in `CODEX.md`, include verified references, quiz seeds, related-topic links, and future visualization specifications. Future interactive work must preserve the lessons' requirement-first progression instead of presenting a finished architecture before its constraints are established.
