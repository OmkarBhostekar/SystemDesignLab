# Module 10 — Security for System Design

**Status:** Scaffold only. Architecture-focused security lessons are not yet authored.

## Purpose

Make identity, authorization, encryption, abuse prevention, secrets, and tenant isolation part of system design rather than a final checklist. The module stays architecture-focused and vendor-independent, with security choices linked to boundaries and failure modes.

## Depth classification

Authentication, authorization, sessions/tokens, JWT trade-offs, TLS, secrets, and abuse prevention are **Core**. OAuth/OIDC nuance, ABAC, and multi-tenant isolation are **Core / Advanced boundary** or **Advanced** depending on scope.

## Prerequisites

- [`02-networking`](../02-networking/README.md) for request, transport, and API boundaries.
- [`03-traffic-and-services`](../03-traffic-and-services/README.md) for gateways and service ownership.
- [`08-reliability`](../08-reliability/README.md) for operational failure and recovery context.
- [`09-observability`](../09-observability/README.md) for audit, abuse, and incident signals.

## Intended lesson order

1. `10-01-authentication-and-authorization` — Prove identity versus decide what an identity may do.
2. `10-02-sessions-and-tokens` — Stateful sessions, stateless tokens, revocation, rotation, and storage boundaries.
3. `10-03-jwt-tradeoffs` — Claims, verification, expiry, revocation cost, and when JWTs are not the right fit.
4. `10-04-oauth-and-oidc` — Authorization delegation and identity federation conceptually.
5. `10-05-rbac-and-abac` — Role- and attribute-based policy, data ownership, and policy evaluation trade-offs.
6. `10-06-tls-and-encryption` — Transport encryption and encryption at rest, key boundaries, and threat assumptions.
7. `10-07-secrets-management` — Secret storage, rotation, access scope, and avoiding secrets in code or logs.
8. `10-08-api-abuse-prevention` — Authentication-aware rate limiting, quotas, replay/abuse signals, and provider protection.
9. `10-09-multi-tenancy-and-isolation` — Tenant boundaries, noisy neighbors, data isolation, and resource fairness.

## Downstream connections

- [`11-building-blocks`](../11-building-blocks/README.md) applies admission control in the rate limiter and identity/data boundaries in other reusable components.
- [`12-architecture-archetypes`](../12-architecture-archetypes/README.md) frames security choices for public, multi-tenant, workflow, and real-time systems.
- Booking, payment, wallet, e-commerce, file, notification, and ride-hailing labs in [`13-design-labs`](../13-design-labs/README.md) should surface relevant security decisions.
- Security remains cross-cutting: future lessons should link back to networking, reliability, and observability instead of isolating all security reasoning here.

## Authoring boundary

This scaffold does not endorse a particular identity product or token format. Future content must state the threat model, trust boundary, compromise/revocation behavior, and operational trade-offs for each choice.

