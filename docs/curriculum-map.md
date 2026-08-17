# System Design Curriculum Map

**Status:** complete canonical dependency map for 135 indexed lessons across Modules 00–13

This document is the dependency-oriented index for the theory curriculum described by [`docs/PRD.md`](./PRD.md) and organized according to [`CODEX.md`](../CODEX.md). It defines module order, lesson IDs, depth, prerequisites, and downstream connections. All 135 canonical theory lessons across Modules 00–13 now have indexed `.mdx` sources, including 20 Markdown-first design labs. Interactive visualizations, structured quizzes, progress, and the design-lab workspace remain separate application milestones.

## How to read this map

Depth uses the PRD vocabulary:

- **Core** — expected knowledge for most backend system-design interviews.
- **Advanced** — important for SDE-2/senior interviews or for composing several core mechanisms.
- **Deep Dive** — infra-heavy or deeper senior/staff material; useful when the prompt or role calls for it.
- **Core / Advanced boundary** — a core mental model with an advanced implementation or failure discussion.

The arrows in a lesson spine are the intended authoring and learning order, not a claim that a learner can never revisit an earlier topic. A module is not complete until its intended lessons satisfy the theory definition of done in `CODEX.md`.

## Global dependency spine

The broad sequence follows the PRD and CODEX theory-creation order:

```text
00 Interview Method
  → 01 Foundations
  → 02 Networking and Communication
  → 03 Traffic Distribution and Service Architecture
  → 04 Data and Databases
  → 05 Caching
  → 06 Asynchronous Systems and Messaging
  → 07 Distributed Coordination and Consistency
  → 08 Reliability and Failure Engineering
  → 09 Observability
  → 10 Security for System Design
  → 11 Reusable Interview Building Blocks
  → 12 System Design Archetypes
  → 13 Interview Design Labs
```

This spine is intentionally cumulative: requirements and estimates frame the design; fundamentals supply the vocabulary for limits and guarantees; networking and service architecture explain request paths; data, cache, and messaging provide the main state and workload tools; coordination and reliability explain cross-node behavior and failure; observability and security make designs operable and safe; building blocks and archetypes prepare the learner for progressively less-scaffolded labs.

## Module registry

