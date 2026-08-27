import type {
  SimulationEvent,
  SimulationMetric,
  SimulationPreset,
  SimulationSpeed,
} from "@/simulations/types";

/** The bounded logical clock used by the control room. */
export const CACHE_STAMPEDE_STEP_MS = 100;
export const MAX_CACHE_STAMPEDE_HISTORY = 40;
export const MAX_CACHE_STAMPEDE_EVENTS = 64;
export const MAX_CACHE_STAMPEDE_ACTIVE_LOADS = 96;
export const MAX_CACHE_STAMPEDE_READER_GROUPS_PER_LOAD = 64;

export const CACHE_STAMPEDE_PRESET_IDS = [
  "synchronized-expiry",
  "cold-start-burst",
  "failure-and-stale",
] as const;

export type CacheStampedePresetId = (typeof CACHE_STAMPEDE_PRESET_IDS)[number];

export const CACHE_STAMPEDE_MITIGATIONS = [
  "none",
  "jitter",
  "local-single-flight",
  "distributed-lock",
  "stale-while-revalidate",
] as const;

export type CacheStampedeMitigation = (typeof CACHE_STAMPEDE_MITIGATIONS)[number];

export const CACHE_STAMPEDE_CACHE_STATUSES = [
  "cold",
  "fresh",
  "stale",
  "expired",
] as const;

export type CacheStampedeCacheStatus = (typeof CACHE_STAMPEDE_CACHE_STATUSES)[number];

export type CacheStampedeLoadPurpose = "miss" | "refresh";

export interface CacheStampedeConfig {
  /** Readers per second for the single hot key. */
  arrivalRatePerSecond: number;
  /** Optional synchronized reader cohort added at cold start and expiry. */
  burstReaders: number;
  /** Source latency for one logical cache fill. */
  loaderLatencyMs: number;
  /** Freshness window after a successful fill. */
  ttlMs: number;
  /** Symmetric, deterministic TTL jitter applied to each successful fill. */
  ttlJitterMs: number;
  /** Number of application processes receiving the hot-key readers. */
  processCount: number;
  /** Distributed lock lease. A shorter lease can permit duplicate owners. */
  lockLeaseMs: number;
  /** Maximum time a miss reader waits for its shared load. */
  waiterTimeoutMs: number;
  /** How long a stale value may be served by SWR. */
  staleGraceMs: number;
}

export interface CacheStampedePresetDefinition
  extends SimulationPreset<CacheStampedePresetId> {
  config: CacheStampedeConfig;
  mitigation: CacheStampedeMitigation;
  sourceFailed?: boolean;
  initialCache?: "cold" | "warm";
}

export interface CacheStampedeCache {
  status: CacheStampedeCacheStatus;
  valueVersion: number;
  filledAtMs: number | null;
  freshUntilMs: number | null;
  staleUntilMs: number | null;
}

export interface CacheStampedeReaderGroup {
  id: string;
  processId: string;
  count: number;
  arrivedAtMs: number;
  deadlineAtMs: number;
}

export interface CacheStampedeSourceLoad {
  id: string;
  purpose: CacheStampedeLoadPurpose;
  ownerProcessId: string | null;
  ownerToken: string | null;
  startedAtMs: number;
  completeAtMs: number;
  /** Independent source calls represented by this aggregate. */
  callCount: number;
  readerGroups: CacheStampedeReaderGroup[];
  /** An injected owner crash makes this load fail without releasing its lease. */
  ownerCrashed: boolean;
}

export interface CacheStampedeLock {
  ownerProcessId: string | null;
  ownerToken: string | null;
  acquiredAtMs: number | null;
  leaseExpiresAtMs: number | null;
}

export interface CacheStampedeStepStats {
  readers: number;
  cacheHits: number;
  cacheMisses: number;
  staleServed: number;
  sourceCallsStarted: number;
  sourceCallsCompleted: number;
  failedLoads: number;
  timedOutReaders: number;
  waitSamples: number;
  waitMs: number;
  coalescedReaders: number;
  lockContention: number;
  lockAcquisitions: number;
  refreshes: number;
}

export interface CacheStampedeTotals {
  readers: number;
  cacheHits: number;
  cacheMisses: number;
  staleServed: number;
  sourceCalls: number;
  sourceCallsCompleted: number;
  failedLoads: number;
  failedReaders: number;
  timedOutReaders: number;
  waitSamples: number;
  waitMs: number;
  maxWaitMs: number;
  coalescedReaders: number;
  lockContention: number;
  lockAcquisitions: number;
  leaseExpirations: number;
  ownerFailures: number;
  refreshes: number;
  peakSourceConcurrency: number;
}

