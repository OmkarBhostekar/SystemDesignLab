import type {
  SimulationEvent,
  SimulationMetric,
  SimulationPreset,
  SimulationSpeed,
} from "@/simulations/types";

/**
 * Tail-latency deliberately models a small, bounded logical sample.  The
 * sample is enough to make percentile rank visible without allocating one
 * object per request in a long-running playback session.
 */
export const MAX_LATENCY_SAMPLE_COUNT = 240;
export const MAX_LATENCY_HISTORY = 40;
export const MAX_LATENCY_EVENT_COUNT = 80;

export const TAIL_LATENCY_PRESET_IDS = [
  "average-hides-tail",
  "fan-out-amplification",
  "queue-and-mitigation",
] as const;

export type TailLatencyPresetId = (typeof TAIL_LATENCY_PRESET_IDS)[number];

export const MIN_AVERAGE_SERVICE_MS = 20;
export const MAX_AVERAGE_SERVICE_MS = 250;
export const MIN_SLOW_REQUEST_PROBABILITY = 0;
export const MAX_SLOW_REQUEST_PROBABILITY = 0.2;
export const MIN_SLOW_REQUEST_LATENCY_MS = 100;
export const MAX_SLOW_REQUEST_LATENCY_MS = 3_000;
export const MIN_FAN_OUT_COUNT = 1;
export const MAX_FAN_OUT_COUNT = 100;
export const MIN_QUEUE_UTILIZATION = 0;
export const MAX_QUEUE_UTILIZATION = 0.95;
export const MIN_SAMPLE_WINDOW = 100;
export const MAX_SAMPLE_WINDOW = 2_000;
export const MIN_TIMEOUT_MS = 100;
export const MAX_TIMEOUT_MS = 2_000;

export interface TailLatencyConfig {
  /** Fast-path service time before queueing and a slow dependency are added. */
  averageServiceMs: number;
  /** Probability that one dependency request takes the slow path. */
  slowRequestProbability: number;
  /** Slow-path service time for a dependency. */
  slowRequestLatencyMs: number;
  /** Number of parallel dependency calls on the critical path. */
  fanOutCount: number;
  /** Queue utilization as a fraction of available service capacity. */
  queueUtilization: number;
  /** Logical requests in the percentile window; the rendered sample is capped. */
  sampleWindow: number;
}

export interface TailLatencyMitigations {
  hedgingEnabled: boolean;
  timeoutEnabled: boolean;
  timeoutMs: number;
  gracefulDegradationEnabled: boolean;
  /** Treat dependency slowdown as a shared/common-cause event. */
  correlatedSlowdownEnabled: boolean;
}

export interface TailLatencyHistoryPoint {
  tick: number;
  averageMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  fanOutSlowProbability: number;
}

export interface TailLatencyCompletion {
  meaningfulAction: boolean;
  progressObserved: boolean;
  completed: boolean;
}

export interface TailLatencyMetrics {
  sampleCount: number;
  sampleWindow: number;
  averageMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  rawAverageMs: number;
  rawP99Ms: number;
  slowRequestProbability: number;
  effectiveSlowProbability: number;
  fanOutCount: number;
  independentFanOutRisk: number;
  fanOutSlowProbability: number;
  fanOutAmplification: number;
  queueUtilization: number;
  queueWaitMs: number;
  timeoutRate: number;
  partialResponseRate: number;
  hedgeRate: number;
  hedgeLoadMultiplier: number;
  extraHedgeRequests: number;
  tailSpreadMs: number;
  slowdownActive: boolean;
}

export interface TailLatencyState {
  schemaVersion: 1;
  presetId: TailLatencyPresetId;
  tick: number;
  config: TailLatencyConfig;
  mitigations: TailLatencyMitigations;
  slowdownActive: boolean;
  speed: SimulationSpeed;
  playing: boolean;
  /** Effective, sorted latency observations for the current bounded sample. */
  latencySamples: number[];
  history: TailLatencyHistoryPoint[];
  metrics: TailLatencyMetrics;
  events: SimulationEvent[];
  completion: TailLatencyCompletion;
}

export type TailLatencyAction =
  | { type: "step" }
  | { type: "reset" }
  | { type: "play" }
  | { type: "pause" }
  | { type: "set-speed"; speed: SimulationSpeed }
  | { type: "set-average-service-time"; milliseconds: number }
  | { type: "set-service-time"; milliseconds: number }
  | { type: "set-slow-probability"; probability: number }
  | { type: "set-slow-request-probability"; probability: number }
  | { type: "set-slow-latency"; milliseconds: number }
  | { type: "set-fan-out"; count: number }
  | { type: "set-fan-out-count"; count: number }
  | { type: "set-queue-utilization"; utilization: number }
  | { type: "set-sample-window"; requests: number }
  | { type: "set-timeout"; milliseconds: number }
  | { type: "toggle-hedging" }
  | { type: "toggle-timeout" }
  | { type: "toggle-graceful-degradation" }
  | { type: "toggle-correlated-slowdown" }
  | { type: "inject-slowdown" }
  | { type: "recover-slowdown" }
  | { type: "inject-failure" }
  | { type: "recover-failure" };

export type TailLatencySimulationMetric = SimulationMetric;
export type TailLatencySimulationEvent = SimulationEvent;

export interface TailLatencyPresetDefinition
  extends SimulationPreset<TailLatencyPresetId> {
  config: TailLatencyConfig;
  mitigations: TailLatencyMitigations;
}

export interface TailLatencyTransition {
  state: TailLatencyState;
  events: SimulationEvent[];
  metrics: TailLatencyMetrics;
}
