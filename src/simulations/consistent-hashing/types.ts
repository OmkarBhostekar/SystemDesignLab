import type {
  SimulationEvent,
  SimulationMetric,
  SimulationPreset,
  SimulationSpeed,
} from "@/simulations/types";

/** The fixed key space used by the educational ring model. */
export const HASH_SPACE_SIZE = 0x1_0000_0000;
export const HASH_MAX = HASH_SPACE_SIZE - 1;
export const HASH_ALGORITHM = "FNV-1a over UTF-8 bytes with a 32-bit avalanche for placement";

export const CONSISTENT_HASHING_PRESET_IDS = [
  "modulo-baseline",
  "one-token-ring",
  "vnode-ring",
  "celebrity-key",
  "node-failure-migration",
] as const;

export type ConsistentHashingPresetId = (typeof CONSISTENT_HASHING_PRESET_IDS)[number];

export const HASH_STRATEGIES = ["modulo", "ring"] as const;
export type HashStrategy = (typeof HASH_STRATEGIES)[number];

export const NODE_STATUSES = ["active", "failed", "removed"] as const;
export type ConsistentHashNodeStatus = (typeof NODE_STATUSES)[number];

export const RING_ROLLOUT_STATUSES = [
  "stable",
  "pending",
  "paused",
  "migrating",
  "ready",
] as const;
export type RingRolloutStatus = (typeof RING_ROLLOUT_STATUSES)[number];

export const MIGRATION_POLICIES = ["lazy-refill", "durable-migration"] as const;
export type MigrationPolicy = (typeof MIGRATION_POLICIES)[number];

export const MIGRATION_STATUSES = [
  "pending",
  "copied",
  "verified",
  "refill-pending",
] as const;
export type MigrationStatus = (typeof MIGRATION_STATUSES)[number];

export const DEFAULT_MIGRATION_BATCH_SIZE = 16;
export const DEFAULT_KEY_SIZE_BYTES = 1024;
export const DEFAULT_TOTAL_TRAFFIC_QPS = 10_000;
export const MIN_KEY_COUNT = 1;
export const MAX_KEY_COUNT = 10_000;
export const MIN_VNODE_COUNT = 1;
export const MAX_VNODE_COUNT = 256;
export const MIN_REPLICATION_FACTOR = 1;

export interface ConsistentHashNode {
  id: string;
  status: ConsistentHashNodeStatus;
  /** Capacity weighting is part of the serializable model; M5 uses weight 1. */
  weight: number;
}

export interface ConsistentHashToken {
  tokenId: string;
  nodeId: string;
  vnodeIndex: number;
  position: number;
}

export interface ConsistentHashKeyPlacement {
  keyId: string;
  hash: number;
  primaryNodeId: string | null;
  replicaNodeIds: string[];
}

export interface ConsistentHashMigration {
  keyId: string;
  fromNodeId: string | null;
  toNodeId: string | null;
  bytes: number;
  status: MigrationStatus;
}

export interface ConsistentHashCompletion {
  /** A membership or failure action has happened in this scenario. */
  meaningfulAction: boolean;
  /** A later deterministic step or successful cutover was observed. */
  progressObserved: boolean;
  completed: boolean;
}

export interface ConsistentHashMetrics {
  keyCount: number;
  activeNodeCount: number;
  currentNodeCount: number;
  remappedKeys: number;
  remappedFraction: number;
  pendingRemappedKeys: number;
  pendingRemappedFraction: number;
  ownershipByNode: Record<string, number>;
  ownershipFractionByNode: Record<string, number>;
  /** Population variance of ownership fractions among active current nodes. */
  ownershipVariance: number;
  minimumIntervalFraction: number;
  maximumIntervalFraction: number;
  migrationPendingKeys: number;
  migrationCopiedKeys: number;
  migrationVerifiedKeys: number;
  migrationBytes: number;
  totalTrafficQps: number;
  hotKeyId: string | null;
  hotKeyQps: number;
  hotNodeId: string | null;
  hotNodeQps: number;
  originMissQps: number;
}

export interface ConsistentHashingPresetDefinition
  extends SimulationPreset<ConsistentHashingPresetId> {
  strategy: HashStrategy;
  nodeIds: string[];
  keyCount: number;
  vnodesEnabled: boolean;
  vnodeCount: number;
  tokenSeed: string;
  replicationFactor: number;
  hotKeyRate: number;
  totalTrafficQps: number;
  migrationPolicy: MigrationPolicy;
}

export interface ConsistentHashingState {
  presetId: ConsistentHashingPresetId;
  tick: number;
  strategy: HashStrategy;
  tokenSeed: string;
  vnodesEnabled: boolean;
  vnodeCount: number;
  keyCount: number;
  replicationFactor: number;
  hotKeyRate: number;
  totalTrafficQps: number;
  keySizeBytes: number;
  migrationBatchSize: number;
  migrationPolicy: MigrationPolicy;
  speed: SimulationSpeed;
  playing: boolean;
  servers: ConsistentHashNode[];
  /** Physical membership in the last committed placement configuration. */
  currentNodeIds: string[];
  /** Proposed membership, when a ring rollout is pending. */
  pendingNodeIds: string[] | null;
  tokens: ConsistentHashToken[];
  pendingTokens: ConsistentHashToken[] | null;
  currentRingVersion: number;
  pendingRingVersion: number | null;
  rolloutStatus: RingRolloutStatus;
  assignments: ConsistentHashKeyPlacement[];
  pendingAssignments: ConsistentHashKeyPlacement[] | null;
  previousAssignments: ConsistentHashKeyPlacement[];
  migration: ConsistentHashMigration[];
  lazyRefillKeys: string[];
  metrics: ConsistentHashMetrics;
  events: SimulationEvent[];
  completion: ConsistentHashCompletion;
}

export type ConsistentHashingAction =
  | { type: "set-strategy"; strategy: HashStrategy }
  | { type: "toggle-vnodes" }
  | { type: "set-vnode-count"; count: number }
  | { type: "set-key-count"; count: number }
  | { type: "add-keys"; count: number }
  | { type: "add-10000-keys" }
  | { type: "set-hot-key-rate"; rate: number }
  | { type: "set-replication-factor"; factor: number }
  | { type: "set-token-seed"; seed: string }
  | { type: "set-migration-policy"; policy: MigrationPolicy }
  | { type: "add-server"; nodeId?: string }
  | { type: "remove-server"; nodeId: string }
  | { type: "fail-server"; nodeId: string }
  | { type: "kill-server"; nodeId: string }
  | { type: "recover-server"; nodeId: string }
  | { type: "pause-rollout" }
  | { type: "resume-rollout" }
  | { type: "cutover" }
  | { type: "step" }
  | { type: "reset" }
  | { type: "play" }
  | { type: "pause" }
  | { type: "set-speed"; speed: SimulationSpeed };

export type ConsistentHashingSimulationMetric = SimulationMetric;

export type ConsistentHashingSimulationEvent = SimulationEvent;