| Module | Purpose | Depth center | Prerequisites | Downstream connections |
| --- | --- | --- | --- | --- |
| [00 Interview Method](../theory/00-interview-method/README.md) | Establish the repeatable 45–60 minute interview workflow. | Core | None beyond the PRD's assumed programming, HTTP, and basic SQL knowledge. | Every later module and every design lab. |
| [01 Foundations](../theory/01-foundations/README.md) | Define performance, scale, limits, availability, and consistency vocabulary. | Core, with a few Core / Advanced boundaries. | 00. | 02–13, especially load balancing, databases, caching, messaging, reliability, and labs. |
| [02 Networking](../theory/02-networking/README.md) | Explain the request path and communication choices that connect system components. | Core, with protocol-depth options. | 00–01. | 03 service topology, 06 messaging, 08 failure behavior, 10 security, and real-time labs. |
| [03 Traffic and Services](../theory/03-traffic-and-services/README.md) | Introduce traffic distribution, service discovery, gateways, and service boundaries in response to scale. | Core, with service-boundary depth in Advanced. | 01–02. | 04 data access, 05 caching, 06 async work, 08 resilience, 09 observability, 10 security, 11 blocks, 12 archetypes, and labs. |
| [04 Data and Databases](../theory/04-databases/README.md) | Choose and scale storage from access patterns, consistency, concurrency, and failure requirements. | Deepest module: Core through Deep Dive. | 01–03. | 05 caching, 06/07 state coordination, 08 recovery, 11 blocks, 12 archetypes, and nearly every lab. |
| [05 Caching](../theory/05-caching/README.md) | Show where caching reduces work and which freshness, invalidation, and hot-key costs it introduces. | Core with selected Advanced failure cases. | 01, 03, and relevant 04 storage concepts. | 08 resilience, 11 search/rate/storage blocks, 12 read-heavy/fanout archetypes, and labs. |
| [06 Messaging](../theory/06-messaging/README.md) | Teach asynchronous work, queues, partitions, delivery semantics, and flow control. | Core with Advanced stream-processing edges. | 01–05 as relevant: throughput, APIs, services, data, and caching. | 07 workflows/coordination, 08 retries, 09 tracing, 11 schedulers/notifications, 12 write-heavy/streaming archetypes, and labs. |
| [07 Distributed Coordination](../theory/07-distributed-coordination/README.md) | Explain ordering, leadership, locks, transactions across boundaries, and event propagation. | Advanced, with Deep Dive event-sourcing material. | 01 consistency, 04 replication/transactions, 06 delivery and messaging. | 08 recovery, 09 diagnosis, 11 IDs/schedulers, 12 workflow archetypes, and advanced labs. |
| [08 Reliability](../theory/08-reliability/README.md) | Make timeouts, retries, isolation, degradation, and regional failure explicit design concerns. | Core through Advanced multi-region material. | 01 availability, 03 failover, 06 async failure, and 07 coordination where applicable. | 09 observability, 10 security operations, 11 resilient blocks, 12 archetypes, and all labs. |
| [09 Observability](../theory/09-observability/README.md) | Connect system behavior to logs, metrics, traces, SLOs, and actionable operations. | Core, with Advanced error-budget practice. | 01 latency/availability, 02 request lifecycle, 03 services, 06 messaging, 08 failures. | 10 security operations, 11 blocks, 12 archetypes, and all labs' failure analysis. |
| [10 Security](../theory/10-security/README.md) | Add identity, authorization, encryption, abuse prevention, and tenant isolation to architecture reasoning. | Core with Advanced federation and tenancy. | 02 communication, 03 gateway/service boundaries; use 08–09 for operational context. | 11 rate limiting, 12 archetypes, and security-sensitive labs such as payment, booking, and multi-tenant systems. |
| [11 Building Blocks](../theory/11-building-blocks/README.md) | Combine foundational mechanisms into reusable interview components. | Core to Advanced by block. | Selective 02–10 prerequisites; each block declares its own dependency set. | 12 archetypes and the corresponding 13 design labs. |
| [12 Archetypes](../theory/12-architecture-archetypes/README.md) | Rehearse recurring workload shapes before solving named interview problems. | Core, with streaming/media as Advanced. | 01–11 concepts selected by archetype. | 13 labs; provides the initial architecture lens for every lab. |
| [13 Design Labs](../theory/13-design-labs/README.md) | Apply the interview framework with decreasing scaffolding and explicit trade-offs. | Beginner, Intermediate, and Advanced Backend tracks. | 00 plus lab-specific prerequisites from 01–12. | Future reference architectures, review, and interview mode. |

## Ordered lesson registry

The following IDs are stable curriculum identifiers and each now resolves to an indexed `.mdx` lesson. The bracket after each ID is its intended depth.

### 00 — Interview Method

`00-01-interview-signals` **[Core]** → `00-02-requirements` **[Core]** → `00-03-estimation` **[Core]** → `00-04-interview-framework` **[Core]**

### 01 — Foundations

`01-01-performance-vs-scalability` **[Core]** → `01-02-horizontal-vs-vertical-scaling` **[Core]** → `01-03-latency-vs-throughput` **[Core]** → `01-04-percentiles-tail-latency` **[Core]** → `01-05-availability` **[Core]** → `01-06-reliability` **[Core]** → `01-07-durability` **[Core]** → `01-08-redundancy-and-fault-tolerance` **[Core]** → `01-09-cap` **[Core]** → `01-10-consistency-models` **[Core / Advanced boundary]`

### 02 — Networking and Communication

`02-01-request-lifecycle` **[Core]** → `02-02-dns` **[Core]** → `02-03-tcp-vs-udp` **[Core]** → `02-04-http-evolution` **[Core]** → `02-05-rest-rpc-grpc-graphql` **[Core]** → `02-06-realtime-transports` **[Core]** → `02-07-api-design-interviews` **[Core]`

