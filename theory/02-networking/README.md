# Module 02 — Networking and Communication

**Status:** Theory complete. Interactive request-path visualizations and structured quizzes remain future work; each lesson includes a behavior-focused visualization specification and quiz seeds.

## Purpose

Explain how a client request travels through a system and how protocol and API choices affect latency, reliability, compatibility, coupling, and streaming. The goal is interview-relevant communication reasoning rather than protocol trivia.

## Depth classification

The planned module is **Core**. HTTP/3/QUIC details and nuanced communication trade-offs may be developed as Advanced extensions, but the module's required mental models remain core.

## Prerequisites

- [`00-interview-method`](../00-interview-method/README.md) for requirement and latency framing.
- [`01-foundations`](../01-foundations/README.md) for latency, throughput, availability, and failure vocabulary.

## Intended lesson order

1. [`02-01-request-lifecycle`](./request-lifecycle.mdx) — Client → DNS → CDN → load balancer → gateway/proxy → application → cache → database, with the role and failure cost of each hop.
2. [`02-02-dns`](./dns.mdx) — Recursive resolution, authoritative servers, TTL, caching, negative answers, and geo-aware routing at a high level.
3. [`02-03-tcp-vs-udp`](./tcp-vs-udp.mdx) — Connection, reliability, ordering, retransmission, congestion, and latency implications; QUIC is introduced as a secure multiplexed transport over UDP.
4. [`02-04-http-evolution`](./http-evolution.mdx) — HTTP/1.1, HTTP/2 framing/multiplexing, and HTTP/3/QUIC behavior, including fallback and head-of-line trade-offs.
5. [`02-05-rest-rpc-grpc-graphql`](./rest-rpc-grpc-graphql.mdx) — Compare resource and operation contracts, schema/coupling, payload shape, browser fit, internal service use, streaming, and query cost.
6. [`02-06-realtime-transports`](./realtime-transports.mdx) — Short polling, long polling, server-sent events, and WebSockets for connected populations, including reconnect, replay, fan-out, and backpressure.
7. [`02-07-api-design-interviews`](./api-design-interviews.mdx) — Resource modeling, cursor versus offset pagination, filtering, versioning, compatibility, idempotency keys, error semantics, request IDs, and asynchronous status.

## Downstream connections

- [`03-traffic-and-services`](../03-traffic-and-services/README.md) adds proxies, load balancers, gateways, and service boundaries to the request path.
- [`06-messaging`](../06-messaging/README.md) extends communication into asynchronous delivery and flow control.
- [`08-reliability`](../08-reliability/README.md) applies timeout and retry behavior to network calls.
- [`09-observability`](../09-observability/README.md) follows the request with trace and span context.
- [`10-security`](../10-security/README.md) adds TLS, identity, authorization, and abuse prevention at communication boundaries.
- Real-time and API lessons feed the chat, presence, ride-hailing, notification, and video labs in [`13-design-labs`](../13-design-labs/README.md).

## Authoring boundary

The seven indexed lessons follow the theory template, use stable curriculum IDs, link to their Module 00–02 prerequisites and related topics, and include verified protocol/API references. Future interactive work should preserve their requirement-first progression instead of presenting a finished request architecture before its constraints, failure behavior, and trade-offs are established.
