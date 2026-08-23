import type { LoadBalancingPresetDefinition, LoadBalancingPresetId } from "./types";

const BASE_CONFIG = {
  policy: "round-robin",
  selectionUnit: "request",
  metricDelayTicks: 1,
  hotKeyProbability: 0.05,
  requestsPerStep: 12,
  queueCapacity: 6,
  nodeCapacityWorkMs: 1_600,
  outstandingWorkUnitMs: 100,
  baseLatencyMs: 18,
  randomSeed: 0x51_7a_19,
} as const;

/**
 * The presets deliberately use the same small, inspectable trace size.  A
 * step processes a batch of requests, so the UI can show a meaningful tail
 * percentile without rendering hundreds of request elements.
 */
export const LOAD_BALANCING_PRESETS = [
  {
    id: "mixed-checkout-work",
    label: "Mixed checkout work",
    description: "Short reads, database writes, and a few long payment calls expose equal-count skew.",
    config: {
      ...BASE_CONFIG,
      hotKeyProbability: 0.08,
      randomSeed: 0x10_20_30,
    },
    nodes: [
      { id: "checkout-a", weight: 2 },
      { id: "checkout-b", weight: 1 },
      { id: "checkout-c", weight: 2 },
      { id: "checkout-d", weight: 1 },
    ],
    traceLength: 120,
  },
  {
    id: "celebrity-cache-key",
    label: "Celebrity cache key",
    description: "A mostly balanced cache fleet still concentrates a popular key on one hash owner.",
    config: {
      ...BASE_CONFIG,
      policy: "key-hash",
      selectionUnit: "request",
      hotKeyProbability: 0.42,
      randomSeed: 0x40_50_60,
    },
    nodes: [
      { id: "cache-a", weight: 1 },
      { id: "cache-b", weight: 1 },
      { id: "cache-c", weight: 1 },
      { id: "cache-d", weight: 1 },
    ],
    traceLength: 120,
  },
  {
    id: "connection-skew",
    label: "Long-lived connections",
    description: "A few persistent connections make least-connections diverge from request-level work.",
    config: {
      ...BASE_CONFIG,
      policy: "least-connections",
      selectionUnit: "connection",
      hotKeyProbability: 0.12,
      randomSeed: 0x70_80_90,
      requestsPerStep: 10,
      nodeCapacityWorkMs: 1_400,
    },
    nodes: [
      { id: "stream-a", weight: 1 },
      { id: "stream-b", weight: 1 },
      { id: "stream-c", weight: 1 },
      { id: "stream-d", weight: 1 },
    ],
    traceLength: 120,
  },
] as const satisfies readonly LoadBalancingPresetDefinition[];

export const LOAD_BALANCING_PRESET_BY_ID: ReadonlyMap<
  LoadBalancingPresetId,
  LoadBalancingPresetDefinition
> = new Map(LOAD_BALANCING_PRESETS.map((preset) => [preset.id, preset]));

export function getLoadBalancingPreset(
  presetId: LoadBalancingPresetId,
): LoadBalancingPresetDefinition {
  const preset = LOAD_BALANCING_PRESET_BY_ID.get(presetId);
  if (!preset) throw new Error(`Unknown load-balancing preset: ${String(presetId)}.`);
  return {
    ...preset,
    config: { ...preset.config },
    nodes: preset.nodes.map((node) => ({ ...node })),
  };
}
