# Module 02 — Networking and Communication

**Status:** Scaffold only. Lesson content and interactive request-path visualizations remain to be authored.

## Purpose

Explain how a client request travels through a system and how protocol and API choices affect latency, reliability, compatibility, coupling, and streaming. The goal is interview-relevant communication reasoning rather than protocol trivia.

## Depth classification

The planned module is **Core**. HTTP/3/QUIC details and nuanced communication trade-offs may be developed as Advanced extensions, but the module's required mental models remain core.

## Prerequisites

- [`00-interview-method`](../00-interview-method/README.md) for requirement and latency framing.
- [`01-foundations`](../01-foundations/README.md) for latency, throughput, availability, and failure vocabulary.

## Intended lesson order

1. `02-01-request-lifecycle` — Client → DNS → CDN → load balancer → gateway/proxy → application → cache → database, with the role and failure cost of each hop.
2. `02-02-dns` — Recursive resolution, authoritative servers, TTL, caching, and geo-aware routing at a high level.
3. `02-03-tcp-vs-udp` — Connection, reliability, ordering, retransmission, and latency implications; QUIC is introduced later without turning the lesson into a networking course.
4. `02-04-http-evolution` — HTTP/1.1, HTTP/2 multiplexing, and HTTP/3/QUIC conceptually.
5. `02-05-rest-rpc-grpc-graphql` — Compare coupling, schema, discoverability, payload, browser fit, internal service use, and streaming.
6. `02-06-realtime-transports` — Short polling, long polling, server-sent events, and WebSockets for a large connected population.
7. `02-07-api-design-interviews` — Resource modeling, pagination (cursor versus offset), filtering, versioning, idempotency keys, error semantics, request IDs, and compatibility.

## Downstream connections

- [`03-traffic-and-services`](../03-traffic-and-services/README.md) adds proxies, load balancers, gateways, and service boundaries to the request path.
- [`06-messaging`](../06-messaging/README.md) extends communication into asynchronous delivery and flow control.
- [`08-reliability`](../08-reliability/README.md) applies timeout and retry behavior to network calls.
- [`09-observability`](../09-observability/README.md) follows the request with trace and span context.
- [`10-security`](../10-security/README.md) adds TLS, identity, authorization, and abuse prevention at communication boundaries.
- Real-time and API lessons feed the chat, presence, ride-hailing, notification, and video labs in [`13-design-labs`](../13-design-labs/README.md).

## Authoring boundary

These entries are intended lesson boundaries and dependency hints, not prose. A future lesson should explain a mechanism through a concrete request path and its failure/trade-off behavior, with references validated before the lesson is considered complete.

