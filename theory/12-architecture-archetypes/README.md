# Module 12 — System Design Archetypes

**Status:** Scaffold only. Archetype lessons and their progressive visual examples remain to be authored.

## Purpose

Bridge isolated building blocks and named interview questions by teaching recurring workload shapes. An archetype gives the learner a starting hypothesis—read-heavy, write-heavy, fanout, real-time, workflow, search, or streaming—without becoming a memorized architecture.

## Depth classification

The first six archetypes are **Core**. Streaming/media systems are **Advanced** because they add sustained bandwidth, large objects, delivery paths, and media-specific scaling concerns.

## Prerequisites

- [`00-interview-method`](../00-interview-method/README.md) for the design workflow.
- Core concepts from [`01-foundations`](../01-foundations/README.md) through [`10-security`](../10-security/README.md), selected by workload.
- Relevant composite blocks from [`11-building-blocks`](../11-building-blocks/README.md).

## Intended lesson order

1. `12-01-read-heavy` — Replicas, caches, CDN, and denormalization; ask where writes and freshness still constrain the design.
2. `12-02-write-heavy` — Partitioning, append logs, batching, and asynchronous processing; ask where ordering and durability matter.
3. `12-03-fanout` — Push versus pull, celebrity/hot-user skew, queues, and cache/read-model trade-offs.
4. `12-04-realtime` — Persistent connections, presence, gateways, pub/sub, ordering, and failure/reconnect behavior.
5. `12-05-transactional-workflow` — State transitions, concurrency, idempotency, compensation, and durable side effects.
6. `12-06-search-and-discovery` — Ingestion, indexes, ranking, caching, freshness, and geo/prefix access patterns.
7. `12-07-streaming-and-media` — Object storage, CDN, manifests/chunks, sustained throughput, and regional delivery at an Advanced level.

## Downstream connections

- Every lab in [`13-design-labs`](../13-design-labs/README.md) declares one or more archetypes so the learner can transfer workload reasoning.
- The archetypes pull from [`04-databases`](../04-databases/README.md), [`05-caching`](../05-caching/README.md), [`06-messaging`](../06-messaging/README.md), [`08-reliability`](../08-reliability/README.md), [`09-observability`](../09-observability/README.md), and [`11-building-blocks`](../11-building-blocks/README.md).
- The interview framework in [`00-interview-method`](../00-interview-method/README.md) remains the governing workflow; archetypes are not reference answers.

## Authoring boundary

Future archetype lessons should demonstrate how changing constraints changes the architecture. They must retain the PRD's naive → failure → improvement → trade-off progression and leave enough uncertainty for the learner to reason in the design labs.

