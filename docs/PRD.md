# System Design Visual Learning Lab
## Product Requirements Document

**Working title:** System Design Lab  
**Product type:** Local-first interactive learning web application  
**Primary platform:** Desktop web  
**Framework:** Next.js + TypeScript  
**Primary purpose:** Learn system design for backend/software engineering interviews through a repeatable cycle of:

> **Theory → Interactive Visualization → Quiz → Applied Design**

---

# 1. Product Vision

Build an interactive system-design learning application that teaches the learner to **reason about systems**, rather than memorize architecture diagrams.

Traditional system-design material tends to be dominated by:

- long articles,
- static architecture diagrams,
- lists of technologies,
- memorized solutions to “Design Twitter” style questions.

This application should instead make distributed-system behavior **observable and manipulable**.

Examples:

- Add another server and watch consistent hashing redistribute keys.
- Introduce a network partition and observe different consistency choices.
- Increase QPS and watch queues and latency grow.
- Change `R`, `W`, and `N` and see quorum behavior.
- Kill a leader and watch a simplified leader election.
- Toggle cache strategies and observe stale data and DB traffic.
- Add a retry policy without jitter and observe a retry storm.
- Change transaction isolation and watch concurrent operations produce or avoid anomalies.
- Increase celebrity follower count and compare push vs pull news-feed fanout.
- Change token-bucket parameters and watch requests get admitted or rejected.

The product should answer three questions for every topic:

1. **What is this?**
2. **What happens when the system behaves under load or failure?**
3. **When should I choose this in a system-design interview?**

---

# 2. Product Goals

## Primary goals

The application must enable a learner to:

1. Build strong conceptual foundations in distributed systems.
2. Develop visual intuition for how architectural components behave.
3. Understand trade-offs rather than memorize “best” solutions.
4. Retain concepts using quizzes and repeated retrieval.
5. Learn reusable system-design building blocks.
6. Apply those building blocks to common backend interview questions.
7. Practice a repeatable framework for a 45–60 minute system-design interview.
8. Track which concepts are understood, weak, or not yet studied.

## Secondary goals

The app should:

- be enjoyable enough for repeated study sessions,
- work completely without an external backend,
- store progress locally,
- make adding future lessons easy,
- allow diagrams and simulations to be reused across lessons,
- eventually support interview simulation.

---

# 3. Non-Goals

V1 should **not** attempt to be:

- a general computer-science course,
- a cloud certification course,
- an AWS/GCP/Azure tutorial,
- a Kubernetes tutorial,
- an implementation-heavy backend programming course,
- an AI-generated-content product,
- a collaborative classroom product,
- a production system-design tool such as Lucidchart,
- an exact clone of roadmap.sh.

Vendor technologies may be mentioned as examples, but lessons must primarily teach **vendor-independent concepts**.

For example:

> Teach “distributed log / partition / consumer group / retention / replay” first.

Then show Kafka as a concrete implementation.

Do not teach:

> “Use Kafka because scalable systems use Kafka.”

---

# 4. Target User

Primary persona:

**Backend/software engineer preparing for SDE-2 through senior-level system-design interviews.**

Assume the learner already understands:

- basic programming,
- HTTP APIs,
- basic SQL,
- basic data structures,
- what a server and database are.

Do not assume existing distributed-systems expertise.

The curriculum should support three depth levels:

| Level | Meaning |
|---|---|
| Core | Expected knowledge for most backend system-design interviews |
| Advanced | Important for SDE-2 / senior interviews |
| Deep Dive | Infra-heavy or deeper senior/staff knowledge |

Each lesson should display its level.

---

# 5. Core Learning Philosophy

Every normal concept lesson follows the same learning loop.

## Step 1 — Theory

Explain the concept in plain language.

Theory must answer:

- What problem does this solve?
- Why does the problem exist?
- How does the mechanism work?
- What are the major implementation strategies?
- What are the trade-offs?
- What breaks?
- What metrics matter?
- What alternatives exist?
- Where does it appear in real systems?
- When would I introduce it during an interview?
- What mistakes do candidates commonly make?

Avoid encyclopedia-style writing.

Prefer:

> “Here is the problem → here is the naive design → here is where it fails → here is the mechanism introduced to solve it.”

---

## Step 2 — Visualization

Every visualization must teach behavior, not merely decorate the theory.

The learner should manipulate the system.

Examples of controls:

- request rate,
- number of servers,
- replication factor,
- latency,
- failure probability,
- queue capacity,
- cache TTL,
- cache hit ratio,
- shard count,
- read/write ratio,
- consistency level,
- retry count,
- timeout,
- consumer count,
- partition count.

Visualizations should support:

- Play
- Pause
- Step
- Reset
- Speed
- Scenario presets

Example preset:

> **Scenario: Celebrity post**

Rather than manually configuring 20 controls, the learner can load an illustrative scenario.

---

## Step 3 — Quiz

Each lesson ends with approximately 5–8 questions.

Questions should test:

### Concept recall
“What does eventual consistency guarantee?”

### Trade-off reasoning
“You need the lowest possible write latency and can tolerate stale reads. Which replication approach fits?”

### Failure reasoning
“A downstream service becomes overloaded. Every upstream instance retries five times immediately. What happens?”

### Architecture reasoning
“What would you add first if one database can no longer sustain read traffic?”

### Numerical reasoning
“With 20K requests/sec and an average payload of 10 KB, approximately how much ingress bandwidth is required?”

Questions should not primarily test vocabulary.

Every answer must include an explanation.

---

## Step 4 — Interview Lens

After the quiz, display:

### Interview takeaway

A compact card containing:

- **30-second explanation**
- **When to use**
- **When not to use**
- **Typical follow-up questions**
- **Common trap**

Example:

> **Consistent hashing**
>
> Use when keys or requests need to be distributed across a changing set of nodes while minimizing remapping.
>
> Interview follow-up:
> “What happens when one node owns disproportionately more of the ring?”
>
> Expected direction:
> Virtual nodes.

---

# 6. Curriculum Design

The roadmap should be reorganized into a dependency-based interview curriculum.

Do not simply preserve the roadmap.sh ordering.

---

# PHASE 0 — SYSTEM DESIGN INTERVIEW METHOD

This section should come first because every later concept is used inside this framework.

## 0.1 What System Design Interviews Measure

Topics:

- requirement clarification,
- decomposition,
- scalability reasoning,
- data modeling,
- trade-off reasoning,
- reliability,
- communication,
- depth vs breadth.

### Visualization

Interactive interview timeline:

```text
0–5 min    Requirements
5–10 min   Estimates
10–20 min  APIs + data model
20–30 min  High-level architecture
30–45 min  Deep dives
45–55 min  Bottlenecks + failures
55–60 min  Wrap-up
```

