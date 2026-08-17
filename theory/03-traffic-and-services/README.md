# Module 03 — Traffic Distribution and Service Architecture

**Status:** Scaffold only. No service-architecture lesson is marked complete.

## Purpose

Show how traffic is routed, balanced, admitted, and moved across changing service instances. Then examine how deployment and ownership boundaries evolve from a monolith to a modular monolith or microservices, including the network and operational costs introduced by each split.

## Depth classification

Traffic distribution is **Core**. Service discovery and service-boundary design are **Advanced** extensions because they require reasoning about dynamic topology, ownership, and organizational scale.

## Prerequisites

- [`01-foundations`](../01-foundations/README.md) for scale, latency, availability, and fault-tolerance concepts.
- [`02-networking`](../02-networking/README.md) for request lifecycle, APIs, and transport behavior.

## Intended lesson order

1. `03-01-reverse-proxy-and-load-balancer` — Clarify the shared and distinct roles of reverse proxies and load balancers.
2. `03-02-load-balancing-algorithms` — Round robin, weighted round robin, least connections, least response time, hashing, and an introduction to consistent hashing.
3. `03-03-l4-vs-l7` — Compare transport-level and request-aware routing.
4. `03-04-health-checks-and-failover` — Instance death, health-check intervals, false positives, draining, and traffic recovery.
5. `03-05-service-discovery` — Registry, client-side discovery, server-side discovery, and dynamic instances.
6. `03-06-api-gateway` — Routing, authentication, rate limiting, aggregation, and protocol translation; explain when a gateway is unnecessary.
7. `03-07-monolith-to-microservices` — Monolith, modular monolith, and microservices as responses to different organizational and operational constraints.
8. `03-08-service-boundaries` — Data ownership, deployment boundaries, network failure edges, and how to choose a split without treating microservices as a default.

## Downstream connections

- [`04-databases`](../04-databases/README.md) uses traffic and ownership boundaries to frame storage scaling and connection pools.
- [`05-caching`](../05-caching/README.md) and [`06-messaging`](../06-messaging/README.md) are introduced where synchronous traffic or service coupling becomes a bottleneck.
- [`08-reliability`](../08-reliability/README.md) extends health checks and failover into timeouts, isolation, and degradation.
- [`09-observability`](../09-observability/README.md) instruments the service graph; [`10-security`](../10-security/README.md) secures its edges.
- Modules [`11`](../11-building-blocks/README.md), [`12`](../12-architecture-archetypes/README.md), and [`13`](../13-design-labs/README.md) reuse these routing and boundary patterns.

## Authoring boundary

The planned lesson order is intentionally a scaffold. Future content should use the PRD's naive design → failure → improvement → trade-off pattern and should not imply that adding a gateway or microservice split is automatically an improvement.

