# Module 11 — Reusable Interview Building Blocks

**Status:** Theory-complete. All ten canonical composite lessons are authored and indexed; interactive visualizations and structured quizzes remain future application work.

## Purpose

Combine foundational mechanisms into reusable components that appear across interview prompts. Each block should explain the motivating workload, the minimal design, the failure/trade-off path, and the concepts it composes rather than presenting a named technology as the answer.

## Depth classification

Depth varies by block:

- **Core:** rate limiter, unique ID generator, autocomplete, notification system, real-time presence.
- **Core / Advanced boundary:** object/blob storage.
- **Advanced:** distributed scheduler, full-text search, Bloom filter, geospatial indexing.

## Prerequisites

There is no single all-or-nothing prerequisite. Each block should link to the relevant concepts from modules [`02-networking`](../02-networking/README.md) through [`10-security`](../10-security/README.md). The intended authoring order below moves from admission/identity primitives to coordination, search, storage, and real-time composites.

## Intended lesson order and local dependencies

1. `11-01-rate-limiter` — Fixed window, sliding-window log/counter, token bucket, leaky bucket, and centralized versus distributed placement. Depends on API boundaries, counters/atomicity, caching/storage, and security abuse prevention.
2. `11-02-distributed-unique-id-generator` — Database sequences, UUIDs, timestamp + node + sequence, and Snowflake-style layouts. Depends on estimation, storage, clocks, and node coordination.
3. `11-03-distributed-scheduler` — Durable job storage, polling, ownership, retries, duplicate execution, and leases. Depends on queues, idempotency, locks/leases, and reliability.
4. `11-04-search-autocomplete` — Trie intuition, prefix index, ranking, caching, and precomputation. Depends on indexing, cache behavior, APIs, and read-heavy workloads.
5. `11-05-full-text-search` — Inverted-index intuition, ingestion, querying, ranking, and freshness. Depends on data modeling/indexes, asynchronous ingestion, and observability.
6. `11-06-bloom-filter` — Bits, hash functions, false positives, and crawler/cache use cases. Depends on storage access patterns and cache/database load reasoning.
7. `11-07-object-and-blob-storage` — Metadata versus blobs, multipart upload, checksums, replication, CDN integration, and signed URLs. Depends on APIs, storage/replication, caching/CDN, and reliability.
8. `11-08-notification-system` — Push, email, SMS, preferences, fanout, queues, retries, provider failure, and deduplication. Depends on messaging, reliability, idempotency, and security.
9. `11-09-realtime-presence` — Heartbeats, expiration, connection gateways, and pub/sub. Depends on WebSockets/SSE, TTL, messaging, and failure handling.
10. `11-10-geospatial-indexing` — Grid, geohash, and quadtree intuition for nearby queries. Depends on data/index fundamentals, API access patterns, and real-time workload constraints.

## Downstream connections

- [`12-architecture-archetypes`](../12-architecture-archetypes/README.md) groups these blocks by workload shape.
- [`13-design-labs`](../13-design-labs/README.md) links each named lab to the block(s) it should practice.
- The module also provides reusable visualization candidates: token bucket, bit-array/Bloom filter, storage upload timeline, presence expiry, and geo-grid behavior.

## Authored lessons

- [Rate limiter](./rate-limiter.mdx) — fixed/sliding/token/leaky algorithms and local versus distributed admission.
- [Distributed unique ID generator](./distributed-unique-id-generator.mdx) — sequences, UUIDs, Snowflake-style layouts, ordering, and clock trade-offs.
- [Distributed scheduler](./distributed-scheduler.mdx) — durable jobs, claims, leases, retries, duplicates, and misfires.
- [Search autocomplete](./search-autocomplete.mdx) — prefix indexes, trie/sorted representations, ranking, cache, and freshness.
- [Full-text search](./full-text-search.mdx) — inverted indexes, ingestion, ranking, shard fanout, and reindexing.
- [Bloom filter](./bloom-filter.mdx) — compact approximate membership and false-positive budgeting.
- [Object and blob storage](./object-and-blob-storage.mdx) — metadata/bytes, multipart uploads, checksums, signed access, and lifecycle.
- [Notification system](./notification-system.mdx) — preferences, channel fanout, provider retries, and deduplication.
- [Real-time presence](./realtime-presence.mdx) — heartbeats, TTL leases, gateways, and pub/sub recovery.
- [Geospatial indexing](./geospatial-indexing.mdx) — grid, geohash, quadtree, candidate cells, and exact distance.

## Authoring boundary

These lessons keep the conceptual mechanism vendor-independent, include alternatives and failure modes, and avoid implying that a reusable block is a drop-in answer without requirements and estimates. Visualization IDs and structured quiz IDs remain optional until their registries exist.
