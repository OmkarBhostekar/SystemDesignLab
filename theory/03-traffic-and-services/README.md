# Module 03 — Traffic Distribution and Service Architecture

**Status:** Theory complete. All eight indexed lessons have been authored and reviewed for the theory definition of done; visualizations and structured quizzes remain future work.

## Purpose

Show how traffic is routed, balanced, admitted, and moved across changing service instances. Then examine how deployment and ownership boundaries evolve from a monolith to a modular monolith or microservices, including the network and operational costs introduced by each split.

## Depth classification

Traffic distribution is **Core**. Service discovery and service-boundary design are **Advanced** extensions because they require reasoning about dynamic topology, ownership, and organizational scale.

## Prerequisites

- [`01-foundations`](../01-foundations/README.md) for scale, latency, availability, and fault-tolerance concepts.
- [`02-networking`](../02-networking/README.md) for request lifecycle, APIs, and transport behavior.

## Intended lesson order

1. [`03-01-reverse-proxy-and-load-balancer`](reverse-proxy-and-load-balancer.mdx) — Clarify the shared and distinct roles of reverse proxies and load balancers.
2. [`03-02-load-balancing-algorithms`](load-balancing-algorithms.mdx) — Round robin, weighted round robin, least connections, least response time, hashing, and an introduction to consistent hashing.
3. [`03-03-l4-vs-l7`](l4-vs-l7.mdx) — Compare transport-level and request-aware routing.
4. [`03-04-health-checks-and-failover`](health-checks-and-failover.mdx) — Instance death, health-check intervals, false positives, draining, and traffic recovery.
5. [`03-05-service-discovery`](service-discovery.mdx) — Registry, client-side discovery, server-side discovery, and dynamic instances.
6. [`03-06-api-gateway`](api-gateway.mdx) — Routing, authentication, rate limiting, aggregation, and protocol translation; explain when a gateway is unnecessary.
7. [`03-07-monolith-to-microservices`](monolith-to-microservices.mdx) — Monolith, modular monolith, and microservices as responses to different organizational and operational constraints.
8. [`03-08-service-boundaries`](service-boundaries.mdx) — Data ownership, deployment boundaries, network failure edges, and how to choose a split without treating microservices as a default.

## Downstream connections

- [`04-databases`](../04-databases/README.md) uses traffic and ownership boundaries to frame storage scaling and connection pools.
- [`05-caching`](../05-caching/README.md) and [`06-messaging`](../06-messaging/README.md) are introduced where synchronous traffic or service coupling becomes a bottleneck.
- [`08-reliability`](../08-reliability/README.md) extends health checks and failover into timeouts, isolation, and degradation.
- [`09-observability`](../09-observability/README.md) instruments the service graph; [`10-security`](../10-security/README.md) secures its edges.
- Modules [`11`](../11-building-blocks/README.md), [`12`](../12-architecture-archetypes/README.md), and [`13`](../13-design-labs/README.md) reuse these routing and boundary patterns.

## Theory completion notes

Each lesson follows the PRD's naive design → failure → improvement → trade-off progression and includes a concrete backend example, a behavior-oriented visualization specification, scaling and failure analysis, alternatives, an interview lens, quiz seeds, relative lesson links, and direct references. The module deliberately treats a gateway and a microservice split as requirement-driven choices; a reverse proxy, managed ingress, modular monolith, queue, cache, or read model may be the simpler answer.

Visualizations and structured quizzes are not registered yet, so the lesson frontmatter intentionally omits `visualizationId` and `quizId`.