### 03 — Traffic Distribution and Service Architecture

`03-01-reverse-proxy-and-load-balancer` **[Core]** → `03-02-load-balancing-algorithms` **[Core]** → `03-03-l4-vs-l7` **[Core]** → `03-04-health-checks-and-failover` **[Core]** → `03-05-service-discovery` **[Advanced]** → `03-06-api-gateway` **[Core]** → `03-07-monolith-to-microservices` **[Core]** → `03-08-service-boundaries` **[Advanced]`

### 04 — Data and Databases

`04-01-data-modeling-from-access-patterns` **[Core]** → `04-02-sql-vs-nosql` **[Core]** → `04-03-storage-models` **[Core]** → `04-04-acid-and-transactions` **[Core]** → `04-05-transaction-isolation` **[Core / Advanced boundary]** → `04-06-database-indexes` **[Core]** → `04-07-b-tree-vs-lsm` **[Advanced]** → `04-08-replication` **[Core]** → `04-09-partitioning-and-sharding` **[Core]** → `04-10-consistent-hashing` **[Core / Advanced boundary]** → `04-11-read-write-quorums` **[Advanced]** → `04-12-denormalization` **[Core]** → `04-13-connection-pools` **[Core]** → `04-14-concurrency-control` **[Core]`

### 05 — Caching

`05-01-why-cache` **[Core]** → `05-02-local-and-distributed-cache` **[Core]** → `05-03-cache-aside` **[Core]** → `05-04-write-through-behind-refresh-ahead` **[Core]** → `05-05-eviction-and-ttl` **[Core]** → `05-06-cache-invalidation` **[Core]** → `05-07-cache-stampede` **[Core]** → `05-08-hot-keys` **[Advanced]** → `05-09-multi-layer-caching` **[Core]`

### 06 — Asynchronous Systems and Messaging

`06-01-sync-vs-async` **[Core]** → `06-02-message-queue-fundamentals` **[Core]** → `06-03-pub-sub-and-topics` **[Core]** → `06-04-partitions-and-consumer-groups` **[Core / Advanced boundary]** → `06-05-ordering` **[Core]** → `06-06-delivery-semantics` **[Core / Advanced boundary]** → `06-07-idempotent-consumers` **[Core]** → `06-08-dead-letter-queues` **[Core]** → `06-09-backpressure` **[Core]** → `06-10-batching-and-stream-vs-batch` **[Advanced]`

### 07 — Distributed Coordination and Consistency

`07-01-clocks-and-ordering` **[Advanced]** → `07-02-leader-election` **[Advanced]** → `07-03-consensus-and-raft-intuition` **[Advanced]** → `07-04-distributed-locks` **[Advanced]** → `07-05-leases-and-fencing-tokens` **[Advanced]** → `07-06-distributed-transactions-and-2pc` **[Advanced]** → `07-07-saga-pattern` **[Advanced]** → `07-08-transactional-outbox` **[Core / Advanced boundary]** → `07-09-change-data-capture` **[Advanced]** → `07-10-event-sourcing-and-cqrs` **[Deep Dive]`

### 08 — Reliability and Failure Engineering

`08-01-timeouts` **[Core]** → `08-02-retries` **[Core]** → `08-03-exponential-backoff-and-jitter` **[Core]** → `08-04-retry-storms-and-cascading-failures` **[Core]** → `08-05-circuit-breaker` **[Core]** → `08-06-bulkhead` **[Core]** → `08-07-load-shedding-and-graceful-degradation` **[Core]** → `08-08-disaster-recovery` **[Core]** → `08-09-backups-rpo-rto` **[Core]** → `08-10-multi-region-and-region-failover` **[Advanced]`

