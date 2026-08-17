# Module 05 — Caching

**Status:** Theory complete for all nine indexed lessons. Interactive simulations remain future work.

## Purpose

Explain why caching can reduce latency and backend work, then make freshness, invalidation, eviction, stampedes, hot keys, placement, write timing, and multi-layer behavior visible. The module teaches caches as trade-offs, not free performance upgrades. Every lesson starts from a workload pressure, names the cache guarantee, and follows the failure path into the next trade-off.

## Depth classification

Most lessons are **Core**. Hot keys are an **Advanced** workload/failure extension; cache stampede is core but should include advanced mitigation options where relevant.

## Prerequisites

- [`01-foundations`](../01-foundations/README.md) for latency, throughput, and scale.
- [`03-traffic-and-services`](../03-traffic-and-services/README.md) for service request paths and traffic distribution.
- Relevant [`04-databases`](../04-databases/README.md) storage, replication, and consistency concepts.

## Completed lesson order

1. [`05-01-why-cache`](why-cache.mdx) — Working sets, hit/miss paths, source-load estimates, and the cost of stale copies.
2. [`05-02-local-and-distributed-cache`](local-and-distributed-cache.mdx) — Scope, ownership, network cost, coherence, and failure boundaries.
3. [`05-03-cache-aside`](cache-aside.mdx) — Miss → source → fill, source-first writes, negative caching, and stale-fill races.
4. [`05-04-write-through-behind-refresh-ahead`](write-through-behind-refresh-ahead.mdx) — Cache update timing, durability boundaries, batching, and proactive refresh.
5. [`05-05-eviction-and-ttl`](eviction-and-ttl.mdx) — TTL versus eviction, LRU/LFU/random policy, sizing, jitter, and memory pressure.
6. [`05-06-cache-invalidation`](cache-invalidation.mdx) — Delete, update, version, namespace, event-driven invalidation, ordering, and repair.
7. [`05-07-cache-stampede`](cache-stampede.mdx) — Synchronized expiry, per-key coalescing, leases, jitter, early refresh, and stale-while-revalidate.
8. [`05-08-hot-keys`](hot-keys.mdx) — Skew, top-key telemetry, shard overload, replicas, local copies, and key splitting.
9. [`05-09-multi-layer-caching`](multi-layer-caching.mdx) — Browser, CDN, reverse proxy, local, distributed, and source-layer freshness and privacy.

## Downstream connections

- [`06-messaging`](../06-messaging/README.md) can move refreshes and invalidation work off the synchronous path.
- [`08-reliability`](../08-reliability/README.md) handles cache outage, stale fallback, stampede prevention, and graceful degradation.
- [`11-building-blocks`](../11-building-blocks/README.md) reuses cache behavior in rate limiting, autocomplete, search, object storage, and presence.
- [`12-architecture-archetypes`](../12-architecture-archetypes/README.md) uses caches in read-heavy, fanout, search, and media patterns.
- Cache decisions are used in the URL shortener, news feed, autocomplete, file sync, and streaming labs in [`13-design-labs`](../13-design-labs/README.md).

## Theory completion boundary

The nine lessons are authored as Markdown-first theory and include interview lenses, reasoning quiz seeds, relative lesson links, annotated references, and behavior-oriented visualization specifications. They do not claim a universal hit ratio, fixed latency number, or automatic correctness. Future work may add simulations for working-set pressure, stampedes, hot keys, invalidation races, and multi-layer freshness; those simulations must agree with the guarantees and failure cases documented here.
