# CODEX.md

# System Design Visual Learning Lab — Codex Operating Guide

This file is the persistent operating manual for Codex while building the **System Design Visual Learning Lab**.

Codex must read this file before making project-wide changes.

This file serves two purposes:

1. **Implementation instructions and architectural constraints**
2. **Living progress tracker for what has been built and what remains**

Update this file whenever a meaningful milestone, feature, curriculum section, or architectural decision changes.

---

# 1. Product Goal

Build a local-first interactive system-design learning application for backend/software engineering interviews.

The learning loop is:

> **Theory → Visualization → Quiz → Interview Lens → Applied Design**

The project must prioritize:

- conceptual correctness,
- interview relevance,
- progressive learning,
- interactive visual intuition,
- trade-off reasoning,
- failure reasoning,
- reusable teaching primitives.

The app is not meant to be a collection of static system-design notes.

The learner should understand **why an architectural component exists, what problem it solves, and what breaks without it**.

---

# 2. Core Product Principle

> **Never show the learner a box in an architecture diagram without teaching what problem caused that box to exist.**

Every architecture concept should preferably use:

> **Naive Design → Failure / Limitation → Improved Design → New Trade-off**

---

# 3. Source of Truth

The main PRD lives under:

```text
docs/
  PRD.md
```

Additional design, architecture, implementation, and curriculum documents belong in `docs/`.

Codex should not silently diverge from the PRD.

If implementation constraints require a meaningful deviation:

1. document the decision,
2. explain the trade-off,
3. add/update the relevant document in `docs/`,
4. update the decision log in this file.

---

# 4. Project Strategy

Do **not** build the entire application or all visualizations up front.

The project uses a **theory-first, incremental-app** strategy.

## Phase A — Build the complete theory curriculum first

Create the complete curriculum structure and high-quality theory material for all planned topics.

Each theory lesson should include references to:

- official documentation where appropriate,
- respected engineering articles,
- research papers where useful,
- high-quality educational websites,
- high-quality YouTube videos.

The theory content should be useful even before an interactive visualization exists.

## Phase B — Build the learning application shell

Implement only enough app infrastructure to browse and study the theory curriculum cleanly.

## Phase C — Add interactive learning components incrementally

Add:

- visualization,
- simulation,
- quiz,
- interview lens,
- design labs,

one topic or topic-family at a time.

Do not block theory authoring on application development.

---

# 5. Intended Repository Structure

Target structure:

```text
.
├── CODEX.md
├── README.md
│
├── docs/
│   ├── PRD.md
│   ├── architecture.md
│   ├── curriculum-map.md
│   ├── content-guidelines.md
│   ├── visualization-guidelines.md
│   ├── testing-strategy.md
│   └── decisions/
│       └── ADR-*.md
│
├── theory/
│   ├── 00-interview-method/
│   ├── 01-foundations/
│   ├── 02-networking/
│   ├── 03-traffic-and-services/
│   ├── 04-databases/
│   ├── 05-caching/
│   ├── 06-messaging/
│   ├── 07-distributed-coordination/
│   ├── 08-reliability/
│   ├── 09-observability/
│   ├── 10-security/
│   ├── 11-building-blocks/
│   ├── 12-architecture-archetypes/
│   └── 13-design-labs/
│
├── src/
│   ├── app/
│   ├── components/
│   ├── content/
│   ├── domain/
│   ├── hooks/
│   ├── lib/
│   ├── repositories/
│   ├── simulations/
│   ├── stores/
│   └── types/
│
├── public/
├── tests/
└── package.json
```

The exact application structure may evolve, but these top-level responsibilities should remain clear:

- `docs/` → product and technical documentation
- `theory/` → human-readable curriculum content
- `src/` → application code
- `tests/` → automated tests
- `CODEX.md` → Codex instructions + progress tracking

---

# 6. Theory Directory Rules

Theory files should be organized by curriculum dependency and topic family.

Example:

```text
theory/
└── 04-databases/
    ├── README.md
    ├── 01-data-modeling/
    │   └── README.md
    ├── 02-sql-vs-nosql/
    │   └── README.md
    ├── 03-acid-transactions/
    │   └── README.md
    ├── 04-transaction-isolation/
    │   ├── README.md
    │   ├── dirty-read.md
    │   ├── non-repeatable-read.md
    │   ├── phantom-read.md
    │   └── write-skew.md
    ├── 05-indexes/
    │   └── README.md
    └── ...
```

Prefer directories when a concept naturally contains meaningful subtopics.

Do not create hundreds of tiny files for trivial distinctions.

The directory hierarchy should help the learner navigate the curriculum.

---

# 7. Theory Lesson Template

Every substantial theory lesson should follow this general structure.

Not every heading is mandatory when it does not apply.

