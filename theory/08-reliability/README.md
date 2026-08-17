# Module 08 — Reliability and Failure Engineering

**Status:** Theory complete — 10 Markdown-first lessons. Interactive failure simulations and structured quizzes remain future application work.

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

## Completed lesson coverage

Each lesson starts from a failure pressure and carries the reasoning through mechanics, concrete backend behavior, scaling limits, recovery choices, trade-offs, interview framing, quiz seeds, annotated references, and a behavior-oriented future visualization specification.

| Lesson | Completed teaching focus |
| --- | --- |
| [Timeouts](./timeouts.mdx) | Connection/queue/request timers, absolute deadlines, cancellation, fan-out budgets, and ambiguous timed-out writes. |
| [Retries and Error Classification](./retries.mdx) | Permanent, transient, throttling, and ambiguous errors; bounded attempts, retry ownership, idempotency, and reconciliation. |
| [Exponential Backoff and Jitter](./exponential-backoff-and-jitter.mdx) | Immediate/fixed/exponential schedules, full/equal/decorrelated jitter, caps, deadlines, and retry-wave load. |
| [Retry Storms and Cascading Failures](./retry-storms-and-cascading-failures.mdx) | Positive feedback between latency, retries, queues, health checks, failover, capacity, and controlled recovery. |
| [Circuit Breaker](./circuit-breaker.mdx) | Closed/open/half-open state behavior, probe budgets, scope, fallback semantics, and breaker limitations. |
| [Bulkhead](./bulkhead.mdx) | Resource-pool, tenant, priority, and cell isolation; reserve/borrow policies, fairness, and fragmentation costs. |
| [Load Shedding and Graceful Degradation](./load-shedding-and-graceful-degradation.mdx) | Admission control, priorities, bounded queues, cached/partial responses, retry semantics, and recovery reserve. |
| [Disaster Recovery](./disaster-recovery.mdx) | Scenario-based recovery, HA versus DR, fencing, dependency/runbook ordering, validation, traffic shift, and failback. |
| [Backups, RPO, RTO, and Restore Validation](./backups-rpo-rto.mdx) | Recovery objectives, snapshots/logs/replicas, retention and isolation, restore integrity, and measured recovery time. |
| [Multi-Region and Region Failover](./multi-region-and-region-failover.mdx) | Active/passive versus active/active, routing, replication lag, ownership/fencing, conflicts, residency, capacity, and failback. |

The lessons treat retries, failover, and multi-region as conditional tools rather than universal improvements. They specify what is shed, what is degraded, what data may be lost, and how recovery is validated; they do not implement a production resilience library or disaster-recovery controller.

## Downstream connections

- [`09-observability`](../09-observability/README.md) measures the latency, errors, saturation, and budget burn that reveal failure.
- [`10-security`](../10-security/README.md) adds abuse, secrets, and tenant-isolation failure modes.
- [`11-building-blocks`](../11-building-blocks/README.md) uses retries, idempotency, scheduling, and provider failover in reusable components.
- [`12-architecture-archetypes`](../12-architecture-archetypes/README.md) and all [`13-design-labs`](../13-design-labs/README.md) must include failure analysis, not just a happy-path diagram.

## Authoring boundary

The completed lessons do not assert that retries are always helpful or that multi-region is always worth its cost. They make failure injection, capacity exhaustion, recovery time, and user-visible degradation explicit. Future simulations must preserve those semantics and respect reduced-motion accessibility.