Learner can move blocks and see why spending 35 minutes on requirements is problematic.

---

## 0.2 Functional vs Non-Functional Requirements

Cover:

- functional requirements,
- scale,
- latency,
- consistency,
- availability,
- durability,
- security,
- cost,
- geographic distribution.

Visualization:

Requirement trade-off board.

Example:

> Payment service

Toggle:

- strong consistency,
- low latency,
- global availability.

Show tensions between requirements.

---

## 0.3 Back-of-the-Envelope Estimation

Teach:

- DAU / MAU,
- requests per second,
- peak QPS,
- read/write ratio,
- storage growth,
- bandwidth,
- concurrent connections,
- cache size,
- replication overhead.

Include a permanent **Capacity Calculator** tool.

Visualizations:

- QPS calculator,
- storage growth graph,
- bandwidth estimator,
- concurrency estimator.

Learner should become comfortable with orders of magnitude, not fake precision.

---

## 0.4 The Interview Design Framework

Canonical workflow:

1. Clarify requirements
2. Identify NFRs
3. Estimate scale
4. Define APIs
5. Model data
6. Draw high-level system
7. Find bottlenecks
8. Deep dive
9. Handle failures
10. Discuss trade-offs
11. Summarize

This framework should remain accessible from every design lab.

---

# PHASE 1 — FOUNDATIONS

## 1.1 Performance vs Scalability

Teach:

- performance,
- scalability,
- vertical scaling,
- horizontal scaling,
- bottlenecks.

Visualization:

Start with one server.

Slider:

`QPS: 10 → 100,000`

Show:

- CPU saturation,
- latency,
- rejected requests.

Buttons:

- Upgrade server
- Add server

The learner observes the difference between scale-up and scale-out.

---

## 1.2 Latency vs Throughput

Cover:

- latency,
- throughput,
- average latency,
- p50,
- p95,
- p99,
- tail latency.

Critical addition:

**Do not teach only average latency.**

Visualization:

Animated requests with adjustable service-time distribution.

Show how:

Average = 70 ms

can coexist with:

p99 = 900 ms.

---

## 1.3 Availability and Reliability

Teach:

- reliability,
- availability,
- durability,
- redundancy,
- fault tolerance,
- single points of failure.

Include availability math:

- serial dependencies,
- redundant systems,
- “nines”.

Visualization:

Toggle service availability and see total system availability.

---

## 1.4 CAP Theorem

Teach CAP correctly around **network partitions**.

Explain:

- consistency,
- availability,
- partition tolerance,
- CP behavior,
- AP behavior.

Do not teach CAP as:

> “Pick any two forever.”

Visualization:

Three replicated nodes.

Button:

**Create Network Partition**

Allow learner to select:

- reject requests,
- continue accepting writes.

Animate the consequences.

---

## 1.5 Consistency Models

Teach:

- strong consistency,
- eventual consistency,
- weak consistency,
- read-after-write,
- monotonic reads,
- causal consistency at a high level.

Visualization:

Three replicas with replication delays.

User writes `balance = 500`.

Read from different replicas over time.

---

# PHASE 2 — NETWORKING AND COMMUNICATION

## 2.1 Request Lifecycle

Visualize:

```text
Client
 ↓
DNS
 ↓
CDN
 ↓
Load Balancer
 ↓
API Gateway / Reverse Proxy
 ↓
Application
 ↓
Cache
 ↓
Database
```

The learner should click each hop to see:

- purpose,
- approximate role in latency,
- failure modes.

This becomes the learner's fundamental mental model.

---

## 2.2 DNS

Teach:

- domain resolution,
- recursive resolver,
- authoritative server,
- TTL,
- DNS caching,
- geo-aware DNS at a high level.

Visualization:

Animated resolution chain.

---

## 2.3 TCP vs UDP

Focus on system-design relevance rather than protocol trivia.

Teach:

- connection-oriented vs connectionless,
- reliability,
- ordering,
- retransmission,
- latency implications.

Mention QUIC conceptually as modern context without turning this into a networking course.

---

## 2.4 HTTP

Cover:

- connection lifecycle,
- keep-alive,
- request/response,
- HTTP/1.1,
- HTTP/2 multiplexing,
- HTTP/3 conceptually.

---

## 2.5 REST vs RPC vs gRPC vs GraphQL

Teach trade-offs.

Comparison dimensions:

- coupling,
- schema,
- discoverability,
- payload,
- browser compatibility,
- internal services,
- streaming.

Visualization:

Same operation implemented conceptually through each communication style.

---

## 2.6 WebSockets / Server-Sent Events / Polling

**Added interview topic.**

Teach:

- short polling,
- long polling,
- SSE,
- WebSockets.

Visualization:

100K connected chat users.

Switch transport and observe request/connection behavior.

---

## 2.7 API Design for System Design Interviews

**Added topic.**

Cover:

- resource modeling,
- pagination,
- cursor vs offset pagination,
- filtering,
- versioning,
- idempotency keys,
- error semantics,
- request IDs,
- backward compatibility.

This lesson should focus on architecture-level API design rather than REST syntax.

---

# PHASE 3 — TRAFFIC DISTRIBUTION AND SERVICE ARCHITECTURE

## 3.1 Reverse Proxy vs Load Balancer

Teach similarities and differences.

Visualization:

Requests flow through proxy/LB with backend instances.

---

## 3.2 Load Balancing Algorithms

Cover:

- round robin,
- weighted round robin,
- least connections,
- least response time,
- hashing,
- consistent hashing introduction.

Visualization:

Animated requests distributed among servers.

Controls:

- traffic skew,
- server capacity,
- algorithm.

Display per-server utilization.

---

## 3.3 Layer 4 vs Layer 7 Load Balancing

Use packet/request flow visualization.

---

## 3.4 Health Checks and Failover

Simulate:

- instance death,
- health-check interval,
- false positive,
- traffic drain.

---

## 3.5 Service Discovery

Teach:

- client-side discovery,
- server-side discovery,
- registry,
- dynamic service instances.

---

## 3.6 API Gateway

Cover:

- routing,
- authentication,
- rate limiting,
- request aggregation,
- protocol translation.

Explain why an API gateway is not automatically required.

---

## 3.7 Monolith vs Modular Monolith vs Microservices

Important interview perspective:

Do not present microservices as the default.

Teach:

- organizational scaling,
- deployment boundaries,
- failure boundaries,
- data ownership,
- network complexity,
- operational cost.

Visualization:

Progressively split a monolith.

Show additional network edges and failure possibilities appearing.

---

# PHASE 4 — DATA AND DATABASES

This should be one of the deepest sections of the product.

---

