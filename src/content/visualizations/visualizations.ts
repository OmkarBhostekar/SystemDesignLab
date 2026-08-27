import type { VisualizationDefinition } from "@/simulations";

export const visualizations = [
  {
    id: "horizontal-scaling",
    lessonId: "01-02-horizontal-vs-vertical-scaling",
    kind: "horizontal-scaling",
    title: "Scaling and saturation lab",
    description: "Compare scale-up and scale-out while observing warm-up, queues, shared bottlenecks, and node failure.",
  },
  {
    id: "consistent-hash-ring",
    lessonId: "04-10-consistent-hashing",
    kind: "consistent-hashing",
    title: "Consistent hash-ring explorer",
    description: "Compare modulo and ring placement while changing membership, virtual nodes, failures, and migration policy.",
  },
  {
    id: "tail-latency",
    lessonId: "01-04-percentiles-tail-latency",
    kind: "tail-latency",
    title: "Tail-latency explorer",
    description: "See how percentiles, fan-out, queueing, and mitigations change user-visible latency and resource cost.",
  },
  {
    id: "cap",
    lessonId: "01-09-cap",
    kind: "cap",
    title: "CAP partition lab",
    description: "Partition replicas, issue reads and writes, and compare consistency, availability, conflict, and repair choices.",
  },
  {
    id: "load-balancing-algorithms",
    lessonId: "03-02-load-balancing-algorithms",
    kind: "load-balancing",
    title: "Load-balancing algorithm lab",
    description: "Replay one workload across routing policies while exposing work skew, queueing, hot keys, health, and remapping.",
  },
  {
    id: "transaction-isolation",
    lessonId: "04-05-transaction-isolation",
    kind: "transaction-isolation",
    title: "Transaction-isolation lab",
    description: "Step through concurrent schedules to expose anomalies, snapshots, conflicts, and invariant protection.",
  },
  {
    id: "cache-stampede",
    lessonId: "05-07-cache-stampede",
    kind: "cache-stampede",
    title: "Cache-stampede control room",
    description: "Trigger synchronized misses and compare coalescing, locks, jitter, refresh, and bounded stale responses.",
  },
  {
    id: "backpressure",
    lessonId: "06-09-backpressure",
    kind: "backpressure",
    title: "Backpressure pipeline lab",
    description: "Change producer, broker, consumer, and downstream capacity to observe backlog, loss, retries, and feedback.",
  },
] satisfies VisualizationDefinition[];