```md
# Topic Name

## Why This Exists

Explain the problem that motivates the concept.

## Mental Model

Give the simplest useful conceptual model.

## How It Works

Explain mechanics.

## Example

Use a concrete backend/system-design scenario.

## Visualization We Eventually Want

Describe the future interactive visualization or simulation.

Do not implement it merely because this section exists.

## Scaling Behavior

What changes under more traffic, more data, or more nodes?

## Failure Modes

What can go wrong?

## Trade-offs

What do we gain and what do we pay?

## Alternatives

What competing approaches exist?

## When to Use

Interview-relevant decision criteria.

## When Not to Use

Prevent cargo-cult architecture.

## Interview Lens

Include:

- 30-second explanation,
- when to introduce this concept,
- common interviewer follow-ups,
- common candidate mistakes.

## Quiz Seeds

Add 5–10 question ideas.

These are seeds only unless the quiz system for this topic already exists.

## Related Topics

Link to prerequisites and downstream concepts.

## References

### Documentation / Articles

- [Title](URL) — one-line reason this source is useful

### Papers

- [Title](URL) — when relevant

### Videos

- [Title](URL) — channel / author and what it explains well
```

---

# 8. Theory Writing Quality Rules

Theory must be written for an engineer preparing for backend interviews.

Avoid:

- textbook filler,
- unexplained jargon,
- superficial bullet dumps,
- vendor-specific marketing language,
- definitions without practical consequences,
- presenting one architecture as universally correct.

Prefer:

- concrete examples,
- progressive explanation,
- diagrams in Mermaid or ASCII where useful,
- “what changes if...” reasoning,
- latency / throughput / scale examples,
- failure scenarios,
- interview framing.

Every lesson should answer:

1. What problem does this solve?
2. Why does the problem appear?
3. What is the simplest mental model?
4. What happens under scale?
5. What happens under failure?
6. What trade-offs are introduced?
7. What alternative design could be chosen?
8. When should this be mentioned in an interview?

---

# 9. Reference Quality Rules

Theory must include external references.

Reference selection matters.

Prefer primary and authoritative sources:

1. official documentation,
2. original engineering papers,
3. engineering blogs from companies operating relevant systems,
4. respected educational resources,
5. strong university lectures,
6. high-quality YouTube educators.

Avoid relying heavily on:

- SEO content farms,
- shallow interview-prep blogs,
- copied summaries,
- random Medium posts without technical depth.

For YouTube, prioritize videos that genuinely explain the concept visually or intuitively.

Good categories include:

- university distributed systems lectures,
- conference talks,
- engineering talks,
- ByteByteGo-style visual explanations,
- Hussein Nasser,
- Jordan Has No Life,
- Gaurav Sen,
- System Design Interview,
- official database/cloud/project channels,

when the specific video is high quality and relevant.

Do not include videos merely to satisfy a quota.

---

# 10. Link Validation

When adding references:

- verify that the URL resolves,
- prefer stable canonical URLs,
- prefer direct documentation/article/video links,
- avoid search-result links,
- avoid URL shorteners.

If the content has a publication/update date and freshness matters, note it.

---

# 11. Curriculum Scope

The complete curriculum is defined in `docs/PRD.md`.

High-level modules:

```text
00 Interview Method
01 Foundations
02 Networking and Communication
03 Traffic Distribution and Service Architecture
04 Data and Databases
05 Caching
06 Asynchronous Systems and Messaging
07 Distributed Coordination and Consistency
08 Reliability and Failure Engineering
09 Observability
10 Security for System Design
11 Reusable Interview Building Blocks
12 System Design Archetypes
13 Interview Design Labs
```

Theory creation should eventually cover the full curriculum.

---

# 12. Theory Creation Order

Theory should be authored in dependency order.

Recommended sequence:

```text
00 Interview Method
↓
01 Foundations
↓
02 Networking
↓
03 Traffic and Services
↓
04 Databases
↓
05 Caching
↓
06 Messaging
↓
07 Distributed Coordination
↓
08 Reliability
↓
09 Observability
↓
10 Security
↓
11 Building Blocks
↓
12 Archetypes
↓
13 Design Labs
```

Within a module, foundational concepts should precede advanced concepts.

---

# 13. App Development Philosophy

The web app should be built **as required by the curriculum**, not as a giant speculative framework.

Avoid building infrastructure for hypothetical future features too early.

Example:

Do not build a generic simulation DSL before two or three real simulations demonstrate what abstractions are actually shared.

Prefer:

```text
build real feature
→ identify duplication
→ extract reusable abstraction
```

over:

```text
invent framework
→ attempt to force every future simulation into it
```

---

# 14. Technology Direction

Target stack:

- Next.js
- App Router
- React
- TypeScript with strict mode
- Tailwind CSS
- shadcn/ui or equivalent accessible primitives
- `@xyflow/react` / React Flow for architecture graphs
- Motion for animation
- SVG for algorithmic visualizations
- lightweight charting where appropriate
- Zustand only when state genuinely needs shared client ownership
- IndexedDB for structured local progress
- localStorage for lightweight preferences

