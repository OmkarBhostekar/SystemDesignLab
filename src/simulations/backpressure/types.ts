import type {
  SimulationEvent,
  SimulationMetric,
  SimulationPreset,
} from "@/simulations/types";

/**
 * Backpressure keeps a deliberately small logical workload. A work item is a
 * model record, not a DOM node; the renderer samples the aggregates below.
 */
export const MAX_BACKPRESSURE_HISTORY = 48;
export const MAX_BACKPRESSURE_EVENT_COUNT = 80;
export const MAX_BACKPRESSURE_QUEUE_CAPACITY = 160;
export const MAX_BACKPRESSURE_JOB_COUNT = 2_000;

export const BACKPRESSURE_PRESET_IDS = [
  "steady-capacity",
  "burst-absorption",
  "downstream-outage",
  "priority-shedding",
] as const;

export type BackpressurePresetId = (typeof BACKPRESSURE_PRESET_IDS)[number];

export const BACKPRESSURE_PRIORITY_POLICIES = [
  "fifo",
  "critical-first",
  "reserved-critical",
] as const;

export type BackpressurePriorityPolicy = (typeof BACKPRESSURE_PRIORITY_POLICIES)[number];

export const BACKPRESSURE_ADMISSION_POLICIES = [
  "buffer",
  "throttle",
  "shed-low-priority",
] as const;

export type BackpressureAdmissionPolicy = (typeof BACKPRESSURE_ADMISSION_POLICIES)[number];

export const BACKPRESSURE_WORK_PRIORITIES = [
  "critical",
  "normal",
  "best-effort",
] as const;

export type BackpressureWorkPriority = (typeof BACKPRESSURE_WORK_PRIORITIES)[number];

export interface BackpressureConfig {
  /** Logical jobs offered by the producer on an ordinary tick. */
  arrivalRate: number;
  /** Logical jobs offered while the authored burst window is active. */
  burstRate: number;
  burstStartTick: number;
  burstDurationTicks: number;
  /** Capacity per consumer on one model tick. */
  serviceRate: number;
  /** Maximum jobs retained by the broker across its partitions. */
  queueCapacity: number;
  /** Maximum unacknowledged jobs held by each consumer. */
  prefetch: number;
  consumerCount: number;
  /** Maximum concurrent calls allowed at the downstream dependency. */
  downstreamLimit: number;
  /** Number of retries after the first failed attempt. */
  retryLimit: number;
  retryBackoffTicks: number;
  partitionCount: number;
  priorityPolicy: BackpressurePriorityPolicy;
  admissionPolicy: BackpressureAdmissionPolicy;
}

export interface BackpressureWorkItem {
  id: string;
  partition: number;
  priority: BackpressureWorkPriority;
  createdTick: number;
  enqueuedTick: number;
  attempt: number;
}

export interface BackpressureRetryItem {
  item: BackpressureWorkItem;
  dueTick: number;
}

export interface BackpressureCounters {
  generated: number;
  admitted: number;
  completed: number;
  rejected: number;
  dropped: number;
  throttled: number;
  attempts: number;
  retries: number;
  retryScheduled: number;
  outageFailures: number;
  peakQueueDepth: number;
  peakInFlight: number;
}

export interface BackpressureRuntime {
  downstreamAvailable: boolean;
  outageStartTick: number | null;
  /** Tick at which the dependency recovery signal was applied. */
  recoveryTick: number | null;
  /** Tick at which all work present at recovery finished draining. */
  recoveryCompletedTick: number | null;
  recoveryObserved: boolean;
}

export interface BackpressureHistoryPoint {
  tick: number;
  queueDepth: number;
  oldestAgeTicks: number;
  inFlightMemory: number;
  throughput: number;
  rejected: number;
  dropped: number;
  dependencySaturation: number;
  retryAmplification: number;
}

export interface BackpressureMetrics {
  tick: number;
  arrivalRate: number;
  serviceCapacity: number;
  downstreamLimit: number;
  queueDepth: number;
  queueCapacity: number;
  queueUtilization: number;
  oldestAgeTicks: number;
  /** Alias useful to callers that use age as the primary signal. */
  oldestAge: number;
  partitionDepths: number[];
  workerBufferDepth: number;
  processingCount: number;
  inFlightMemory: number;
  inFlightMemoryCapacity: number;
  retryBacklog: number;
  pendingWork: number;
  throughput: number;
  completed: number;
  generated: number;
  admitted: number;
  rejected: number;
  dropped: number;
  rejectedOrDropped: number;
  throttled: number;
  attempts: number;
  retries: number;
  retryAmplification: number;
  outageFailures: number;
  dependencySaturation: number;
  downstreamAvailable: boolean;
  dependencyStatus: "healthy" | "outage";
  /** Final post-recovery drain duration; null until the backlog is empty. */
  recoveryTimeTicks: number | null;
  /** Current post-recovery elapsed ticks while the backlog is still draining. */
  recoveryElapsedTicks: number | null;
  recoveryComplete: boolean;
  overloaded: boolean;
  history: BackpressureHistoryPoint[];
}

export interface BackpressureCompletion {
  meaningfulAction: boolean;
  pressureObserved: boolean;
  responseObserved: boolean;
  completed: boolean;
}

export interface BackpressureState {
  schemaVersion: 1;
  presetId: BackpressurePresetId;
  tick: number;
  config: BackpressureConfig;
  runtime: BackpressureRuntime;
  queue: BackpressureWorkItem[];
  workerBuffer: BackpressureWorkItem[];
  processing: BackpressureWorkItem[];
  retryQueue: BackpressureRetryItem[];
  nextJobNumber: number;
  counters: BackpressureCounters;
  lastThroughput: number;
  history: BackpressureHistoryPoint[];
  events: SimulationEvent[];
  eventSequence: number;
  metrics: BackpressureMetrics;
  completion: BackpressureCompletion;
}

export type BackpressureAction =
  | { type: "step" }
  | { type: "reset" }
  | { type: "play" }
  | { type: "pause" }
  | { type: "set-arrival-rate"; rate: number }
  | { type: "set-arrival"; rate: number }
  | { type: "set-burst-rate"; rate: number }
  | { type: "set-service-rate"; rate: number }
  | { type: "set-queue-capacity"; capacity: number }
  | { type: "set-queue-size"; capacity: number }
  | { type: "set-prefetch"; count: number }
  | { type: "set-consumer-count"; count: number }
  | { type: "set-consumers"; count: number }
  | { type: "set-downstream-limit"; limit: number }
  | { type: "set-retry-limit"; count: number }
  | { type: "set-retries"; count: number }
  | { type: "set-priority-policy"; policy: BackpressurePriorityPolicy }
  | { type: "set-priority"; policy: BackpressurePriorityPolicy }
  | { type: "set-admission-policy"; policy: BackpressureAdmissionPolicy }
  | { type: "set-shedding-policy"; policy: BackpressureAdmissionPolicy }
  | { type: "set-partition-count"; count: number }
  | { type: "inject-outage" }
  | { type: "recover-outage" }
  | { type: "toggle-outage" }
  | { type: "inject-failure" }
  | { type: "recover-failure" };

export type BackpressureSimulationMetric = SimulationMetric;
export type BackpressureSimulationEvent = SimulationEvent;

export interface BackpressureTransition {
  state: BackpressureState;
  events: SimulationEvent[];
  metrics: BackpressureMetrics;
}

export interface BackpressurePresetDefinition
  extends SimulationPreset<BackpressurePresetId> {
  config: BackpressureConfig;
  initialDownstreamAvailable?: boolean;
}

export class BackpressureValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackpressureValidationError";
  }
}
