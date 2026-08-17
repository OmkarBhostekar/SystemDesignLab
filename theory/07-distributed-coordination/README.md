# Module 07 — Distributed Coordination and Consistency

**Status:** Scaffold only. Coordination theory and educational simulators remain to be authored.

## Purpose

Explain how independently failing nodes establish ordering, leadership, ownership, and durable cross-service workflows. The module builds from clocks and leader election to locks, fencing, consensus intuition, distributed transactions, sagas, outbox/CDC, and optional event-sourced architectures.

## Depth classification

The module is primarily **Advanced**. Event sourcing and CQRS are **Deep Dive**. Transactional outbox is a **Core / Advanced boundary** because the failure it addresses is common in backend interviews while the relay/CDC details can be deeper.

## Prerequisites

- [`01-foundations`](../01-foundations/README.md), especially CAP and consistency models.
- [`04-databases`](../04-databases/README.md), especially transactions, replication, concurrency, partitioning, and quorums.
- [`06-messaging`](../06-messaging/README.md), especially delivery semantics, idempotency, ordering, and backpressure.

## Intended lesson order

1. `07-01-clocks-and-ordering` — Why wall-clock time is insufficient for distributed ordering; logical clocks and vector clocks conceptually.
2. `07-02-leader-election` — Why a group chooses a leader and what happens when it dies.
3. `07-03-consensus-and-raft-intuition` — Terms, leader/followers, replicated log, majority, and leader failure without pretending to implement production Raft.
4. `07-04-distributed-locks` — Shared resource ownership, lock owner, timeout/lease, and crash scenarios.
5. `07-05-leases-and-fencing-tokens` — Expired holders, pause/resume, and fencing stale operations.
6. `07-06-distributed-transactions-and-2pc` — Why independent service transactions are hard and what two-phase commit coordinates.
7. `07-07-saga-pattern` — Orchestration, choreography, compensating actions, and a multi-step order workflow.
8. `07-08-transactional-outbox` — Dual-write failure, an atomic domain/outbox transaction, relay, and idempotent publication.
9. `07-09-change-data-capture` — Database-log-based propagation as a conceptual continuation of outbox/event delivery.
10. `07-10-event-sourcing-and-cqrs` — Event history, read models, and why neither pattern is a default microservice requirement.

## Downstream connections

- [`08-reliability`](../08-reliability/README.md) uses coordination failure cases to design recovery, retries, and regional failover.
- [`09-observability`](../09-observability/README.md) is needed to diagnose elections, lag, duplicate workflows, and compensation failures.
- [`11-building-blocks`](../11-building-blocks/README.md) reuses clocks/IDs, locks/schedulers, and event propagation.
- [`12-architecture-archetypes`](../12-architecture-archetypes/README.md) applies coordination to transactional workflows and write-heavy systems.
- Booking, payment, wallet, e-commerce, and distributed key-value store labs in [`13-design-labs`](../13-design-labs/README.md) are the primary practice consumers.

## Authoring boundary

This README is a map, not a consensus implementation. Future lessons must state assumptions, distinguish educational intuition from production protocol guarantees, and show why each coordination mechanism exists before presenting it as an architecture box.

