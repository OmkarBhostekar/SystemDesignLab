# Module 06 — Asynchronous Systems and Messaging

**Status:** Theory complete for all ten indexed lessons. Interactive simulations remain future work.

## Purpose

Teach when to separate work from a request, how queues and pub/sub move events, how partitions constrain parallelism and ordering, what delivery semantics really guarantee, how duplicate-safe consumers and DLQs operate, and how systems respond when producers outrun consumers. Stream-processing edges make event time, windows, watermarks, batching, and late data explicit rather than treating “real time” as a magic property.

## Depth classification

Queue fundamentals, delivery semantics, idempotency, dead-letter handling, and backpressure are **Core**. Partitions/consumer groups and exactly-once discussions sit at the **Core / Advanced boundary**. Stream-processing windows and event-time behavior are **Advanced**.

## Prerequisites

- [`01-foundations`](../01-foundations/README.md) for latency, throughput, capacity, and failure.
- [`02-networking`](../02-networking/README.md) for APIs and communication boundaries.
- [`03-traffic-and-services`](../03-traffic-and-services/README.md) for service boundaries.
- Relevant [`04-databases`](../04-databases/README.md) transaction/storage concepts and [`05-caching`](../05-caching/README.md) only where they affect asynchronous work.

## Completed lesson order

1. [`06-01-sync-vs-async`](sync-vs-async.mdx) — Request-path decisions, durable acceptance, status, and delayed completion.
2. [`06-02-message-queue-fundamentals`](message-queue-fundamentals.mdx) — Producers, brokers, delivery, acknowledgments, visibility, retention, and crash behavior.
3. [`06-03-pub-sub-and-topics`](pub-sub-and-topics.mdx) — Queue versus pub/sub, topics, subscriptions, event envelopes, replay, and fan-out.
4. [`06-04-partitions-and-consumer-groups`](partitions-and-consumer-groups.mdx) — Partition keys, parallelism ceilings, lag, heartbeats, and rebalancing.
5. [`06-05-ordering`](ordering.mdx) — Global, partition, per-key, causal, and best-effort order with sequence checks.
6. [`06-06-delivery-semantics`](delivery-semantics.mdx) — At-most-once, at-least-once, scoped exactly-once, crash points, and end-to-end limits.
7. [`06-07-idempotent-consumers`](idempotent-consumers.mdx) — Event identity, inbox/dedup records, atomic effects, and external-provider reconciliation.
8. [`06-08-dead-letter-queues`](dead-letter-queues.mdx) — Poison messages, bounded retries, quarantine metadata, ownership, and safe replay.
9. [`06-09-backpressure`](backpressure.mdx) — Queue growth, age, prefetch, throttling, priority, load shedding, and downstream protection.
10. [`06-10-batching-and-stream-vs-batch`](batching-and-stream-vs-batch.mdx) — Batching triggers, stream versus batch, event time, windows, watermarks, and lateness.

## Downstream connections

- [`07-distributed-coordination`](../07-distributed-coordination/README.md) uses delivery and transaction concepts for sagas, outbox, and CDC.
- [`08-reliability`](../08-reliability/README.md) adds timeouts, retries, jitter, and load shedding around asynchronous work.
- [`09-observability`](../09-observability/README.md) follows messages and consumer lag through traces and metrics.
- [`11-building-blocks`](../11-building-blocks/README.md) uses messaging for schedulers, notifications, presence, and object workflows.
- The write-heavy, streaming, notification, chat, crawler, and distributed-queue designs in modules [`12`](../12-architecture-archetypes/README.md) and [`13`](../13-design-labs/README.md) depend on this module.

## Theory completion boundary

The ten lessons are authored as Markdown-first theory and include interview lenses, reasoning quiz seeds, relative lesson links, annotated references, and behavior-oriented visualization specifications. They explicitly scope delivery guarantees, model crash points, and treat idempotency, DLQs, and backpressure as operational mechanisms. Future visual work should separate deterministic queue/stream simulation from rendering and preserve the text explanations when interactive features are unavailable.