## 4.1 Data Modeling First

Teach choosing storage from access patterns rather than buzzwords.

Start with:

> What are the reads?
>
> What are the writes?
>
> What relationships exist?
>
> What consistency guarantees are required?

---

## 4.2 SQL vs NoSQL

Cover:

- relational,
- key-value,
- document,
- wide-column,
- graph.

Interactive tool:

Give workload characteristics and allow learner to choose a storage model.

Then show trade-offs.

---

## 4.3 ACID Transactions

**Important addition.**

Teach:

- atomicity,
- consistency,
- isolation,
- durability.

Visualization:

Bank transfer:

```text
A -= ₹100
B += ₹100
```

Crash between operations.

Compare transactional vs non-transactional execution.

---

## 4.4 Transaction Isolation

**Major interview-depth addition.**

Teach:

- dirty read,
- non-repeatable read,
- phantom read,
- write skew,
- read committed,
- repeatable read,
- serializable,
- snapshot isolation conceptually.

Visualization:

Two transaction timelines.

Learner presses:

`Step transaction A`

`Step transaction B`

Observe anomalies.

This should be one of the flagship visualizations.

---

## 4.5 Database Indexes

Teach:

- why indexes exist,
- lookup vs scan,
- B-tree intuition,
- composite indexes,
- selectivity,
- covering indexes conceptually,
- write amplification.

Visualization:

10,000-row table.

Run query without index.

Then add index and animate reduced lookup path.

---

## 4.6 B-Tree vs LSM Tree

**Advanced.**

Teach conceptual differences:

- read-heavy vs write-heavy,
- sequential writes,
- memtable,
- SSTables,
- compaction,
- write amplification,
- read amplification.

Visualization:

Insert stream into both structures.

---

## 4.7 Replication

Teach:

- leader/follower,
- synchronous replication,
- asynchronous replication,
- replication lag,
- read replicas,
- failover.

Visualization:

Write to leader.

Watch replicas catch up.

Kill leader.

---

## 4.8 Partitioning / Sharding

Teach:

- horizontal partitioning,
- range sharding,
- hash sharding,
- directory sharding,
- resharding,
- hot partitions.

Visualization:

Distribution histogram across shards.

Use skewed workload preset.

---

## 4.9 Consistent Hashing

**Added as a dedicated lesson.**

Teach:

- naive `hash(key) % N`,
- remapping problem,
- hash ring,
- virtual nodes,
- adding nodes,
- removing nodes,
- hotspots.

Visualization:

Interactive hash ring.

Buttons:

- Add server
- Remove server
- Add 10,000 keys
- Toggle virtual nodes

Show percentage of keys moved.

This should be another flagship visualization.

---

## 4.10 Read/Write Quorums

**Added.**

Teach:

- N,
- R,
- W,
- trade-offs,
- tunable consistency.

Visualization:

Sliders:

```text
N = 3
R = 2
W = 2
```

Show replicas contacted and expected guarantees.

---

## 4.11 Denormalization

Teach when duplicated data can improve read performance and what consistency problems it introduces.

---

## 4.12 Database Connection Pools

**Backend interview addition.**

Show:

```text
1,000 app threads
      ↓
100 DB connections
```

Simulate pool saturation and waiting.

---

## 4.13 Optimistic vs Pessimistic Concurrency

Use:

**Booking the last hotel room**

Two customers attempt reservation simultaneously.

Compare:

- naive update,
- lock,
- optimistic version check.

---

# PHASE 5 — CACHING

## 5.1 Why Cache?

Visualize latency difference between:

- local memory,
- distributed cache,
- DB.

Avoid hardcoding questionable absolute numbers; use illustrative labels or configurable scenarios.

---

## 5.2 Cache Aside

Animate:

```text
Client
 ↓
Service
 ↓
Cache MISS
 ↓
Database
 ↓
Cache SET
 ↓
Response
```

---

## 5.3 Write Through / Write Behind / Refresh Ahead

Each strategy must have an animated timeline.

---

## 5.4 Cache Eviction

Teach:

- TTL,
- LRU,
- LFU,
- capacity constraints.

Interactive cache containing visible keys.

---

## 5.5 Cache Invalidation

Teach why caching creates consistency problems.

Simulate stale records.

---

## 5.6 Cache Stampede

**Important addition.**

Scenario:

10,000 requests for one key immediately after TTL expiry.

Watch all requests hit the DB.

Then enable:

- request coalescing,
- lock,
- TTL jitter,
- stale-while-revalidate.

---

## 5.7 Hot Keys

Visualize Zipf-like popularity distribution.

One key overwhelms one cache node.

Explore:

- replication,
- local cache,
- key splitting,
- request coalescing.

---

## 5.8 Multi-Layer Caching

Visualize:

```text
Browser
 ↓
CDN
 ↓
Application Cache
 ↓
Distributed Cache
 ↓
Database
```

---

# PHASE 6 — ASYNCHRONOUS SYSTEMS AND MESSAGING

## 6.1 Sync vs Async Processing

Show latency impact when sending email:

Synchronous:

```text
Create Order
→ Save Order
→ Generate Invoice
→ Send Email
→ Response
```

Async:

```text
Create Order
→ Save Order
→ Queue Event
→ Response

                Worker → Email
```

---

## 6.2 Message Queue Fundamentals

Teach:

- producers,
- brokers,
- consumers,
- queues,
- acknowledgments.

---

## 6.3 Pub/Sub

Compare queue vs pub/sub visually.

---

## 6.4 Partitions and Consumer Groups

**Important addition.**

Visualization:

Topic with 4 partitions.

Controls:

- partitions,
- consumers,
- producer rate.

Observe scaling limits.

---

## 6.5 Ordering

Teach:

- global ordering,
- partition ordering,
- per-key ordering.

Show why global ordering can reduce scalability.

---

## 6.6 Delivery Semantics

**Major addition.**

Teach:

- at-most-once,
- at-least-once,
- exactly-once semantics,
- duplicates,
- retries.

The lesson must emphasize that end-to-end exactly-once behavior requires careful coordination and cannot be treated as magic.

Visualization:

Crash producer/consumer at configurable stages.

---

## 6.7 Idempotent Consumers

Example:

```text
PaymentProcessed(eventId=123)
```

Deliver event twice.

Naive consumer:

Credits wallet twice.

Idempotent consumer:

Detects duplicate event.

---

## 6.8 Dead Letter Queues

Simulate poison messages and retry exhaustion.

---

## 6.9 Backpressure

Start:

Producer = 1000 msg/s

Consumer = 600 msg/s.

Visualize queue growth.

Allow learner to:

- add consumer,
- throttle producer,
- drop low-priority work,
- increase buffer.

---

