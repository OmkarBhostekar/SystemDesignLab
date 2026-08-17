# Module 05 — Caching

**Status:** Scaffold only. Cache theory and the cache-focused simulations are not yet authored.

## Purpose

Explain why caching can reduce latency and backend work, then make freshness, invalidation, eviction, stampedes, hot keys, and multi-layer behavior visible. The module teaches caches as trade-offs, not free performance upgrades.

## Depth classification

Most lessons are **Core**. Hot keys are an **Advanced** workload/failure extension; cache stampede is core but should include advanced mitigation options where relevant.

## Prerequisites

- [`01-foundations`](../01-foundations/README.md) for latency, throughput, and scale.
- [`03-traffic-and-services`](../03-traffic-and-services/README.md) for service request paths and traffic distribution.
- Relevant [`04-databases`](../04-databases/README.md) storage, replication, and consistency concepts.

## Intended lesson order

1. `05-01-why-cache` — Compare local memory, distributed cache, and database paths without hard-coding questionable absolute latency values.
2. `05-02-local-and-distributed-cache` — Scope, ownership, network cost, eviction, and failure boundaries.
3. `05-03-cache-aside` — Miss → database → set → response, including the first consistency trade-off.
4. `05-04-write-through-behind-refresh-ahead` — Timelines and trade-offs for common write/read refresh strategies.
5. `05-05-eviction-and-ttl` — TTL, LRU, LFU, capacity constraints, and workload fit.
6. `05-06-cache-invalidation` — Why changing a cache creates stale-data and ordering problems.
7. `05-07-cache-stampede` — Synchronized expiry and request coalescing, locks, TTL jitter, and stale-while-revalidate.
8. `05-08-hot-keys` — Zipf-like demand, cache-node overload, replication, local caching, key splitting, and coalescing.
9. `05-09-multi-layer-caching` — Browser, CDN, application cache, distributed cache, and database interactions; CDN is treated as a cache layer.

## Downstream connections

- [`06-messaging`](../06-messaging/README.md) can move refreshes and invalidation work off the synchronous path.
- [`08-reliability`](../08-reliability/README.md) handles cache outage, stale fallback, stampede prevention, and graceful degradation.
- [`11-building-blocks`](../11-building-blocks/README.md) reuses cache behavior in rate limiting, autocomplete, search, object storage, and presence.
- [`12-architecture-archetypes`](../12-architecture-archetypes/README.md) uses caches in read-heavy, fanout, search, and media patterns.
- Cache decisions are used in the URL shortener, news feed, autocomplete, file sync, and streaming labs in [`13-design-labs`](../13-design-labs/README.md).

## Authoring boundary

These are planned lesson boundaries. Future content must show the naive no-cache or naive-cache design, the failure it introduces, and the next trade-off. It should not promise a universal hit ratio or fixed latency number.