Use current stable compatible versions when implementation starts.

Do not pin versions in this file unless the project has already selected them.

---

# 15. Next.js Rules

Prefer Server Components for:

- static theory content,
- curriculum navigation,
- metadata,
- glossary pages.

Use Client Components only where interaction requires them:

- quizzes,
- simulations,
- progress state,
- design canvas,
- interactive charts,
- local settings.

Do not mark broad page trees as `"use client"` unnecessarily.

Use dynamic imports for expensive simulation components when useful.

---

# 16. Content Rendering Strategy

Human-authored source files live in `theory/`.

The application may build a content index from these files.

Preferred approach:

```text
theory Markdown/MDX
        ↓
build-time content index
        ↓
Next.js lesson routes
```

Do not duplicate lesson text into TypeScript objects.

Metadata may be represented through frontmatter if useful.

Example:

```yaml
---
id: consistent-hashing
title: Consistent Hashing
module: databases
difficulty: core
estimatedMinutes: 25
prerequisites:
  - hashing
  - horizontal-scaling
tags:
  - partitioning
  - caching
  - distributed-systems
---
```

Keep actual theory prose in Markdown/MDX.

---

# 17. Content and Application Separation

A theory file should remain understandable when opened directly in GitHub or an editor.

Do not make essential educational content depend on React components.

Interactive components can enhance theory but should not replace it.

---

# 18. Visualization Development Rules

Visualizations exist to demonstrate behavior.

Do not build animations that are merely decorative.

A visualization should answer at least one of:

- how requests flow,
- how data moves,
- how nodes coordinate,
- how load distributes,
- how failure propagates,
- how latency changes,
- how queues grow,
- how consistency changes,
- how a design responds to changing assumptions.

Prefer controls such as:

- Play
- Pause
- Step
- Reset
- Speed
- Scenario
- Failure injection

only where meaningful.

---

# 19. Visualization Build Order

Do not implement all visualizations at once.

Recommended first visualizations:

1. Horizontal scaling / saturation
2. Tail latency
3. CAP partition simulator
4. Load balancing
5. Consistent hashing
6. Transaction isolation
7. Cache stampede
8. Queue + backpressure
9. Retry + jitter
10. Token bucket rate limiter

These cover multiple visualization families and expose reusable primitives naturally.

---

# 20. Simulation Engineering Rules

Separate simulation logic from rendering where practical.

Preferred shape:

```text
simulation model
      ↓
events / state
      ↓
renderer
```

Simulation logic should be testable without a browser when reasonable.

Use deterministic random seeds for tests when simulations involve randomness.

Do not render one DOM element for every logical request when modeling large QPS.

Aggregate or sample traffic.

---

# 21. Quiz Development

Do not generate every quiz before the learning flow is validated.

During theory-first phase:

- add `Quiz Seeds` to each lesson,
- preserve enough concept tags to later build quizzes.

When quiz support exists for a topic, migrate those seeds into structured quiz data.

Quiz questions should emphasize:

- reasoning,
- trade-offs,
- failure behavior,
- capacity estimation,
- architecture decisions.

Avoid trivia-heavy quizzes.

---

# 22. Progress Persistence

The product is local-first.

Progress should eventually track:

```text
Not Started
Theory Complete
Visualization Complete
Quiz Passed
Mastered
```

Persist:

- lesson state,
- quiz attempts,
- incorrect concept tags,
- completed simulations/scenarios,
- design-lab attempts,
- review status.

Do not require authentication for the core product.

---

# 23. Progress Repository Abstraction

When persistence is implemented, avoid coupling UI directly to IndexedDB.

Use a domain abstraction similar to:

```ts
interface ProgressRepository {
  getLessonProgress(...): Promise<...>
  saveLessonProgress(...): Promise<void>
  exportProgress(...): Promise<...>
  importProgress(...): Promise<void>
}
```

Initial implementation:

```text
IndexedDbProgressRepository
```

Future remote sync should not require rewriting learning components.

---

# 24. Testing Rules

Add tests based on risk rather than chasing arbitrary coverage.

Prioritize:

- curriculum index generation,
- broken internal links,
- progress calculations,
- persistence,
- quiz evaluation,
- deterministic simulation logic,
- design-lab state,
- critical navigation.

Every major simulation should have tests for state transitions where feasible.

---

# 25. Content Validation

Eventually add tooling to validate theory content.

Useful validations:

- unique lesson IDs,
- valid prerequisites,
- no circular dependencies,
- valid internal links,
- required metadata fields,
- duplicate slugs,
- missing references,
- broken local asset links.

Do not build a complex validator before enough content exists to justify it.

---

# 26. Documentation Rules

Meaningful technical decisions should be documented.

Use `docs/decisions/ADR-*.md` when a decision:

- constrains architecture,
- affects many future features,
- would be expensive to reverse,
- has meaningful alternatives.

Examples:

- Markdown vs MDX
- content indexing approach
- IndexedDB library choice
- simulation state architecture
- React Flow integration strategy

Do not create ADRs for trivial implementation details.

---

# 27. Git / Change Discipline

For substantial tasks:

1. inspect current repository state,
2. identify relevant docs and existing patterns,
3. implement the smallest coherent unit,
4. run tests/lint/typecheck,
5. update documentation where behavior changed,
6. update the progress tracker in this file.

Do not refactor unrelated code during feature work unless necessary.

---

# 28. Definition of Done — Theory Lesson

A theory lesson is considered complete when:

- [ ] correct location and filename exist
- [ ] metadata exists if the project uses frontmatter
- [ ] motivation/problem is clearly explained
- [ ] mental model is explained
- [ ] mechanics are explained
- [ ] concrete example exists
- [ ] scaling behavior is covered where relevant
- [ ] failure modes are covered where relevant
- [ ] trade-offs are explicit
- [ ] alternatives are discussed
- [ ] interview lens exists
- [ ] quiz seeds exist
- [ ] prerequisite/related-topic links exist
- [ ] external references exist
- [ ] references were validated
- [ ] YouTube references exist when a strong video adds value
- [ ] content is understandable without the web app

---

# 29. Definition of Done — Interactive Lesson

An interactive lesson is considered complete when:

- [ ] theory renders correctly
- [ ] visualization teaches a real behavior
- [ ] visualization has appropriate controls
- [ ] failure/scenario behavior is included where useful
- [ ] quiz exists
- [ ] answer explanations exist
- [ ] interview lens exists
- [ ] progress persists
- [ ] relevant tests exist
- [ ] accessibility has been checked
- [ ] reduced motion is respected where relevant

---

# 30. Definition of Done — Design Lab

A design lab is considered complete when:

- [ ] problem statement exists
- [ ] functional requirements prompts exist
- [ ] non-functional requirement prompts exist
- [ ] estimation section exists
- [ ] API section exists
- [ ] data model section exists
- [ ] architecture workspace exists
- [ ] bottleneck prompts exist
- [ ] failure prompts exist
- [ ] trade-off prompts exist
- [ ] reference solution exists
- [ ] design rationale exists
- [ ] related curriculum concepts are linked

---

# 31. Do Not Do These Things

Codex should avoid:

- building the whole curriculum UI before theory exists,
- generating low-quality AI filler to claim curriculum completion,
- writing theory without references,
- copying external content verbatim,
- introducing technologies without explaining the underlying concept,
- treating microservices as the default architecture,
- treating Kafka/Redis/Postgres/etc. as magical solutions,
- teaching CAP as “choose any two” without partition context,
- claiming exactly-once delivery is trivial,
- optimizing architecture prematurely,
- building a complex backend for a local-first personal learning app,
- creating visualizations that are just animated static diagrams,
- adding AI chat before the core learning experience works,
- silently changing the PRD.

---

# 32. Research Workflow for Theory

When creating or substantially revising theory:

1. read the relevant PRD curriculum section,
2. identify prerequisites,
3. research authoritative sources,
4. gather 3–8 strong references,
5. gather useful videos where available,
6. synthesize the concept in original language,
7. create the lesson using the standard lesson structure,
8. add links to prerequisite and next concepts,
9. add future visualization specification,
10. add quiz seeds,
11. validate links,
12. update curriculum progress below.

Do not copy source wording except for short attributed quotations where absolutely needed.

---

# 33. Theory Reference Baseline

Useful recurring reference families include:

## Distributed Systems

- MIT distributed systems course material
- Stanford distributed systems material
- Martin Kleppmann talks/material
- original research papers
- Google research publications
- AWS Builders' Library
- Cloudflare engineering
- Netflix engineering
- Stripe engineering
- Uber engineering
- Meta engineering

## Databases

- PostgreSQL documentation
- MySQL documentation
- database papers
- CMU Database Group lectures
- vendor engineering blogs when explaining actual implementations

## Networking

- MDN
- RFCs where readable/relevant
- Cloudflare learning center / engineering
- protocol documentation

## Messaging

- Apache Kafka documentation
- RabbitMQ documentation
- relevant papers and engineering articles

## Reliability

- Google SRE material
- AWS Builders' Library
- resilience engineering talks

## Videos

Use strong individual videos, not channels blindly.

Possible educators/channels when appropriate:

- Hussein Nasser
- ByteByteGo
- Gaurav Sen
- Jordan Has No Life
- CMU Database Group
- MIT OpenCourseWare
- conference talks from QCon / Strange Loop / InfoQ
- official project/vendor channels

---

# 34. Curriculum Progress Tracking

This section is intentionally maintained manually by Codex.

Legend:

```text
[ ] Not started
[~] In progress
[x] Complete
```