## 6.10 Stream Processing vs Batch Processing

Teach:

- batch,
- stream,
- event time,
- windows,
- late events conceptually.

Keep advanced stream-processing internals optional.

---

# PHASE 7 — DISTRIBUTED COORDINATION AND CONSISTENCY

## 7.1 Clocks and Ordering

**Added.**

Teach why wall-clock time cannot always provide reliable distributed ordering.

Introduce:

- logical clocks,
- vector clocks conceptually.

Do not turn this into a mathematical distributed-systems course.

---

## 7.2 Leader Election

Teach why systems elect leaders.

Visualization:

5 nodes.

Kill current leader.

Animate simplified election.

---

## 7.3 Consensus / Raft Intuition

**Advanced but interview-relevant.**

Teach:

- leader,
- followers,
- term,
- replicated log,
- majority,
- leader failure.

Do not attempt to implement production Raft.

Build an educational simulator.

---

## 7.4 Distributed Locks

Teach:

- shared resource,
- lock owner,
- timeout/lease,
- crash scenarios.

---

## 7.5 Leases and Fencing Tokens

**Advanced addition.**

Demonstrate why an expired lock holder can still be dangerous.

Visualization:

Worker A acquires lease.

Worker A pauses.

Lease expires.

Worker B acquires lease.

Worker A resumes.

Use fencing token to reject stale operation.

---

## 7.6 Distributed Transactions

Explain why a transaction spanning independent services is difficult.

Introduce 2PC at conceptual level.

---

## 7.7 Saga Pattern

Teach:

- orchestration,
- choreography,
- compensating transaction.

Visualization:

Order:

```text
Create Order
→ Reserve Inventory
→ Charge Payment
→ Create Shipment
```

Make payment fail.

Watch compensating actions.

---

## 7.8 Transactional Outbox

**Major backend addition.**

Problem:

```text
BEGIN DB TRANSACTION
Save Order
COMMIT

Publish OrderCreated
```

Crash between DB commit and event publish.

Visualize dual-write failure.

Then show:

```text
DB Transaction
 ├─ Order
 └─ Outbox Event
```

followed by relay/CDC.

---

## 7.9 Change Data Capture

Explain database-log-based event propagation conceptually.

---

## 7.10 Event Sourcing and CQRS

Advanced.

Teach separately before combining.

Avoid portraying them as default microservice architecture.

---

# PHASE 8 — RELIABILITY AND FAILURE ENGINEERING

## 8.1 Timeouts

Show why infinite waits consume resources.

---

## 8.2 Retries

Teach:

- retryable vs permanent error,
- bounded retries,
- idempotency.

---

## 8.3 Exponential Backoff + Jitter

Flagship visualization.

500 clients fail simultaneously.

First run:

**Immediate retry**

Observe retry spike.

Second:

**Exponential backoff**

Third:

**Backoff + jitter**

Compare request graphs.

---

## 8.4 Retry Storms

Connect retries to cascading failures.

---

## 8.5 Circuit Breaker

Interactive state machine:

```text
CLOSED
   ↓ failures
OPEN
   ↓ timeout
HALF_OPEN
   ↓ success
CLOSED
```

---

## 8.6 Bulkhead Pattern

Visualize resource isolation.

---

## 8.7 Load Shedding

Show why rejecting some traffic can protect the whole system.

---

## 8.8 Graceful Degradation

Example:

Recommendation service fails.

Option A:

Entire homepage fails.

Option B:

Homepage renders without recommendations.

---

## 8.9 Disaster Recovery

Teach:

- backups,
- failover,
- RPO,
- RTO,
- region failure.

Visualization:

Primary region disappears.

---

## 8.10 Multi-Region Architecture

Cover:

- active/passive,
- active/active,
- geo-routing,
- replication latency,
- data residency conceptually.

---

# PHASE 9 — OBSERVABILITY

## 9.1 Logs vs Metrics vs Traces

Interactive request.

Click:

**Follow Request**

Trace it across:

```text
API Gateway
Order Service
Inventory Service
Payment Service
Database
```

---

## 9.2 Distributed Tracing

Teach:

- trace ID,
- span ID,
- parent-child spans,
- correlation.

Show waterfall.

---

## 9.3 Golden Signals

Teach:

- latency,
- traffic,
- errors,
- saturation.

---

## 9.4 SLI / SLO / SLA

Teach distinctions.

---

## 9.5 Error Budgets

Visualization:

99.9% SLO.

Burn errors quickly and watch budget disappear.

---

## 9.6 Alerting

Teach why alerts should reflect actionable user-impact signals rather than every metric anomaly.

---

## 9.7 Health Checks

Cover:

- liveness,
- readiness,
- dependency health.

---

# PHASE 10 — SECURITY FOR SYSTEM DESIGN

Keep this section architecture-focused.

## Topics

### 10.1 Authentication vs Authorization

### 10.2 Sessions vs Tokens

### 10.3 JWT trade-offs

### 10.4 OAuth / OIDC conceptually

### 10.5 RBAC / ABAC

### 10.6 TLS and encryption

### 10.7 Secrets management

### 10.8 API abuse prevention

### 10.9 Rate limiting

### 10.10 Multi-tenancy and isolation

### 10.11 Noisy Neighbor Problem

Security should appear in design labs rather than existing as an isolated checklist.

---

# PHASE 11 — REUSABLE INTERVIEW BUILDING BLOCKS

These lessons combine several foundational concepts.

---

## 11.1 Rate Limiter

Teach:

- fixed window,
- sliding window log,
- sliding window counter,
- token bucket,
- leaky bucket,
- centralized vs distributed limiter.

Visualization:

Animated token bucket.

Controls:

- capacity,
- refill rate,
- request burst.

---

## 11.2 Distributed Unique ID Generator

Teach alternatives:

- DB auto increment,
- UUID,
- timestamp + node ID + sequence,
- Snowflake-style design.

Interactive bit-layout explorer.

---

## 11.3 Distributed Scheduler

Cover:

- job storage,
- polling,
- ownership,
- retries,
- duplicate execution,
- leases.

---

## 11.4 Search Autocomplete

Teach:

- trie intuition,
- prefix index,
- ranking,
- caching,
- precomputation.

---

## 11.5 Full-Text Search

High-level inverted index visualization.

---

## 11.6 Bloom Filter

Interactive visualization:

- bits,
- hash functions,
- false positives.

Use crawler/cache use cases.

---

## 11.7 Object / Blob Storage

Teach:

- metadata vs blobs,
- multipart uploads,
- checksums,
- replication,
- CDN integration,
- signed URLs conceptually.

---

## 11.8 Notification System

Channels:

- push,
- email,
- SMS.

Teach:

