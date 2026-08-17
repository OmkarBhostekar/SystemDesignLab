# Module 08 — Reliability and Failure Engineering

**Status:** Scaffold only. Failure-focused theory and simulations are not yet authored.

## Purpose

Make failure behavior a first-class part of architecture reasoning. The module explains how bounded waits, retries, isolation, admission control, graceful degradation, backups, and multi-region recovery prevent one component's failure from exhausting the whole system.

## Depth classification

Timeouts through graceful degradation are **Core** interview knowledge. Disaster recovery is **Core**; multi-region active/passive, active/active, and region failover are **Advanced**.

## Prerequisites

- [`01-foundations`](../01-foundations/README.md) for availability, reliability, durability, redundancy, and tail latency.
- [`03-traffic-and-services`](../03-traffic-and-services/README.md) for health checks and traffic failover.
- [`06-messaging`](../06-messaging/README.md) for asynchronous failure, acknowledgments, duplicates, and backpressure.
- [`07-distributed-coordination`](../07-distributed-coordination/README.md) where recovery depends on ownership, transactions, or replicated state.

## Intended lesson order

1. `08-01-timeouts` — Bound waiting so a slow dependency does not consume all caller resources.
2. `08-02-retries` — Identify retryable versus permanent errors, bounded attempts, and idempotency needs.
3. `08-03-exponential-backoff-and-jitter` — Spread recovery work and compare immediate, backoff-only, and jittered retry waves.
4. `08-04-retry-storms-and-cascading-failures` — Connect retries, saturation, queues, and dependency failure.
5. `08-05-circuit-breaker` — Closed, open, and half-open states with recovery probes.
6. `08-06-bulkhead` — Isolate resource pools and tenants so one workload cannot consume all capacity.
7. `08-07-load-shedding-and-graceful-degradation` — Protect core work by rejecting or reducing optional work.
8. `08-08-disaster-recovery` — Backups, failover, recovery workflows, and region failure as explicit scenarios.
9. `08-09-backups-rpo-rto` — Recovery point objective, recovery time objective, restore validation, and the cost of stronger targets.
10. `08-10-multi-region-and-region-failover` — Active/passive, active/active, geo-routing, replication latency, data residency, and failover trade-offs.

## Downstream connections

- [`09-observability`](../09-observability/README.md) measures the latency, errors, saturation, and budget burn that reveal failure.
- [`10-security`](../10-security/README.md) adds abuse, secrets, and tenant-isolation failure modes.
- [`11-building-blocks`](../11-building-blocks/README.md) uses retries, idempotency, scheduling, and provider failover in reusable components.
- [`12-architecture-archetypes`](../12-architecture-archetypes/README.md) and all [`13-design-labs`](../13-design-labs/README.md) must include failure analysis, not just a happy-path diagram.

## Authoring boundary

The planned lessons do not assert that retries are always helpful or that multi-region is always worth its cost. Future lessons should make failure injection, capacity exhaustion, recovery time, and user-visible degradation explicit, while respecting reduced-motion accessibility in eventual simulations.