### 09 — Observability

`09-01-logs-metrics-and-traces` **[Core]** → `09-02-distributed-tracing` **[Core]** → `09-03-golden-signals` **[Core]** → `09-04-sli-slo-and-sla` **[Core]** → `09-05-error-budgets` **[Advanced]** → `09-06-alerting` **[Core]** → `09-07-health-checks` **[Core]`

### 10 — Security for System Design

`10-01-authentication-and-authorization` **[Core]** → `10-02-sessions-and-tokens` **[Core]** → `10-03-jwt-tradeoffs` **[Core]** → `10-04-oauth-and-oidc` **[Advanced]** → `10-05-rbac-and-abac` **[Core / Advanced boundary]** → `10-06-tls-and-encryption` **[Core]** → `10-07-secrets-management` **[Core]** → `10-08-api-abuse-prevention` **[Core]** → `10-09-multi-tenancy-and-isolation` **[Advanced]`

### 11 — Reusable Interview Building Blocks

`11-01-rate-limiter` **[Core]** → `11-02-distributed-unique-id-generator` **[Core]** → `11-03-distributed-scheduler` **[Advanced]** → `11-04-search-autocomplete` **[Core]** → `11-05-full-text-search` **[Advanced]** → `11-06-bloom-filter` **[Advanced]** → `11-07-object-and-blob-storage` **[Core / Advanced boundary]** → `11-08-notification-system` **[Core]** → `11-09-realtime-presence` **[Core]** → `11-10-geospatial-indexing` **[Advanced]`

### 12 — System Design Archetypes

`12-01-read-heavy` **[Core]** → `12-02-write-heavy` **[Core]** → `12-03-fanout` **[Core]** → `12-04-realtime` **[Core]** → `12-05-transactional-workflow` **[Core]** → `12-06-search-and-discovery` **[Core]** → `12-07-streaming-and-media` **[Advanced]`

### 13 — Interview Design Labs

Labs are ordered by decreasing scaffolding, not by the global module spine. Each lab follows `requirements → estimation → API → data model → architecture → deep dive → failures → trade-offs → reference architecture`.

**Beginner:** `13-01-url-shortener` → `13-02-rate-limiter` → `13-03-unique-id-generator` → `13-04-pastebin`

**Intermediate:** `13-05-notification-service` → `13-06-chat-and-messaging` → `13-07-news-feed` → `13-08-search-autocomplete` → `13-09-web-crawler` → `13-10-file-sync-and-drive` → `13-11-metrics-and-monitoring-platform` → `13-12-distributed-message-queue`

**Advanced Backend:** `13-13-ticket-and-hotel-booking` → `13-14-e-commerce-inventory-and-ordering` → `13-15-payment-system` → `13-16-digital-wallet` → `13-17-distributed-key-value-store` → `13-18-object-storage` → `13-19-ride-hailing-and-nearby-drivers` → `13-20-video-streaming-platform`

## Cross-module dependency edges

These edges explain why a concept appears where it does and make the knowledge graph more useful than a flat checklist.