- fanout,
- user preferences,
- queues,
- retries,
- provider failures,
- deduplication.

---

## 11.9 Real-Time Presence

Teach:

- heartbeat,
- expiration,
- connection gateway,
- pub/sub.

---

## 11.10 Geospatial Indexing

Introduce:

- grid,
- geohash,
- quadtree conceptually.

Visualization:

Map-like abstract grid rather than requiring external maps.

---

# PHASE 12 — SYSTEM DESIGN ARCHETYPES

Before full interview problems, teach architectural archetypes.

## 12.1 Read-Heavy System

Typical tools:

- replicas,
- caches,
- CDN,
- denormalization.

---

## 12.2 Write-Heavy System

Typical tools:

- partitioning,
- append logs,
- batching,
- async processing.

---

## 12.3 Fanout System

Examples:

- feeds,
- notifications.

---

## 12.4 Real-Time System

Examples:

- chat,
- multiplayer state,
- presence.

---

## 12.5 Workflow / Transactional System

Examples:

- payment,
- booking,
- order processing.

---

## 12.6 Search / Discovery System

Examples:

- autocomplete,
- search,
- nearby places.

---

## 12.7 Streaming / Media System

Examples:

- video,
- music,
- live streams.

---

# PHASE 13 — INTERVIEW DESIGN LABS

Labs should progressively stop giving the learner answers.

Every lab follows:

```text
Problem
  ↓
Requirements
  ↓
Capacity Estimation
  ↓
API Design
  ↓
Data Model
  ↓
High-Level Design
  ↓
Deep Dive
  ↓
Failure Analysis
  ↓
Trade-offs
  ↓
Reference Architecture
```

---

# Required Design Labs

## Beginner

### 1. URL Shortener

Concepts:

- IDs,
- DB,
- cache,
- redirects,
- read-heavy systems.

### 2. Rate Limiter

Concepts:

- algorithms,
- distributed counters,
- Redis-like storage,
- atomicity.

### 3. Unique ID Generator

Concepts:

- coordination,
- clock,
- node identity.

### 4. Pastebin

Concepts:

- object storage,
- metadata,
- expiration.

---

## Intermediate

### 5. Notification Service

### 6. Chat / Messaging System

### 7. News Feed

### 8. Search Autocomplete

### 9. Web Crawler

### 10. File Sync / Drive

### 11. Metrics and Monitoring Platform

### 12. Distributed Message Queue

---

## Advanced Backend

### 13. Ticket / Hotel Booking System

Must focus heavily on:

- overselling,
- reservation timeout,
- concurrency,
- transaction isolation,
- idempotency.

### 14. E-Commerce Inventory and Ordering

### 15. Payment System

Must focus on:

- ledger,
- idempotency,
- reconciliation,
- eventual workflows,
- failure recovery.

### 16. Digital Wallet

### 17. Distributed Key-Value Store

### 18. Object Storage / S3-Like System

### 19. Ride-Hailing / Nearby Drivers

### 20. Video Streaming Platform

---

# 7. Design Lab Workspace

The design-lab page should contain a lightweight architecture canvas.

Use nodes such as:

- Client
- DNS
- CDN
- Load Balancer
- API Gateway
- Service
- Worker
- Cache
- SQL DB
- NoSQL DB
- Queue
- Pub/Sub
- Object Storage
- Search Index
- Stream
- Scheduler
- External Provider

Learner can:

- drag nodes,
- connect nodes,
- label edges,
- duplicate nodes,
- delete nodes,
- annotate choices.

The product is not trying to automatically determine whether an architecture is “correct.”

Instead provide:

### Guided checklist

Example:

- Have you identified read/write patterns?
- Where does persistent state live?
- What happens if this component fails?
- Can this component scale horizontally?
- Is ordering required?
- What consistency guarantee is required?
- Where could duplicate requests appear?

After completing the design, reveal a reference solution.

Allow:

**My Design / Reference Design**

side-by-side comparison.

---

# 8. Progress Model

Each lesson has:

```text
Not Started
Theory Complete
Visualization Complete
Quiz Passed
Mastered
```

Suggested completion:

- Theory marked complete
- Visualization scenario completed
- Quiz score ≥ 80%

Mastery can later include review performance.

---

# 9. Knowledge Map

The roadmap screen should be a dependency graph rather than a simple checklist.

Example:

```text
Latency
   │
   ├── Load Balancing
   │
   └── Caching
           │
           └── Cache Stampede

Replication
   │
   ├── Consistency
   ├── Quorums
   └── CAP
           │
           └── Distributed KV Store

Queues
   │
   ├── Delivery Semantics
   ├── Idempotency
   ├── Backpressure
   └── Outbox
```

Node states:

- locked,
- available,
- in progress,
- completed,
- mastered.

The learner should be able to zoom and pan.

Clicking a topic opens a preview card:

- description,
- difficulty,
- estimated time,
- prerequisites,
- progress.

---

# 10. Lesson Page UX

Desktop layout:

```text
┌─────────────────────────────────────────────────────────────────┐
│ Header / Search / Progress                                      │
├───────────────┬────────────────────────────────┬────────────────┤
│ Curriculum    │ Lesson                         │ Mental Model   │
│               │                                │                │
│ Foundations   │  Consistent Hashing            │ Key takeaway   │
│ Networking    │                                │                │
│ Database      │  [Theory] [Visual] [Quiz]      │ Interview tip  │
│ Caching       │                                │                │
│ ...           │                                │ Prerequisites  │
└───────────────┴────────────────────────────────┴────────────────┘
```

The main lesson should have a prominent stepper:

```text
1 Theory → 2 Visualize → 3 Quiz → 4 Interview Lens
```

Do not hide visualization underneath a long article.

Visualization should feel like an equal part of the lesson.

---

# 11. Home Dashboard

Dashboard should answer:

> What should I learn next?

Display:

### Continue Learning

Current topic and next action.

### Curriculum Progress

Example:

```text
36 / 120 lessons
30%
```

### Current Module

Progress bar.

### Weak Concepts

Based on quiz mistakes.

### Review Queue

Concepts due for review.

### Recently Completed

Compact list.

### Interview Readiness

Break down:

```text
Fundamentals       █████████░ 90%
Databases          ███████░░░ 70%
Distributed Sys    █████░░░░░ 50%
Messaging          ████████░░ 80%
Reliability        ██████░░░░ 60%
Design Labs        ████░░░░░░ 40%
```

Do not turn this into a fake “FAANG readiness score.”

Show mastery by domain instead.

---

# 12. Search

Global search should find:

- lessons,
- concepts,
- interview questions,
- diagrams,
- terminology.

Examples:

```text
consistent hashing
p99
outbox
write skew
cache stampede
```

Search results should indicate:

