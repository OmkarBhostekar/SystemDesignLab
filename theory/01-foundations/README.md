# Module 01 — Foundations

**Status:** Theory complete. Horizontal vs Vertical Scaling now includes an interactive simulation; other visualizations and structured quizzes remain incremental work, and every lesson retains its visualization specification and quiz seeds.

## Purpose

Build the vocabulary needed to reason about system limits and guarantees: performance, scalability, latency, throughput, tail behavior, availability, reliability, durability, fault tolerance, partitions, and consistency. These concepts supply the measurements and trade-offs used by every later module.

## Depth classification

The module is predominantly **Core**. Consistency models contain a **Core / Advanced boundary**: the basic guarantees are core, while causal and nuanced implementation behavior can be developed later.

## Prerequisites

- [`00-interview-method`](../00-interview-method/README.md), especially requirements and rough estimation.
- The PRD's assumed basic programming and client/server vocabulary.

## Intended lesson order

The lessons are authored in this dependency order:

1. [01-01-performance-vs-scalability](./performance-vs-scalability.mdx) — Distinguish making one request faster from handling more work.
2. [01-02-horizontal-vs-vertical-scaling](./horizontal-vs-vertical-scaling.mdx) — Compare scale-up and scale-out, including bottlenecks, state, and failure domains.
3. [01-03-latency-vs-throughput](./latency-vs-throughput.mdx) — Separate per-request response time from completed work per unit time.
4. [01-04-percentiles-tail-latency](./percentiles-tail-latency.mdx) — Use p50/p95/p99 and service-time distributions instead of averages alone.
5. [01-05-availability](./availability.mdx) — Reason about usable service, serial dependencies, redundancy, and nines.
6. [01-06-reliability](./reliability.mdx) — Define correct operation over time and distinguish it from availability.
7. [01-07-durability](./durability.mdx) — Explain whether acknowledged data survives process, node, zone, or region failure.
8. [01-08-redundancy-and-fault-tolerance](./redundancy-and-fault-tolerance.mdx) — Show how independent copies and failover change failure behavior and cost.
9. [01-09-cap](./cap.mdx) — Introduce consistency, availability, and partition tolerance specifically under network partitions.
10. [01-10-consistency-models](./consistency-models.mdx) — Compare strong, eventual, weak, read-after-write, monotonic-read, and causal guarantees at an interview-useful level.

## Downstream connections

- [`02-networking`](../02-networking/README.md) uses latency and failure vocabulary to explain request hops and protocols.
- [`03-traffic-and-services`](../03-traffic-and-services/README.md) applies scale, saturation, availability, and failover reasoning.
- [`04-databases`](../04-databases/README.md) builds replication, partitioning, quorums, and transaction choices on these guarantees.
- [`05-caching`](../05-caching/README.md), [`06-messaging`](../06-messaging/README.md), and [`08-reliability`](../08-reliability/README.md) use the same throughput, latency, and failure models.
- Every archetype and lab in modules [`12`](../12-architecture-archetypes/README.md) and [`13`](../13-design-labs/README.md) should link back to the relevant foundation rather than repeat definitions.

## Authoring boundary

All ten theory lessons are complete in Markdown-first .mdx files with indexed metadata, progressive naive-to-failure-to-improvement explanations, backend examples, interview lenses, quiz seeds, local cross-links, and checked references. Interactive work remains future scope and must preserve the requirement-first progression rather than presenting a finished architecture before its constraints are established.
