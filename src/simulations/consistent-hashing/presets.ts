import type { ConsistentHashingPresetDefinition, ConsistentHashingPresetId } from "./types";

const DEFAULT_NODES = ["node-a", "node-b", "node-c", "node-d"];

/**
 * Small, deterministic scenarios used by the lesson.  The numbers are
 * illustrative rather than production capacity claims; the engine exposes
 * the resulting movement and skew instead of promising fixed percentages.
 */
export const CONSISTENT_HASHING_PRESETS = [
  {
    id: "modulo-baseline",
    label: "Modulo baseline",
    description: "See why changing N remaps most modulo-hashed keys.",
    strategy: "modulo",
    nodeIds: DEFAULT_NODES,
    keyCount: 100,
    vnodesEnabled: false,
    vnodeCount: 1,
    tokenSeed: "m5-default",
    replicationFactor: 1,
    hotKeyRate: 0,
    totalTrafficQps: 1_000,
    migrationPolicy: "lazy-refill",
  },
  {
    id: "one-token-ring",
    label: "One-token ring",
    description: "Compare a ring with one token per physical node.",
    strategy: "ring",
    nodeIds: DEFAULT_NODES,
    keyCount: 100,
    vnodesEnabled: false,
    vnodeCount: 1,
    tokenSeed: "m5-default",
    replicationFactor: 1,
    hotKeyRate: 0,
    totalTrafficQps: 1_000,
    migrationPolicy: "lazy-refill",
  },
  {
    id: "vnode-ring",
    label: "Virtual-node ring",
    description: "Use many tokens per node to reduce ownership variance.",
    strategy: "ring",
    nodeIds: DEFAULT_NODES,
    keyCount: 100,
    vnodesEnabled: true,
    vnodeCount: 16,
    tokenSeed: "m5-default",
    replicationFactor: 1,
    hotKeyRate: 0,
    totalTrafficQps: 1_000,
    migrationPolicy: "lazy-refill",
  },
  {
    id: "celebrity-key",
    label: "Celebrity key",
    description: "Balanced ownership can still leave one hot key on one node.",
    strategy: "ring",
    nodeIds: DEFAULT_NODES,
    keyCount: 1_000,
    vnodesEnabled: true,
    vnodeCount: 32,
    tokenSeed: "m5-celebrity",
    replicationFactor: 1,
    hotKeyRate: 0.4,
    totalTrafficQps: 10_000,
    migrationPolicy: "lazy-refill",
  },
  {
    id: "node-failure-migration",
    label: "Node failure and migration",
    description: "Pause a ring rollout, fail an owner, and compare refill with durable movement.",
    strategy: "ring",
    nodeIds: DEFAULT_NODES,
    keyCount: 100,
    vnodesEnabled: true,
    vnodeCount: 16,
    tokenSeed: "m5-failure",
    replicationFactor: 2,
    hotKeyRate: 0,
    totalTrafficQps: 1_000,
    migrationPolicy: "durable-migration",
  },
] as const satisfies readonly ConsistentHashingPresetDefinition[];

export const CONSISTENT_HASHING_PRESET_BY_ID: ReadonlyMap<
  ConsistentHashingPresetId,
  ConsistentHashingPresetDefinition
> = new Map(CONSISTENT_HASHING_PRESETS.map((preset) => [preset.id, preset]));

export function getConsistentHashingPreset(
  presetId: ConsistentHashingPresetId,
): ConsistentHashingPresetDefinition {
  const preset = CONSISTENT_HASHING_PRESET_BY_ID.get(presetId);
  if (!preset) throw new Error(`Unknown consistent-hashing preset: ${presetId}.`);
  return {
    ...preset,
    nodeIds: [...preset.nodeIds],
  };
}