- module,
- lesson,
- type,
- completion state.

Keyboard shortcut:

`⌘K / Ctrl+K`

---

# 13. Review Mode

Create a dedicated `/review` route.

Review queue should prioritize:

1. incorrect quiz concepts,
2. partially completed topics,
3. previously mastered topics due for review.

Review cards should be concise.

Potential future spaced-repetition algorithm can be added, but V1 may use deterministic intervals such as:

```text
1 day
3 days
7 days
14 days
30 days
```

---

# 14. Visualization System Architecture

Do not create each visualization as an unrelated one-off component.

Create a reusable simulation framework.

Suggested concepts:

```ts
Simulation
SimulationControls
SimulationTimeline
SimulationNode
SimulationEdge
SimulationEvent
MetricPanel
ScenarioPreset
ExplanationPanel
```

Every simulation should support where applicable:

```text
play()
pause()
step()
reset()
setSpeed()
loadScenario()
```

---

# 15. Visualization Families

Use different rendering strategies for different problems.

## React Flow

Best suited for:

- architecture diagrams,
- service graphs,
- queues,
- request flows,
- design labs,
- failover diagrams.

## SVG

Best suited for:

- consistent hash rings,
- quorum diagrams,
- B-tree concepts,
- token bucket,
- timelines,
- Raft diagrams.

## Canvas

Use only when animations require many moving entities.

Example:

10,000 simulated requests.

The simulation engine should operate on logical entities while rendering only a sampled/aggregated subset.

## Charts

Use for:

- QPS,
- latency,
- p99,
- queue depth,
- cache hit rate,
- error-budget burn,
- shard distribution.

---

# 16. Required Flagship Visualizations

These should receive the highest polish.

1. Request lifecycle
2. Horizontal scaling
3. Tail latency
4. CAP partition simulator
5. Replica lag
6. Load-balancing algorithms
7. Consistent hashing ring
8. Database index lookup
9. Transaction isolation simulator
10. Sharding and hotspots
11. Cache strategies
12. Cache stampede
13. Token bucket
14. Message partitions + consumers
15. Delivery semantics
16. Backpressure
17. Quorum simulator
18. Leader election
19. Distributed locks + fencing
20. Saga
21. Transactional outbox
22. Retry storm / jitter
23. Circuit breaker
24. Distributed tracing
25. Error budget
26. Multi-region failover
27. News-feed fanout
28. Booking concurrency
29. Payment workflow
30. Capacity estimation

---

# 17. Theory Content Schema

Content should be data-driven rather than hardcoded into page components.

Suggested structure:

```text
content/
  curriculum/
    foundations/
    networking/
    databases/
    caching/
    messaging/
    distributed-systems/
    reliability/
    observability/
    security/
    building-blocks/
    labs/
```

Each lesson should contain metadata equivalent to:

```text
id
slug
title
description
module
difficulty
estimatedMinutes
prerequisites
tags
objectives
theorySections
visualizationId
quizId
interviewTakeaways
relatedLessons
```

Theory can be stored as MDX.

Visualization references should point into a registry.

Example conceptual mapping:

```text
consistent-hashing
    ↓
visualizationId: consistent-hash-ring
```

---

# 18. Quiz Schema

Each question should contain:

```text
id
lessonId
difficulty
type
prompt
options
correctAnswer
explanation
conceptTags
```

Initial supported types:

- single choice,
- multi-choice,
- numeric estimate,
- architecture choice.

V1 does not require free-text AI grading.

---

# 19. Quiz UX

After answering:

Do not simply show:

> Correct.

Instead show:

> Correct. Adding read replicas increases aggregate read capacity, but it does not solve write throughput because writes still go through the leader.

For an incorrect answer:

Explain:

1. why the selected option fails,
2. why the correct answer fits,
3. which concept should be revisited.

At end:

```text
5 / 6
83%

Strong:
- replication
- read scaling

Review:
- failover
```

Button:

**Retry weak concepts**

---

# 20. Interactive “What If?” Mode

A core differentiator.

After learning a concept, allow the learner to alter assumptions.

Example:

News feed:

```text
Followers/user     300
Celebrity users    0.1%
Posts/user/day     2
Read/write ratio   100:1
```

Questions:

> What happens if one user has 100M followers?

Change slider.

The visualization should reveal why a pure fanout-on-write approach becomes problematic.

This teaches architecture through **changing constraints**.

---

# 21. Failure Injection

Where relevant, simulations should expose:

**Inject Failure**

Possible failures:

- server crash,
- network partition,
- DB timeout,
- cache outage,
- broker unavailable,
- duplicate message,
- slow consumer,
- leader death,
- region outage,
- replication delay.

The learner should see architecture as something that fails, not as boxes connected by arrows.

---

# 22. Interview Mode

After the standard curriculum exists, support a dedicated interview mode.

Route:

`/interview`

Flow:

### Choose Difficulty

- Beginner
- Intermediate
- SDE-2
- Senior

### Receive Prompt

Example:

> Design a hotel booking system capable of supporting 10M monthly users.

### Timer

Default:

45 minutes.

### Structured workspace

Tabs:

```text
Requirements
Estimation
API
Data Model
Architecture
Deep Dive
Failures
Trade-offs
```

### Finish

Reveal evaluation checklist and reference architecture.

AI evaluation is a future enhancement, not required for initial implementation.

---

# 23. Technology Stack

Use latest stable compatible versions at implementation time.

Recommended baseline:

### Framework

- Next.js
- App Router
- React
- TypeScript strict mode

### Styling

- Tailwind CSS
- shadcn/ui or equivalent primitives

### Diagrams

- React Flow / `@xyflow/react`

### Animation

- Motion
- SVG animation
- CSS transitions for simple interactions

### Charts

Choose a lightweight React charting library appropriate for interactive metrics.

### Local State

- React local state for isolated controls
- Zustand for simulation/workspace state where global coordination is needed

Avoid putting all application state into one global store.

### Persistence

Start local-first:

- IndexedDB preferred for structured progress/history
- localStorage acceptable for lightweight preferences

No server database is required for V1.

---

# 24. Local-First Requirements

The learner should be able to:

- use the app without signing in,
- retain progress between browser sessions,
- export progress,
- import progress,
- reset progress.

Export format:

JSON.

Potential future backend sync should not require rewriting the learning domain model.

Create a persistence abstraction.

Conceptually:

```text
ProgressRepository

LocalProgressRepository
FutureRemoteProgressRepository
```

---

# 25. Next.js Architecture

Prefer Server Components for:

- static curriculum pages,
- lesson metadata,
- theory rendering.

Use Client Components only for:

- simulations,
- quizzes,
- progress interactions,
- design canvas,
- interactive charts.

