# Module 04 — Data and Databases

**Status:** Scaffold only. This is planned as the deepest theory module; its lessons, references, visualizations, and quizzes remain to be authored.

## Purpose

Teach the learner to choose and scale storage from access patterns, relationships, consistency, durability, concurrency, and failure requirements rather than from technology names. The module moves from data modeling to local transaction behavior, indexes, replication, partitioning, and coordination across copies.

## Depth classification

This module spans the full curriculum depth range:

- **Core:** access-pattern modeling, SQL versus NoSQL, storage models, ACID/transactions, indexes, replication, sharding, denormalization, connection pools, and concurrency control.
- **Core / Advanced boundary:** transaction isolation and consistent hashing.
- **Advanced:** B-tree versus LSM trees and read/write quorums.

## Prerequisites

- [`01-foundations`](../01-foundations/README.md) for performance, scale, consistency, availability, and durability.
- [`02-networking`](../02-networking/README.md) for API and request access patterns.
- [`03-traffic-and-services`](../03-traffic-and-services/README.md) for service ownership, traffic distribution, and instance scaling.

## Intended lesson order

1. `04-01-data-modeling-from-access-patterns` — Start with reads, writes, relationships, cardinality, and required guarantees.
2. `04-02-sql-vs-nosql` — Compare relational and non-relational choices from workload constraints rather than slogans.
3. `04-03-storage-models` — Key-value, document, wide-column, graph, and relational models at an interview-useful level.
4. `04-04-acid-and-transactions` — Atomicity, consistency, isolation, durability, and a concrete multi-step transfer.
5. `04-05-transaction-isolation` — Dirty reads, non-repeatable reads, phantom reads, write skew, and the guarantees of common isolation levels.
6. `04-06-database-indexes` — Lookup versus scan, B-tree intuition, composite and covering indexes, selectivity, and write amplification.
7. `04-07-b-tree-vs-lsm` — Read/write profiles, memtables, SSTables, compaction, and read/write amplification.
8. `04-08-replication` — Leader/follower, synchronous/asynchronous copies, replication lag, read replicas, and leader failover.
9. `04-09-partitioning-and-sharding` — Range, hash, and directory sharding; rebalancing and hot partitions.
10. `04-10-consistent-hashing` — Naive modulo, hash rings, virtual nodes, node changes, remapping, and hotspots.
11. `04-11-read-write-quorums` — N/R/W choices, contacted replicas, guarantees, and latency/availability trade-offs.
12. `04-12-denormalization` — Duplicated read models, update paths, and the consistency cost of avoiding joins.
13. `04-13-connection-pools` — Pool sizing, queueing, saturation, and the relationship between application concurrency and database capacity.
14. `04-14-concurrency-control` — Optimistic version checks, pessimistic locks, and the last-room booking race.

## Downstream connections

- [`05-caching`](../05-caching/README.md) places caches around database access and makes freshness/invalidation explicit.
- [`06-messaging`](../06-messaging/README.md) builds asynchronous writes and delivery semantics on transaction and storage guarantees.
- [`07-distributed-coordination`](../07-distributed-coordination/README.md) extends replication, ordering, locks, and transactions across nodes or services.
- [`08-reliability`](../08-reliability/README.md) covers recovery, backups, multi-region data, and failure handling.
- [`11-building-blocks`](../11-building-blocks/README.md) reuses indexes, storage, IDs, search, and object storage; [`12-archetypes`](../12-architecture-archetypes/README.md) and [`13-design-labs`](../13-design-labs/README.md) use the data choices directly.

## Authoring boundary

The module ordering is a dependency scaffold, not a completed database course. Future lessons should make anomalies and scaling behavior observable, state assumptions, and link to authoritative references. No database technology should be presented as universally correct.