export interface CacheStampedeHistoryPoint {
  tick: number;
  timeMs: number;
  readers: number;
  cacheMisses: number;
  sourceQps: number;
  sourceConcurrency: number;
  waitLatencyMs: number;
  staleAgeMs: number;
  lockContention: number;
  failedLoads: number;
}

export interface CacheStampedeCompletion {
  meaningfulAction: boolean;
  progressObserved: boolean;
  completed: boolean;
}

export interface CacheStampedeComparison {
  mitigation: CacheStampedeMitigation;
  label: string;
  peakSourceConcurrency: number;
  sourceCalls: number;
  waitLatencyMs: number;
  staleReaders: number;
  lockContention: number;
  failedLoads: number;
  tradeoff: string;
}

export interface CacheStampedeMetrics {
  tick: number;
  timeMs: number;
  mitigation: CacheStampedeMitigation;
  cacheStatus: CacheStampedeCacheStatus;
  cacheAgeMs: number;
  staleAgeMs: number;
  ttlRemainingMs: number;
  readersThisStep: number;
  totalReaders: number;
  cacheHits: number;
  cacheMisses: number;
  sourceCalls: number;
  sourceQps: number;
  currentSourceConcurrency: number;
  peakSourceConcurrency: number;
  averageWaitLatencyMs: number;
  /** A compact alias useful to renderers and lesson text. */
  waitLatencyMs: number;
  maxWaitLatencyMs: number;
  staleServed: number;
  staleServeRate: number;
  lockContention: number;
  lockContentionThisStep: number;
  lockAcquisitions: number;
  leaseExpirations: number;
  ownerFailures: number;
  failedLoads: number;
  failedReaders: number;
  timedOutReaders: number;
  coalescedReaders: number;
  coalescingRatio: number;
  refreshes: number;
  activeLoadCount: number;
  lockHeld: boolean;
  lockOwner: string | null;
  leaseRemainingMs: number;
  sourceFailure: boolean;
  ownerFailure: boolean;
  amplification: number;
  comparisons: CacheStampedeComparison[];
}

export interface CacheStampedeState {
  schemaVersion: 1;
  presetId: CacheStampedePresetId;
  tick: number;
  timeMs: number;
  seed: number;
  config: CacheStampedeConfig;
  mitigation: CacheStampedeMitigation;
  sourceFailure: boolean;
  ownerFailure: boolean;
  cache: CacheStampedeCache;
  activeLoads: CacheStampedeSourceLoad[];
  lock: CacheStampedeLock;
  arrivalRemainder: number;
  nextLoadNumber: number;
  nextReaderGroupNumber: number;
  nextLockNumber: number;
  fillSequence: number;
  eventSequence: number;
  failedOwnerLoadIds: string[];
  totals: CacheStampedeTotals;
  lastStep: CacheStampedeStepStats;
  history: CacheStampedeHistoryPoint[];
  events: SimulationEvent[];
  completion: CacheStampedeCompletion;
  speed: SimulationSpeed;
  playing: boolean;
}

export type CacheStampedeAction =
  | { type: "step" }
  | { type: "reset" }
  | { type: "play" }
  | { type: "pause" }
  | { type: "set-speed"; speed: SimulationSpeed }
  | { type: "set-arrival-rate"; rate: number }
  | { type: "set-arrival-rate-per-second"; rate: number }
  | { type: "set-burst-readers"; readers: number }
  | { type: "set-loader-latency"; milliseconds: number }
  | { type: "set-ttl"; milliseconds: number }
  | { type: "set-ttl-jitter"; milliseconds: number }
  | { type: "set-process-count"; count: number }
  | { type: "set-lock-lease"; milliseconds: number }
  | { type: "set-waiter-timeout"; milliseconds: number }
  | { type: "set-stale-grace"; milliseconds: number }
  | { type: "set-mitigation"; mitigation: CacheStampedeMitigation }
  | { type: "set-strategy"; mitigation: CacheStampedeMitigation }
  | { type: "set-source-failure"; failed: boolean }
  | { type: "inject-source-failure" }
  | { type: "recover-source-failure" }
  | { type: "inject-failure" }
  | { type: "recover-failure" }
  | { type: "inject-owner-failure" }
  | { type: "recover-owner-failure" };

export type CacheStampedeSimulationMetric = SimulationMetric;
export type CacheStampedeSimulationEvent = SimulationEvent;

export interface CacheStampedeTransition {
  state: CacheStampedeState;
  events: SimulationEvent[];
  metrics: CacheStampedeMetrics;
}

export class CacheStampedeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CacheStampedeValidationError";
  }
}