A module should only be marked complete when all intended theory lessons in that module satisfy the theory definition of done.

---

## 00 — Interview Method

- [x] Module structure
- [x] What System Design Interviews Measure
- [x] Functional vs Non-Functional Requirements
- [x] Back-of-the-Envelope Estimation
- [x] Interview Design Framework
- [x] Capacity calculator theory/examples
- [x] Module review / cross-links

Status: **Complete**

---

## 01 — Foundations

- [x] Module structure
- [x] Performance vs Scalability
- [x] Horizontal vs Vertical Scaling
- [x] Latency vs Throughput
- [x] Percentiles / Tail Latency
- [x] Availability
- [x] Reliability
- [x] Durability
- [x] Fault Tolerance / Redundancy
- [x] CAP Theorem
- [x] Consistency Models
- [x] Module review / cross-links

Status: **Complete**

---

## 02 — Networking and Communication

- [x] Module structure
- [x] Request Lifecycle
- [x] DNS
- [x] TCP vs UDP
- [x] HTTP/1.1
- [x] HTTP/2
- [x] HTTP/3 / QUIC overview
- [x] REST
- [x] RPC
- [x] gRPC
- [x] GraphQL
- [x] Polling
- [x] Long Polling
- [x] Server-Sent Events
- [x] WebSockets
- [x] API Design for Interviews
- [x] Cursor vs Offset Pagination
- [x] API Versioning
- [x] Idempotency Keys
- [x] Module review / cross-links

Status: **Complete**

---

## 03 — Traffic Distribution and Service Architecture

- [x] Module structure
- [x] Reverse Proxy
- [x] Load Balancer
- [x] L4 vs L7 Load Balancing
- [x] Load-Balancing Algorithms
- [x] Health Checks
- [x] Failover
- [x] Service Discovery
- [x] API Gateway
- [x] Monolith
- [x] Modular Monolith
- [x] Microservices
- [x] Service Boundaries
- [x] Module review / cross-links

Status: **Complete**

---

## 04 — Data and Databases

- [x] Module structure
- [x] Data Modeling from Access Patterns
- [x] SQL vs NoSQL
- [x] Relational Databases
- [x] Key-Value Stores
- [x] Document Databases
- [x] Wide-Column Databases
- [x] Graph Databases
- [x] ACID
- [x] Transactions
- [x] Isolation Levels
- [x] Dirty Reads
- [x] Non-Repeatable Reads
- [x] Phantom Reads
- [x] Write Skew
- [x] Database Indexes
- [x] B-Tree Intuition
- [x] Composite Indexes
- [x] Covering Indexes
- [x] Index Trade-offs
- [x] LSM Trees
- [x] B-Tree vs LSM
- [x] Replication
- [x] Synchronous vs Asynchronous Replication
- [x] Replication Lag
- [x] Read Replicas
- [x] Leader Failover
- [x] Partitioning / Sharding
- [x] Range Sharding
- [x] Hash Sharding
- [x] Directory-Based Sharding
- [x] Rebalancing
- [x] Hot Partitions
- [x] Consistent Hashing
- [x] Virtual Nodes
- [x] Read / Write Quorums
- [x] Denormalization
- [x] Connection Pools
- [x] Optimistic Concurrency Control
- [x] Pessimistic Locking
- [x] Module review / cross-links

Status: **Complete**

---

## 05 — Caching

- [x] Module structure
- [x] Why Cache
- [x] Local vs Distributed Cache
- [x] Cache Aside
- [x] Write Through
- [x] Write Behind
- [x] Refresh Ahead
- [x] TTL
- [x] LRU
- [x] LFU
- [x] Cache Invalidation
- [x] Cache Stampede
- [x] TTL Jitter
- [x] Request Coalescing
- [x] Hot Keys
- [x] Multi-Layer Caching
- [x] CDN as Cache
- [x] Module review / cross-links

Status: **Complete**

---

## 06 — Asynchronous Systems and Messaging

- [x] Module structure
- [x] Sync vs Async Processing
- [x] Message Queue Fundamentals
- [x] Pub/Sub
- [x] Topics
- [x] Partitions
- [x] Consumer Groups
- [x] Ordering
- [x] At-Most-Once
- [x] At-Least-Once
- [x] Exactly-Once Semantics
- [x] Idempotent Consumers
- [x] Dead Letter Queues
- [x] Backpressure
- [x] Batching
- [x] Stream Processing
- [x] Batch Processing
- [x] Event Time / Windows overview
- [x] Module review / cross-links

Status: **Complete**

---

## 07 — Distributed Coordination and Consistency

- [x] Module structure
- [x] Distributed Clocks
- [x] Logical Clocks
- [x] Vector Clocks overview
- [x] Leader Election
- [x] Consensus Intuition
- [x] Raft Intuition
- [x] Distributed Locks
- [x] Leases
- [x] Fencing Tokens
- [x] Distributed Transactions
- [x] Two-Phase Commit overview
- [x] Saga Pattern
- [x] Orchestration vs Choreography
- [x] Transactional Outbox
- [x] Change Data Capture
- [x] Event Sourcing
- [x] CQRS
- [x] Module review / cross-links

