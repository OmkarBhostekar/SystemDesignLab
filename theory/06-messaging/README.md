# Module 06 — Asynchronous Systems and Messaging

**Status:** Scaffold only. Queue, stream, delivery, and backpressure lessons are not yet authored.

## Purpose

Teach when to separate work from a request, how queues and pub/sub move events, how partitions constrain parallelism and ordering, what delivery semantics really guarantee, and how systems respond when producers outrun consumers.

## Depth classification

Queue fundamentals, delivery semantics, idempotency, dead-letter handling, and backpressure are **Core**. Partitions/consumer groups and exactly-once discussions sit at the **Core / Advanced boundary**. Stream-processing windows and event-time behavior are **Advanced**.

## Prerequisites

- [`01-foundations`](../01-foundations/README.md) for latency, throughput, capacity, and failure.
- [`02-networking`](../02-networking/README.md) for APIs and communication boundaries.
- [`03-traffic-and-services`](../03-traffic-and-services/README.md) for service boundaries.
- Relevant [`04-databases`](../04-databases/README.md) transaction/storage concepts and [`05-caching`](../05-caching/README.md) only where they affect asynchronous work.

## Intended lesson order

1. `06-01-sync-vs-async` — Compare synchronous order/email processing with queue-backed work and its new failure modes.
2. `06-02-message-queue-fundamentals` — Producers, brokers, consumers, queues, acknowledgments, visibility, and retention.
3. `06-03-pub-sub-and-topics` — Queue versus pub/sub, topics, subscriptions, and independent consumers.
4. `06-04-partitions-and-consumer-groups` — Partitioned topics, consumer groups, parallelism limits, rebalancing, and the partition count control.
5. `06-05-ordering` — Global, partition, and per-key ordering, including why global order can reduce scalability.
6. `06-06-delivery-semantics` — At-most-once, at-least-once, exactly-once claims, duplicates, retries, and crash points.
7. `06-07-idempotent-consumers` — Event IDs, deduplication, and safe repeated side effects.
8. `06-08-dead-letter-queues` — Poison messages, retry exhaustion, quarantine, and operational recovery.
9. `06-09-backpressure` — Queue growth, slow consumers, throttling, buffering, dropping low-priority work, and adding consumers.
10. `06-10-batching-and-stream-vs-batch` — Batching, stream versus batch processing, event time, and windows at an Advanced level.

## Downstream connections

- [`07-distributed-coordination`](../07-distributed-coordination/README.md) uses delivery and transaction concepts for sagas, outbox, and CDC.
- [`08-reliability`](../08-reliability/README.md) adds timeouts, retries, jitter, and load shedding around asynchronous work.
- [`09-observability`](../09-observability/README.md) follows messages and consumer lag through traces and metrics.
- [`11-building-blocks`](../11-building-blocks/README.md) uses messaging for schedulers, notifications, presence, and object workflows.
- The write-heavy, streaming, notification, chat, crawler, and distributed-queue designs in modules [`12`](../12-architecture-archetypes/README.md) and [`13`](../13-design-labs/README.md) depend on this module.

## Authoring boundary

The scaffold explicitly does not claim “exactly once” is magic. A future lesson must model crash points, duplicates, acknowledgments, and end-to-end coordination, and should separate simulation logic from rendering when the visual work begins.

