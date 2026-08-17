# Module 13 — Interview Design Labs

**Status:** Scaffold only. Lab prompts, reference architectures, and interactive workspace behavior are not yet authored.

## Purpose

Provide progressively less-scaffolded practice applying the full interview method to realistic systems. Every lab should move through requirements, capacity estimation, APIs, data model, high-level architecture, deep dive, failure analysis, trade-offs, and a reference architecture. The reference is for comparison, not an automatic correctness score.

## Depth classification

- **Beginner:** learn to apply a small set of core blocks with explicit prompts.
- **Intermediate:** combine several modules and make more independent architecture choices.
- **Advanced Backend:** reason about concurrency, correctness, durable workflows, multi-region behavior, security, and recovery.

## Prerequisites

- [`00-interview-method`](../00-interview-method/README.md) is required for every lab.
- Each lab declares the minimum concepts from [`01-foundations`](../01-foundations/README.md) through [`12-architecture-archetypes`](../12-architecture-archetypes/README.md) in the map below.
- A lab may link to additional review topics without changing the global module order.

## Intended lab order and prerequisite focus

### Beginner

1. `13-01-url-shortener` — Read-heavy; IDs, storage, cache, redirects, and basic scale. Focus: 01, 02 API, 03 traffic, 04 storage, 05 cache, 12 read-heavy.
2. `13-02-rate-limiter` — Admission control and distributed counters. Focus: 01 scale, 03 gateway/traffic, 08 overload handling, 10 abuse prevention, 11 rate limiter.
3. `13-03-unique-id-generator` — Identity under concurrency and multiple nodes. Focus: 01 estimation, 04 storage, 07 clocks/coordination, 11 unique IDs.
4. `13-04-pastebin` — Metadata plus expiring blobs. Focus: 02 API, 04 storage, 05 TTL/cache, 08 durability, 11 object storage.

### Intermediate

5. `13-05-notification-service` — Multi-channel fanout, preferences, provider failures, retries, and deduplication. Focus: 06 messaging, 08 reliability, 09 operations, 10 security, 11 notifications.
6. `13-06-chat-and-messaging` — Persistent connections, ordering, delivery, presence, and reconnect behavior. Focus: 02 real-time transports, 06 messaging, 08 failures, 09 tracing, 11 presence, 12 real-time.
7. `13-07-news-feed` — Push versus pull fanout, celebrity skew, caching, and read models. Focus: 04 data, 05 cache, 06 async, 11 notification/search blocks, 12 fanout.
8. `13-08-search-autocomplete` — Prefix reads, ranking, cache, indexing, and freshness. Focus: 02 APIs, 04 indexes, 05 cache, 11 autocomplete/search, 12 search.
9. `13-09-web-crawler` — Scheduling, politeness, deduplication, storage, and backpressure. Focus: 04 storage, 06 messaging, 07 coordination, 08 reliability, 11 scheduler/Bloom filter.
10. `13-10-file-sync-and-drive` — Metadata/blob separation, sync conflicts, upload, sharing, and durability. Focus: 02 APIs, 04 concurrency/storage, 05 cache, 06 async, 08 recovery, 10 authorization, 11 object storage.
11. `13-11-metrics-and-monitoring-platform` — Ingestion, retention, aggregation, query paths, and alerting. Focus: 04 write/read storage, 06 streams, 08 backpressure, 09 observability, 12 write-heavy/streaming.
12. `13-12-distributed-message-queue` — Durable partitions, replication, consumer groups, ordering, and recovery. Focus: 04 replication/sharding, 06 delivery/partitions, 07 consensus, 08 reliability, 09 observability, 12 write-heavy/streaming.

### Advanced Backend

13. `13-13-ticket-and-hotel-booking` — Overselling, reservation timeout, isolation, optimistic/pessimistic concurrency, and idempotency. Focus: 04 transactions/isolation/concurrency, 06 delivery, 07 workflows/outbox, 08 recovery, 09 operations, 12 transactional workflow.
14. `13-14-e-commerce-inventory-and-ordering` — Inventory ownership, order state, payment boundary, queues, and compensating actions. Focus: 04 data/concurrency, 05 cache, 06 messaging, 07 saga/outbox, 08 reliability, 09 observability, 10 security, 12 workflow.
15. `13-15-payment-system` — Ledger, idempotency, reconciliation, eventual workflows, and failure recovery. Focus: 04 transactions/consistency, 06 delivery, 07 outbox/saga, 08 recovery, 09 operations, 10 security, 12 workflow.
16. `13-16-digital-wallet` — Balance correctness, concurrent transfers, durable ledger, and duplicate-safe commands. Focus: 01 consistency, 04 transactions/isolation/concurrency, 06 idempotency, 07 coordination, 08 recovery, 10 security, 12 workflow.
17. `13-17-distributed-key-value-store` — Partitioning, replication, quorums, rebalancing, consistency, and leader/coordination choices. Focus: 01 CAP/consistency, 04 replication/sharding/hash/quorums, 07 consensus, 08 multi-region, 09 observability, 12 write-heavy.
18. `13-18-object-storage` — Metadata, blobs, multipart upload, checksums, replication, CDN, and signed access. Focus: 02 APIs, 04 partition/replication, 05 cache/CDN, 06 async, 08 disaster recovery, 09 operations, 11 object storage, 12 streaming/media.
19. `13-19-ride-hailing-and-nearby-drivers` — Location updates, geospatial lookup, dispatch, real-time state, and regional failure. Focus: 02 real-time APIs, 04 geo/indexing, 06 pub/sub, 08 multi-region, 09 tracing, 10 security, 11 presence/geo, 12 real-time/search.
20. `13-20-video-streaming-platform` — Ingest, object storage, transcoding, manifests/chunks, CDN, regional delivery, and observability. Focus: 02 HTTP, 03 traffic/CDN, 04 storage, 05 multi-layer cache, 06 streams, 08 multi-region, 09 operations, 11 object storage, 12 streaming/media.

## Downstream connections

- Labs are the downstream application of every preceding module, not a replacement for theory.
- The design-lab workspace described by the PRD should expose prompts for requirements, estimation, API, data, architecture, bottlenecks, failures, trade-offs, and reference comparison.
- Future review and interview mode can use lab attempts, but the initial scaffold does not imply an evaluator or an AI dependency.

## Authoring boundary

No lab is complete because its name appears here. Each future lab must have a problem statement, prompts, a reference solution and rationale, related concept links, and a way to compare the learner's design with the reference without pretending that one architecture is universally correct.