Status: **Complete**

---

## 08 — Reliability and Failure Engineering

- [x] Module structure
- [x] Timeouts
- [x] Retries
- [x] Retryable vs Permanent Errors
- [x] Exponential Backoff
- [x] Jitter
- [x] Retry Storms
- [x] Circuit Breaker
- [x] Bulkhead
- [x] Load Shedding
- [x] Graceful Degradation
- [x] Cascading Failures
- [x] Disaster Recovery
- [x] Backups
- [x] RPO
- [x] RTO
- [x] Multi-Region Active/Passive
- [x] Multi-Region Active/Active
- [x] Region Failover
- [x] Module review / cross-links

Status: **Complete**

---

## 09 — Observability

- [x] Module structure
- [x] Logs
- [x] Metrics
- [x] Traces
- [x] Distributed Tracing
- [x] Trace / Span IDs
- [x] Golden Signals
- [x] SLI
- [x] SLO
- [x] SLA
- [x] Error Budgets
- [x] Alerting
- [x] Health Checks
- [x] Liveness
- [x] Readiness
- [x] Module review / cross-links

Status: **Complete**

---

## 10 — Security for System Design

- [x] Module structure
- [x] Authentication vs Authorization
- [x] Sessions
- [x] Tokens
- [x] JWT Trade-offs
- [x] OAuth overview
- [x] OIDC overview
- [x] RBAC
- [x] ABAC
- [x] TLS
- [x] Encryption at Rest
- [x] Secrets Management
- [x] API Abuse Prevention
- [x] Rate Limiting Security Context
- [x] Multi-Tenancy
- [x] Tenant Isolation
- [x] Noisy Neighbor
- [x] Module review / cross-links

Status: **Complete**

---

## 11 — Reusable Interview Building Blocks

- [x] Module structure
- [x] Rate Limiter
- [x] Fixed Window
- [x] Sliding Window Log
- [x] Sliding Window Counter
- [x] Token Bucket
- [x] Leaky Bucket
- [x] Distributed Unique ID Generator
- [x] Snowflake-Style IDs
- [x] Distributed Scheduler
- [x] Search Autocomplete
- [x] Trie Intuition
- [x] Full-Text Search
- [x] Inverted Index
- [x] Bloom Filter
- [x] Object / Blob Storage
- [x] Multipart Upload
- [x] Signed URLs
- [x] Notification System
- [x] Real-Time Presence
- [x] Geospatial Indexing
- [x] Geohash
- [x] Quadtree overview
- [x] Module review / cross-links

Status: **Complete**

---

## 12 — Architecture Archetypes

- [x] Module structure
- [x] Read-Heavy Systems
- [x] Write-Heavy Systems
- [x] Fanout Systems
- [x] Real-Time Systems
- [x] Transactional Workflow Systems
- [x] Search / Discovery Systems
- [x] Streaming / Media Systems
- [x] Module review / cross-links

Status: **Complete**

---

## 13 — Interview Design Labs

Theory/reference material first; interactive lab UI later.

### Beginner

- [x] URL Shortener
- [x] Rate Limiter
- [x] Unique ID Generator
- [x] Pastebin

### Intermediate

- [x] Notification System
- [x] Chat / Messaging
- [x] News Feed
- [x] Search Autocomplete
- [x] Web Crawler
- [x] File Sync / Drive
- [x] Metrics / Monitoring Platform
- [x] Distributed Message Queue

### Advanced Backend

- [x] Ticket / Hotel Booking
- [x] E-Commerce Inventory and Ordering
- [x] Payment System
- [x] Digital Wallet
- [x] Distributed Key-Value Store
- [x] Object Storage / S3-Like System
- [x] Ride-Hailing / Nearby Drivers
- [x] Video Streaming Platform

Status: **Complete — theory/reference labs; interactive workspace deferred**

---

# 35. Application Progress Tracking

The application should grow only as curriculum needs it.

---

## Stage A — Repository and Content Foundation

- [x] Initialize Next.js project
- [x] Configure TypeScript strict mode
- [~] Configure linting / formatting — ESLint is configured; no standalone formatter is required yet
- [x] Create `docs/`
- [x] Add PRD
- [x] Create `theory/`
- [x] Add curriculum directory structure
- [x] Add content authoring conventions
- [x] Add curriculum metadata/index mechanism
- [x] Add internal link validation
- [~] Add basic reference/link validation — local links and external URL formats are validated; network reachability remains a separate check

Status: **In progress**

---

## Stage B — Theory Reader