| Source concept | Enables or informs | Reason |
| --- | --- | --- |
| `00-02-requirements` + `00-03-estimation` | Every later lesson and lab | Architecture choices must answer explicit functional, non-functional, and scale constraints. |
| `01-03-latency-vs-throughput` + `01-04-percentiles-tail-latency` | 03 load balancing, 05 caching, 08 timeouts, 09 SLOs | Capacity and user experience depend on both work rate and tail behavior. |
| `01-09-cap` + `01-10-consistency-models` | 04 replication/quorums, 07 coordination, 08 multi-region | Replicas and partitions force explicit consistency/availability choices. |
| `02-01-request-lifecycle` | 03 traffic/service topology, 09 tracing, 10 TLS | A component can be justified by the hop or boundary where it solves a problem. |
| `03-02-load-balancing-algorithms` + `03-04-health-checks-and-failover` | 04 sharding, 08 failover, 12 archetypes | Distribution and instance health determine how traffic survives change. |
| `04-04-acid-and-transactions` + `04-05-transaction-isolation` | 07 outbox/sagas, 13 booking/payment/wallet labs | Local atomicity and concurrency guarantees bound multi-step workflows. |
| `04-08-replication` + `04-09-partitioning-and-sharding` | 04 quorums/hash, 05 distributed cache, 12 read/write-heavy archetypes | Data scale requires choices about copies, ownership, and rebalancing. |
| `05-06-cache-invalidation` + `05-07-cache-stampede` | 08 degradation, 11 search/notification blocks, 13 read-heavy labs | Caches trade backend load for freshness and coordinated failure modes. |
| `06-06-delivery-semantics` + `06-07-idempotent-consumers` | 07 outbox/saga, 08 retries, 11 notifications/schedulers | At-least-once work needs duplicate-safe side effects. |
| `06-09-backpressure` | 08 load shedding, 12 write-heavy/streaming, 13 messaging labs | A faster producer must not exhaust downstream buffers and workers. |
| `07-04-distributed-locks` + `07-05-leases-and-fencing-tokens` | 11 scheduler/IDs, 13 booking/distributed KV labs | Ownership across nodes needs expiry and stale-holder protection. |
| `07-08-transactional-outbox` + `07-09-change-data-capture` | 13 payment/e-commerce/notification labs | Durable state changes must be propagated without an unsafe dual write. |
| `08-01-timeouts` through `08-07-load-shedding-and-graceful-degradation` | 09 observability and every production-shaped lab | Failure handling is part of the design, not a final checklist. |
| `09-02-distributed-tracing` + `09-04-sli-slo-and-sla` | 12 archetypes and 13 failure analysis | Diagnosis and service objectives turn behavior into operational decisions. |
| `10-08-api-abuse-prevention` | 11 rate limiter, all public-facing labs | Security and capacity protection share admission-control mechanisms. |
| `11` building blocks | 12 archetypes | Reusable components become easier to select once their mechanics are known. |
| `12` archetypes | 13 labs | Workload shape is the bridge from isolated mechanisms to a complete design. |

## Lab prerequisite map

The labs intentionally reuse multiple modules. The listed prerequisites are minimum concept families; a lab may link to additional review topics as its theory is authored.

| Lab track | Labs | Minimum prerequisite families |
| --- | --- | --- |
| Beginner | URL shortener; rate limiter; unique ID generator; Pastebin | 00 framework; 01 scale; 02 API basics; 03 traffic; 04 storage; 05 cache where relevant; 07 coordination for IDs; 11 matching block; 12 read-heavy where relevant. |
| Intermediate | Notification; chat/messaging; news feed; autocomplete; crawler; file sync/Drive; metrics platform; distributed message queue | 00–03; relevant 04 storage/indexing; 05 cache; 06 messaging; 08 reliability; 09 observability; 10 security; 11 matching block; 12 workload archetype. |
| Advanced Backend | Booking; e-commerce; payment; wallet; distributed KV; object storage; ride-hailing; video streaming | 00 framework and estimation; 01–10 as the design demands; 07 coordination for consistency/workflows; 08–09 operations; relevant 11 block and 12 archetype. |

## Progress and completion semantics

The PRD progress model applies at lesson level:

```text
Not Started → Theory Complete → Visualization Complete → Quiz Passed → Mastered
```

At the current theory-authoring stage:

- all 14 module directories and READMEs describe completed theory contents;
- Modules 00–13 contain 135 indexed `.mdx` lessons with interview lenses, quiz seeds, cross-links, annotated authoritative references, and future visualization specifications;
- Module 13 contributes 20 theory/reference labs; their interactive workspace remains future work;
- interactive visualizations and structured quizzes remain future application work and are not implied by theory completion;
- each completed module has passed the theory definition of done in `CODEX.md` and deterministic schema, relationship, cycle, path, and local-link validation.
