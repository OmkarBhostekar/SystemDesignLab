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
] satisfies VisualizationDefinition[];