- [x] Application shell
- [x] Sidebar curriculum navigation
- [x] Theory lesson route
- [x] Markdown / MDX rendering
- [x] Syntax highlighting
- [x] Mermaid or equivalent static diagrams
- [x] Previous / Next navigation
- [x] Breadcrumbs
- [x] Topic metadata display
- [x] Reference section rendering
- [~] YouTube links render within references; richer cards are deferred
- [ ] Search
- [x] Dark mode
- [x] Responsive reading layout

Status: **Theory-reader milestone complete; search and richer media presentation remain deferred**

---

## Stage C — Progress

- [x] Local progress model
- [x] Progress repository abstraction
- [x] IndexedDB persistence
- [x] Mark theory complete
- [x] Curriculum progress display
- [x] Continue learning
- [x] Export progress
- [x] Import progress
- [x] Reset progress

Status: **M3 complete**

---

## Stage D — Quiz System

- [ ] Quiz schema
- [ ] Single choice
- [ ] Multi-choice
- [ ] Numeric estimation
- [ ] Answer explanations
- [ ] Concept tags
- [ ] Quiz scoring
- [ ] Retry weak concepts
- [ ] Persist attempts
- [ ] Weak-concept tracking

Status: **Not started**

---

## Stage E — Visualization Foundation

Do not start until at least one real curriculum topic requires it.

- [ ] Simulation shell
- [ ] Play / pause / step / reset primitives
- [ ] Scenario presets
- [ ] Metric panel
- [ ] Event timeline
- [ ] Failure injection pattern
- [ ] SVG visualization conventions
- [ ] React Flow conventions
- [ ] Chart conventions
- [ ] Reduced motion support

Status: **Not started**

---

## Stage F — First Interactive Topics

Recommended order:

- [ ] Horizontal Scaling
- [ ] Tail Latency
- [ ] CAP
- [ ] Load Balancing
- [ ] Consistent Hashing
- [ ] Transaction Isolation
- [ ] Cache Stampede
- [ ] Queue + Backpressure
- [ ] Retry + Jitter
- [ ] Token Bucket

Status: **Not started**

---

## Stage G — Knowledge Map

- [ ] Dependency graph
- [ ] Topic state rendering
- [ ] Zoom / pan
- [ ] Topic preview
- [ ] Prerequisite navigation
- [ ] Progress overlay

Status: **Not started**

---

## Stage H — Review Mode

- [ ] Review queue
- [ ] Incorrect quiz prioritization
- [ ] Simple spaced review intervals
- [ ] Review cards
- [ ] Review completion tracking

Status: **Not started**

---

## Stage I — Design Lab Foundation

- [ ] Lab route
- [ ] Requirements workspace
- [ ] Estimation workspace
- [ ] API workspace
- [ ] Data-model workspace
- [ ] Architecture canvas
- [ ] Node palette
- [ ] Edge labeling
- [ ] Failure prompts
- [ ] Trade-off prompts
- [ ] Reference solution view
- [ ] My Design vs Reference Design

Status: **Not started**

---

## Stage J — Interview Mode

- [ ] Prompt selection
- [ ] Difficulty selection
- [ ] Timer
- [ ] Structured sections
- [ ] Evaluation checklist
- [ ] Reference architecture
- [ ] Session persistence

Status: **Not started**

---

# 36. Current Milestone

Current milestone:

> **M3 — Local progress model and `ProgressRepository` abstraction — Complete**

Primary goal:

Provide framework-independent, idempotent lesson-progress rules; interchangeable memory and IndexedDB repositories; migration-ready export/import/reset behavior; repository contract tests; and the smallest client boundaries needed to prove local progress survives refresh.

Structured quizzes, simulations, authentication, a backend, and remote synchronization remain deferred to later milestones.

---

# 37. Current Project Status

Update this section whenever Codex finishes a meaningful task.

## Last Updated

`2026-08-18`

## Active Milestone

`M3 — Local progress model and ProgressRepository abstraction — Complete`

## Currently Working On

- [x] Next.js application and theory-reader implementation
- [x] Documentation setup
- [x] Curriculum directory setup
- [x] Theory authoring — all 135 lessons across Modules 00–13 complete
- [x] Local progress domain, persistence, portable backup, and minimal reader controls

## Recently Completed

