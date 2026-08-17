# Module 09 — Observability

**Status:** Theory complete (7/7 lessons). Interactive visualizations, structured quizzes, and application wiring remain future work.

## Purpose

Teach how to understand system behavior in production through logs, metrics, traces, service-level objectives, health signals, and actionable alerts. Observability is positioned after failure engineering so the learner knows which behaviors need to be observed and why.

## Depth classification

The module is **Core** overall. Error budgets and the relationship between SLI/SLO decisions and engineering work are **Advanced** extensions.

## Prerequisites

- [`01-foundations`](../01-foundations/README.md) for latency, traffic, errors, saturation, availability, and reliability.
- [`02-networking`](../02-networking/README.md) for the request path and correlation across hops.
- [`03-traffic-and-services`](../03-traffic-and-services/README.md) for dynamic service graphs.
- [`06-messaging`](../06-messaging/README.md) for consumer lag and asynchronous paths.
- [`08-reliability`](../08-reliability/README.md) for timeouts, retries, circuit states, and recovery scenarios.

## Intended lesson order

1. `09-01-logs-metrics-and-traces` — Compare the questions each signal type answers and where each can mislead.
2. `09-02-distributed-tracing` — Trace ID, span ID, parent-child spans, correlation, and a request waterfall.
3. `09-03-golden-signals` — Latency, traffic, errors, and saturation as a compact operational lens.
4. `09-04-sli-slo-and-sla` — Distinguish measured indicators, internal objectives, and external commitments.
5. `09-05-error-budgets` — Burn a 99.9% budget and connect the result to release/reliability decisions.
6. `09-06-alerting` — Prefer actionable user-impact signals over alerts for every metric anomaly.
7. `09-07-health-checks` — Liveness, readiness, and dependency health; connect them back to traffic failover.

## Downstream connections

- [`08-reliability`](../08-reliability/README.md) should link back to signals that validate retries, degradation, and recovery.
- [`10-security`](../10-security/README.md) uses auditability and operational signals around identity, abuse, and secrets.
- [`11-building-blocks`](../11-building-blocks/README.md) uses tracing/metrics in schedulers, notifications, and presence.
- [`12-architecture-archetypes`](../12-architecture-archetypes/README.md) and [`13-design-labs`](../13-design-labs/README.md) use observability in bottleneck and failure-analysis steps.

## Authoring boundary

The seven canonical lessons now pair every signal with the decision it enables, show distributed context propagation through synchronous and asynchronous paths, and keep dashboards subordinate to user-impact reasoning rather than presenting telemetry as decoration. Interactive visualizations and structured quizzes remain future work; the Markdown lessons are the current source of truth.