Heavy simulation components should be dynamically imported where useful.

Do not turn the entire app into one giant client component.

---

# 26. Suggested Route Structure

```text
/
 /roadmap
 /learn
 /learn/[module]
 /learn/[module]/[lesson]
 /labs
 /labs/[lab]
 /interview
 /review
 /search
 /settings
```

Optional tool routes:

```text
/tools/capacity
/tools/latency
/tools/hash-ring
/tools/quorum
/tools/rate-limiter
```

These tools should reuse the exact same visualization components used by lessons.

---

# 27. Suggested Code Organization

```text
src/
├── app/
│   ├── page.tsx
│   ├── roadmap/
│   ├── learn/
│   ├── labs/
│   ├── interview/
│   ├── review/
│   └── settings/
│
├── components/
│   ├── ui/
│   ├── layout/
│   ├── learning/
│   ├── quiz/
│   ├── roadmap/
│   ├── diagrams/
│   └── simulations/
│
├── simulations/
│   ├── core/
│   ├── scaling/
│   ├── cap/
│   ├── load-balancing/
│   ├── consistent-hashing/
│   ├── transactions/
│   ├── caching/
│   ├── messaging/
│   ├── quorum/
│   ├── consensus/
│   ├── retries/
│   └── observability/
│
├── content/
│   ├── curriculum/
│   ├── quizzes/
│   └── labs/
│
├── domain/
│   ├── curriculum/
│   ├── progress/
│   ├── quiz/
│   └── simulation/
│
├── stores/
├── repositories/
├── hooks/
├── lib/
└── types/
```

The exact folder hierarchy may be refined during architecture planning.

---

# 28. UI Direction

Visual identity:

**Technical, calm, dense enough for engineers, but not dashboard-enterprise boring.**

Prefer:

- dark mode first,
- excellent light mode,
- neutral background,
- subtle borders,
- restrained accent colors,
- clear typography,
- diagram-first visual hierarchy,
- minimal gradients,
- high information density without clutter.

Think:

> Developer tool × interactive textbook × architecture simulator.

Avoid:

- excessive glassmorphism,
- neon hacker styling,
- generic AI gradients,
- excessive cards,
- childish gamification.

---

# 29. Diagram Visual Language

Maintain consistent semantics.

Example:

```text
Rectangle       Service
Cylinder        Database
Rounded Queue   Queue / Stream
Diamond         Routing / Decision
Cloud           External System
Stack           Replica Cluster
```

Use consistent colors by category:

```text
Compute
Storage
Networking
Messaging
Caching
External
Failure
```

Exact colors should be chosen by the design system.

Every visualization must remain understandable without relying only on color.

---

# 30. Animation Principles

Animation should communicate:

- request movement,
- data replication,
- queue growth,
- failure,
- recovery,
- state transition.

Animation must not exist merely for decoration.

Respect reduced-motion accessibility settings.

Provide speed control for complex simulations.

---

# 31. Accessibility

Minimum requirements:

- keyboard accessible navigation,
- high contrast,
- reduced-motion support,
- meaningful labels,
- focus states,
- simulations should provide text explanation alongside visual changes,
- do not rely exclusively on animation or color.

---

# 32. Content Quality Requirements

Each theory lesson should contain, where applicable:

1. Motivation
2. Mental model
3. How it works
4. Simple example
5. Scaling behavior
6. Failure behavior
7. Advantages
8. Disadvantages
9. Alternatives
10. When to use
11. When not to use
12. Interview discussion
13. Common misconceptions
14. Summary

Do not artificially force sections that do not make sense for a particular topic.

---

# 33. “Progressive Reveal” Teaching Style

Avoid dumping a finished architecture on screen.

Example for URL shortener:

### Step 1

```text
Client → Server → Database
```

Ask:

> What fails when traffic grows?

### Step 2

Add:

```text
Load Balancer + Server replicas
```

Ask:

> Reads dominate. Where is the bottleneck now?

### Step 3

Add cache.

### Step 4

Partition DB.

### Step 5

Discuss ID generation.

The learner sees architecture **evolve in response to constraints**.

This pattern should be reused heavily.

---

# 34. “Naive → Failure → Improvement” Pattern

Whenever possible, simulations should explicitly expose a naive design.

Example cache lesson:

### Naive

No cache.

### Improvement

Add cache.

### New problem

Cache expires simultaneously.

### Improvement

TTL jitter.

### New problem

Hot key.

### Improvement

Replication/request coalescing.

This prevents the learner from believing architectural components are free improvements.

---

# 35. Cross-Lesson Connections

Lessons should link to prerequisites and consequences.

Example:

**Transactional Outbox**

Prerequisites:

- transactions,
- queues,
- idempotency.

Related:

- CDC,
- saga,
- event-driven architecture.

Used in labs:

- payment,
- e-commerce,
- notification.

The application should make these connections visible.

---

# 36. Glossary

Create an automatically generated glossary from curriculum metadata.

Example entries:

```text
Availability
Backpressure
Bloom Filter
Cache Stampede
CAP
CDC
Consistent Hashing
CQRS
Fanout
Fencing Token
Idempotency
LSM Tree
Quorum
Replication Lag
Saga
Shard
SLO
Write Skew
```

Clicking a term opens a compact explanation and links to its lesson.

---

# 37. Content Priority

## P0 — Must Be Excellent

- interview framework,
- estimation,
- scaling,
- latency,
- availability,
- CAP,
- consistency,
- networking/request path,
- load balancing,
- SQL vs NoSQL,
- indexes,
- transactions,
- isolation,
- replication,
- sharding,
- consistent hashing,
- caching,
- queues,
- delivery semantics,
- idempotency,
- backpressure,
- retries,
- circuit breaker,
- rate limiting,
- observability,
- core design labs.

## P1 — Strong Backend Depth

- quorums,
- DB internals,
- distributed locks,
- leader election,
- saga,
- outbox,
- CDC,
- SLO/error budgets,
- multi-region,
- search,
- object storage,
- distributed scheduler,
- payment and booking labs.

## P2 — Advanced

- Raft deeper intuition,
- vector clocks,
- LSM internals,
- CQRS,
- event sourcing,
- advanced stream processing,
- fencing tokens,
- sophisticated geo indexing.

---

# 38. MVP Definition

Do not try to implement all 100+ lessons and thirty simulations before validating the learning UX.

The first functional milestone should implement the complete application architecture and approximately 10 representative lessons.

Recommended MVP lesson set:

1. System Design Interview Framework
2. Capacity Estimation
3. Latency vs Throughput
4. CAP
5. Load Balancing
6. Database Indexing
7. Transaction Isolation
8. Consistent Hashing
9. Cache Stampede
10. Message Queue + Backpressure
11. Retry + Jitter
12. Rate Limiter