- Completed M3 with pure monotonic lesson transitions, deterministic curriculum summaries, explicit reset scopes, and a repository boundary independent of React and browser APIs.
- Added in-memory and IndexedDB adapters, a shared repository contract, fake-IndexedDB persistence/failure coverage, version-2 JSON exports, and a defined version-1 migration.
- Added narrow client controls for marking theory complete, curriculum progress, continue learning, export/import/reset, and visible storage failures while preserving static Server Component routes.
- Accepted ADR-003 for local progress ownership, timestamp-free deterministic records, atomic replace-on-import behavior, lazy IndexedDB access, and intentional deferral of quiz-attempt persistence to M4.
- Completed all 106 planned lessons in Modules 04–13, bringing the curriculum to 135 indexed lessons across all 14 modules.
- Completed all 20 Markdown-first design labs with requirements, checked estimates, APIs, data models, progressive architectures, failure/security/observability analysis, and reference rationale.
- Expanded production-index coverage to all modules and routes and added automated local-link/heading validation for Markdown documentation and module READMEs.
- Verified authoritative references during authoring and reconciled all prerequisite, related-lesson, path, order, cycle, and local-link relationships through the deterministic pipeline.
- Accepted ADR-002 to begin the narrowly scoped theory-reader milestone after Modules 00–03 rather than waiting for the full curriculum.
- Initialized Next.js 16 with React 19, strict TypeScript, Tailwind CSS, ESLint, and Vitest.
- Implemented deterministic schema, relationship, dependency-cycle, path, and local-link validation for all 29 completed lessons.
- Implemented `/learn`, all four module routes, and all 29 lesson routes as static server-rendered pages.
- Added MDX/GFM rendering, highlighted code, responsive tables, strict Mermaid rendering with source fallback, metadata, references, prerequisites, breadcrumbs, and previous/next navigation.
- Added a calm responsive reading shell with CSS light/dark themes, visible keyboard focus, a skip link, and narrow-screen overflow handling.
- Verified content, tests, lint, strict types, production build, internal links, representative browser routes, responsive layout, keyboard focus, and useful not-found behavior.
- Canonicalized the PRD path as `docs/PRD.md`.
- Added project orientation, architecture, testing, content-authoring, and curriculum-map documentation.
- Accepted the Markdown-compatible MDX and build-time content-indexing decision in ADR-001.
- Scaffolded all 14 curriculum modules with dependency, depth, and downstream-connection guidance.
- Completed all four Module 00 theory lessons with checked examples, future visualization specifications, quiz seeds, cross-links, interview lenses, and verified references.
- Completed 25 theory lessons across Foundations, Networking, and Traffic/Services with verified references and integrated dependency links.

## Blockers

None known.

## Next Recommended Tasks

1. Begin **M4 — Structured quiz system** from Stage D with validated question data, pure evaluation, explanations, and attempt identity before persistence is extended.
2. Complete one or two real theory → quiz → progress slices and use them to define weak-concept and retry behavior.
3. Keep simulations in their later stage; when visualization work begins, start with one simple and one stateful flagship lesson so real models drive shared controls.
4. Consider search alongside a focused reader improvement now that the complete corpus and local progress model exist.

---

# 38. Decision Log

Record major decisions here in concise form.

| Date | Decision | Reason |
|---|---|---|
| 2026-08-18 | Theory-first development | Full curriculum can provide value before all interactive features exist. |
| 2026-08-18 | Local-first core product | Personal learning app does not need backend complexity initially. |
| 2026-08-18 | Incremental visualization infrastructure | Real simulations should drive abstractions instead of speculative frameworks. |
| 2026-08-18 | Markdown-compatible MDX lessons with a build-time index | Content remains readable outside the app while supporting validated metadata and later interactive enhancement; see ADR-001. |
| 2026-08-18 | Begin the theory reader after Modules 00–03 | Twenty-nine real lessons are sufficient to validate the schema and reading experience before more curriculum depends on them; see ADR-002. |
| 2026-08-18 | Versioned local progress behind a repository boundary | Monotonic domain rules, lazy IndexedDB, atomic replacement imports, and explicit migrations keep local learner data deterministic and portable; see ADR-003. |

For decisions needing deeper context, create an ADR under `docs/decisions/`.

---

# 39. Codex Session Checklist

At the start of a substantial task:

- [ ] Read `CODEX.md`
- [ ] Read relevant files in `docs/`
- [ ] Inspect current repository state
- [ ] Check related theory before implementing app behavior
- [ ] Identify the smallest coherent unit of work

Before finishing:

- [ ] Run relevant tests
- [ ] Run typecheck
- [ ] Run lint
- [ ] Check internal links if content changed
- [ ] Update docs if architecture changed
- [ ] Update curriculum/application progress in `CODEX.md`
- [ ] Update `Current Project Status`
- [ ] Record a decision if a meaningful architectural choice was made

---

# 40. Instruction Priority

When instructions conflict, use this order:

1. explicit current user request,
2. `docs/PRD.md`,
3. `CODEX.md`,
4. ADRs / technical docs,
5. existing implementation patterns.

If ambiguity remains, choose the option that:

- preserves conceptual correctness,
- keeps the product local-first,
- reduces unnecessary complexity,
- supports incremental development,
- makes future content easier to add.

---

# 41. Final Reminder for Codex

The project is a **learning system**, not merely a Next.js application.

Success is not measured by:

- number of routes,
- number of React components,
- animation count,
- framework sophistication.

Success is measured by whether the learner can:

> understand a system-design concept, see its behavior, reason about its failure modes, explain its trade-offs, and use it correctly in an interview.