And three design labs:

1. URL Shortener
2. Rate Limiter
3. Booking System

This subset intentionally exercises almost every reusable UI primitive required by the eventual application.

---

# 39. Phase 2

After the learning interaction model is stable:

- complete P0 curriculum,
- build remaining foundational simulations,
- add mastery/review,
- add design canvas,
- add intermediate labs,
- add search and glossary.

---

# 40. Phase 3

Add:

- P1/P2 curriculum,
- advanced distributed-system simulations,
- interview mode,
- deeper design labs,
- optional AI tutor/reviewer.

---

# 41. Future AI Tutor

Do not make AI necessary for learning.

Future optional feature:

**Ask about this architecture**

The tutor receives structured context:

```text
current lesson
current simulation state
selected nodes
learner question
```

Example:

> Why did adding another consumer not increase throughput?

AI knows:

```text
partitions = 3
consumers = 4
```

and can explain that parallelism is currently bounded by partition count.

This would make AI contextually useful instead of becoming a generic chatbot.

---

# 42. Analytics — Local Only

Because this is initially a personal learning application, no external analytics system is necessary.

Track locally:

- lesson completions,
- quiz attempts,
- incorrect concepts,
- simulation scenarios completed,
- time spent if useful,
- design labs attempted.

Do not create fake engagement metrics.

---

# 43. Testing Requirements

## Unit tests

Focus on:

- progress calculation,
- quiz evaluation,
- capacity calculations,
- simulation state transitions,
- persistence.

## Component tests

Focus on:

- quiz interactions,
- lesson navigation,
- progress state.

## Simulation tests

Simulation logic should be separated from visual rendering where practical.

Example:

```text
ConsistentHashSimulationEngine
```

can be tested without rendering SVG.

This is particularly important for deterministic simulations.

## End-to-end

Test:

```text
Open lesson
→ complete theory
→ manipulate visualization
→ answer quiz
→ progress persists after reload
```

---

# 44. Performance Requirements

Target:

- curriculum pages load quickly,
- visualizations load lazily,
- animations remain smooth,
- large simulations aggregate events instead of rendering thousands of DOM nodes,
- roadmap should remain responsive with 100+ topic nodes.

Do not render one DOM element per simulated request at high QPS.

Represent large traffic volumes statistically.

---

# 45. Content Extensibility Requirement

Adding a new lesson should ideally require:

1. Create lesson content.
2. Register metadata.
3. Select or implement visualization.
4. Add quiz.
5. Define prerequisite IDs.

No core navigation component should require modification.

Similarly, adding a visualization should involve registering it in a visualization registry.

---

# 46. Example Lesson Specification

## Lesson

**Consistent Hashing**

Difficulty:

Core / Advanced boundary.

Prerequisites:

- hashing,
- horizontal scaling,
- sharding.

Estimated time:

25 minutes.

### Theory

Start:

> Imagine four cache servers. You choose a server with:
>
> `hash(key) % numberOfServers`
>
> Everything works until one server disappears.

Show why most keys change destinations.

Introduce:

- hash space,
- ring,
- node ownership,
- virtual nodes.

### Visualization

Initial:

```text
4 servers
100 keys
```

Show standard modulo distribution.

Button:

**Remove server**

Display:

```text
Keys remapped: 74%
```

Switch:

**Consistent Hashing**

Repeat.

Display:

```text
Keys remapped: 23%
```

Then enable virtual nodes.

Show improved distribution.

Controls:

- key count,
- servers,
- virtual nodes,
- traffic skew.

### Quiz

Questions around:

- remapping,
- scaling,
- node failure,
- virtual nodes,
- hotspots.

### Interview takeaway

Prompt:

> Why would you use consistent hashing?

Expected concise reasoning:

> To distribute keys across a dynamic cluster while minimizing remapping when nodes join or leave.

Follow-up:

> Does consistent hashing guarantee perfectly balanced traffic?

No.

Introduce:

- virtual nodes,
- hot-key skew,
- heterogeneous node capacity.

---

# 47. Example Cross-Topic Scenario

Create reusable scenario:

## “Black Friday Checkout”

Architecture starts:

```text
Client
  ↓
API
  ↓
Order Service
  ↓
Database
```

Traffic increases.

Learner introduces:

- load balancer,
- more application instances.

Database becomes bottleneck.

Introduce:

- cache for product catalog,
- replicas for reads.

Orders cannot tolerate stale inventory.

Introduce:

- transactional writes,
- concurrency control.

Payment takes time.

Introduce:

- queue.

Worker fails.

Introduce:

- retries,
- idempotency.

DB commits but event disappears.

Introduce:

- transactional outbox.

Metrics indicate p99 spike.

Introduce:

- tracing.

This one scenario can connect many lessons and demonstrate that system design is cumulative.

---

# 48. Success Criteria

The product is successful when a learner who completes the core curriculum can:

1. confidently clarify an ambiguous system-design prompt,
2. perform rough capacity estimates,
3. produce a sensible initial architecture,
4. choose data stores based on requirements,
5. reason about replication and partitioning,
6. identify bottlenecks,
7. discuss consistency trade-offs,
8. introduce caching appropriately,
9. use asynchronous processing appropriately,
10. reason about duplicates and idempotency,
11. explain failure handling,
12. discuss monitoring and reliability,
13. defend architectural decisions,
14. change the architecture when requirements change.

The ultimate learning goal is:

> **Given a new system, derive an architecture from requirements instead of recalling a memorized diagram.**

---

# 49. Instructions to Codex

When implementing this PRD:

1. First produce an architecture and implementation plan.
2. Do not immediately generate the complete application.
3. Identify reusable primitives required for lessons, simulations, quizzes, progress, and design labs.
4. Design the curriculum/content schema before authoring content.
5. Separate simulation logic from rendering.
6. Keep lesson content data-driven.
7. Implement the reusable learning shell.
8. Implement one simple visualization.
9. Implement one complex visualization.
10. Validate the theory → visualization → quiz flow.
11. Then implement the MVP curriculum.
12. Keep the app local-first.
13. Avoid premature backend infrastructure.
14. Avoid an AI dependency.
15. Optimize primarily for desktop learning.
16. Maintain mobile/tablet readability, but complex architecture simulations may use a desktop-optimized experience.
17. Prioritize conceptual correctness and visualization clarity over flashy UI.
18. Every architectural component introduced in a lesson must exist because a demonstrated requirement or failure motivates it.
19. Do not teach technology-name memorization.
20. Make trade-offs the central theme of the entire application.

---

# 50. One-Sentence Product Principle

**Never show the learner a box in an architecture diagram without teaching what problem caused that box to exist.**