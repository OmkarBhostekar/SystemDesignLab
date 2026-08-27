import {
  SIMULATION_SPEEDS,
  type SimulationEvent,
  type SimulationMetric,
  type SimulationSpeed,
} from "@/simulations/types";

import { getTailLatencyPreset, TAIL_LATENCY_PRESETS } from "./presets";
import {
  MAX_AVERAGE_SERVICE_MS,
  MAX_FAN_OUT_COUNT,
  MAX_LATENCY_EVENT_COUNT,
  MAX_LATENCY_HISTORY,
  MAX_LATENCY_SAMPLE_COUNT,
  MAX_SAMPLE_WINDOW,
  MAX_SLOW_REQUEST_LATENCY_MS,
  MAX_SLOW_REQUEST_PROBABILITY,
  MAX_QUEUE_UTILIZATION,
  MAX_TIMEOUT_MS,
  MIN_AVERAGE_SERVICE_MS,
  MIN_FAN_OUT_COUNT,
  MIN_SAMPLE_WINDOW,
  MIN_SLOW_REQUEST_LATENCY_MS,
  MIN_SLOW_REQUEST_PROBABILITY,
  MIN_QUEUE_UTILIZATION,
  MIN_TIMEOUT_MS,
  type TailLatencyAction,
  type TailLatencyCompletion,
  type TailLatencyConfig,
  type TailLatencyHistoryPoint,
  type TailLatencyMetrics,
  type TailLatencyMitigations,
  type TailLatencyPresetId,
  type TailLatencyState,
  type TailLatencyTransition,
} from "./types";

export * from "./types";
export { TAIL_LATENCY_PRESETS, TAIL_LATENCY_PRESET_BY_ID, getTailLatencyPreset } from "./presets";

const PERCENTILES = [0.5, 0.95, 0.99] as const;

export class TailLatencyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TailLatencyValidationError";
  }
}

interface DistributionResult {
  samples: number[];
  rawSamples: number[];
  metrics: TailLatencyMetrics;
}

/**
 * Nearest-rank percentile over an already sorted sample.  This definition is
 * intentionally explicit so a learner can relate p99 to the sample window.
 */
export function percentile(samples: readonly number[], quantile: number): number {
  if (samples.length === 0) return 0;
  if (!Number.isFinite(quantile) || quantile < 0 || quantile > 1) {
    throw new TailLatencyValidationError(`Percentile must be between 0 and 1; received ${quantile}.`);
  }
  if (quantile === 0) return samples[0] ?? 0;
  const rank = Math.max(1, Math.ceil(quantile * samples.length));
  return samples[Math.min(samples.length, rank) - 1] ?? 0;
}

export const calculatePercentile = percentile;

export function fanOutSlowProbability(
  dependencySlowProbability: number,
  fanOutCount: number,
  correlated = false,
): number {
  assertFraction(dependencySlowProbability, "Dependency slow probability");
  assertIntegerInRange(fanOutCount, MIN_FAN_OUT_COUNT, MAX_FAN_OUT_COUNT, "Fan-out count");
  return correlated
    ? dependencySlowProbability
    : 1 - (1 - dependencySlowProbability) ** fanOutCount;
}

export const calculateFanOutRisk = fanOutSlowProbability;

export function createTailLatencyState(presetId: TailLatencyPresetId): TailLatencyState {
  const preset = getTailLatencyPreset(presetId);
  const completion: TailLatencyCompletion = {
    meaningfulAction: false,
    progressObserved: false,
    completed: false,
  };
  const initial: TailLatencyState = {
    schemaVersion: 1,
    presetId,
    tick: 0,
    config: preset.config,
    mitigations: preset.mitigations,
    slowdownActive: false,
    speed: 1,
    playing: false,
    latencySamples: [],
    history: [],
    metrics: emptyMetrics(preset.config),
    events: [],
    completion,
  };
  const derived = deriveDistribution(initial);
  const point = historyPoint(0, derived.metrics);
  return {
    ...initial,
    latencySamples: derived.samples,
    history: [point],
    metrics: derived.metrics,
  };
}

export function tailLatencyMetrics(state: TailLatencyState): TailLatencyMetrics {
  assertTailLatencyState(state);
  return deriveDistribution(state).metrics;
}

export const calculateTailLatencyMetrics = tailLatencyMetrics;

export function transitionTailLatency(
  input: TailLatencyState,
  action: TailLatencyAction,
): TailLatencyTransition {
  assertTailLatencyState(input);
  assertAction(action);

  if (action.type === "reset") {
    const reset = createTailLatencyState(input.presetId);
    return { state: reset, events: [], metrics: reset.metrics };
  }

  let state = cloneState(input);
  const previousMetrics = deriveDistribution(state).metrics;
  let meaningfulAction = state.completion.meaningfulAction;
  let emitted: SimulationEvent[] = [];

  switch (action.type) {
    case "step": {
      state.tick += 1;
      const derived = deriveDistribution(state);
      state = {
        ...state,
        latencySamples: derived.samples,
        metrics: derived.metrics,
        history: appendHistory(state.history, historyPoint(state.tick, derived.metrics)),
      };
      emitted = [
        event(
          state,
          "sampled-latency-window",
          "Latency window sampled",
          `p50 ${formatMs(derived.metrics.p50Ms)}, p99 ${formatMs(derived.metrics.p99Ms)}, and maximum ${formatMs(derived.metrics.maxMs)} over ${derived.metrics.sampleWindow.toLocaleString("en-US")} logical requests.`,
          derived.metrics.p99Ms > derived.metrics.p50Ms * 2 ? "warning" : "info",
        ),
      ];
      const completed = meaningfulAction;
      state.completion = {
        meaningfulAction,
        progressObserved: true,
        completed: state.completion.completed || completed,
      };
      break;
    }
    case "play":
      state.playing = true;
      emitted = [event(state, "playback-started", "Playback started", "Step advances the same deterministic distribution model.", "info")];
      break;
    case "pause":
      state.playing = false;
      emitted = [event(state, "playback-paused", "Playback paused", "The current latency window remains available for inspection.", "info")];
      break;
    case "set-speed":
      assertSpeed(action.speed);
      state.speed = action.speed;
      emitted = [event(state, "speed-changed", "Playback speed changed", `Playback speed is ${action.speed}×.`, "info")];
      break;
    case "set-average-service-time":
    case "set-service-time":
      assertNumberInRange(action.milliseconds, MIN_AVERAGE_SERVICE_MS, MAX_AVERAGE_SERVICE_MS, "Average service time");
      state.config.averageServiceMs = action.milliseconds;
      meaningfulAction = true;
      emitted = [event(state, "control-changed", "Fast-path service time changed", `Fast-path service time is ${formatMs(action.milliseconds)}.`, "info")];
      break;
    case "set-slow-probability":
    case "set-slow-request-probability":
      assertFractionInRange(action.probability, MIN_SLOW_REQUEST_PROBABILITY, MAX_SLOW_REQUEST_PROBABILITY, "Slow-request probability");
      state.config.slowRequestProbability = action.probability;
      meaningfulAction = true;
      emitted = [event(state, "control-changed", "Slow-request probability changed", `${formatPercent(action.probability)} of one dependency's requests take the slow path.`, "info")];
      break;
    case "set-slow-latency":
      assertNumberInRange(action.milliseconds, MIN_SLOW_REQUEST_LATENCY_MS, MAX_SLOW_REQUEST_LATENCY_MS, "Slow-request latency");
      state.config.slowRequestLatencyMs = action.milliseconds;
      meaningfulAction = true;
      emitted = [event(state, "control-changed", "Slow-path latency changed", `Slow-path dependency latency is ${formatMs(action.milliseconds)}.`, "info")];
      break;
    case "set-fan-out":
    case "set-fan-out-count":
      assertIntegerInRange(action.count, MIN_FAN_OUT_COUNT, MAX_FAN_OUT_COUNT, "Fan-out count");
      state.config.fanOutCount = action.count;
      meaningfulAction = true;
      emitted = [event(state, "fan-out-changed", "Fan-out changed", `${action.count} dependency calls share the request critical path.`, action.count > 1 ? "warning" : "info")];
      break;
    case "set-queue-utilization":
      assertFractionInRange(action.utilization, MIN_QUEUE_UTILIZATION, MAX_QUEUE_UTILIZATION, "Queue utilization");
      state.config.queueUtilization = action.utilization;
      meaningfulAction = true;
      emitted = [event(state, "queue-changed", "Queue utilization changed", `Modeled utilization is ${formatPercent(action.utilization)}; waiting time grows nonlinearly near saturation.`, action.utilization >= 0.7 ? "warning" : "info")];
      break;
    case "set-sample-window":
      assertIntegerInRange(action.requests, MIN_SAMPLE_WINDOW, MAX_SAMPLE_WINDOW, "Sample window");
      state.config.sampleWindow = action.requests;
      meaningfulAction = true;
      emitted = [event(state, "window-changed", "Sample window changed", `Percentiles use ${action.requests.toLocaleString("en-US")} logical requests; the rendered sample is bounded.`, "info")];
      break;
    case "set-timeout":
      assertNumberInRange(action.milliseconds, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS, "Timeout");
      state.mitigations.timeoutMs = action.milliseconds;
      meaningfulAction = true;
      emitted = [event(state, "timeout-changed", "Deadline changed", `Requests above ${formatMs(action.milliseconds)} are eligible for timeout or graceful degradation.`, "info")];
      break;
    case "toggle-hedging":
      state.mitigations.hedgingEnabled = !state.mitigations.hedgingEnabled;
      meaningfulAction = true;
      emitted = [event(state, "hedging-changed", "Hedging changed", state.mitigations.hedgingEnabled ? "A duplicate read can race a slow dependency, reducing tail risk while adding load." : "Hedging is off; each dependency is attempted once.", state.mitigations.hedgingEnabled ? "warning" : "info")];
      break;
    case "toggle-timeout":
      state.mitigations.timeoutEnabled = !state.mitigations.timeoutEnabled;
      meaningfulAction = true;
      emitted = [event(state, "timeout-changed", "Timeout protection changed", state.mitigations.timeoutEnabled ? `A ${formatMs(state.mitigations.timeoutMs)} deadline caps slow work but can turn it into an error.` : "Timeout protection is off; slow work can run to completion.", state.mitigations.timeoutEnabled ? "warning" : "info")];
      break;
    case "toggle-graceful-degradation":
      state.mitigations.gracefulDegradationEnabled = !state.mitigations.gracefulDegradationEnabled;
      meaningfulAction = true;
      emitted = [event(state, "degradation-changed", "Graceful degradation changed", state.mitigations.gracefulDegradationEnabled ? "Optional dependency results may be omitted at the deadline to protect the user tail." : "The request keeps waiting for all modeled dependency results.", state.mitigations.gracefulDegradationEnabled ? "warning" : "info")];
      break;
    case "toggle-correlated-slowdown":
      state.mitigations.correlatedSlowdownEnabled = !state.mitigations.correlatedSlowdownEnabled;
      meaningfulAction = true;
      emitted = [event(state, "correlation-changed", "Correlation assumption changed", state.mitigations.correlatedSlowdownEnabled ? "Dependencies share a common-cause slowdown; the independent fan-out formula no longer applies." : "Dependencies use the independent-call approximation.", "warning")];
      break;
    case "inject-slowdown":
    case "inject-failure":
      state.slowdownActive = true;
      meaningfulAction = true;
      emitted = [event(state, "slowdown-injected", "Dependency slowdown injected", state.mitigations.correlatedSlowdownEnabled ? "A correlated slowdown affects the shared dependency path." : "A slow dependency cohort is now more common; inspect p99 rather than the average.", "failure")];
      break;
    case "recover-slowdown":
    case "recover-failure":
      state.slowdownActive = false;
      meaningfulAction = true;
      emitted = [event(state, "slowdown-recovered", "Dependency slowdown cleared", "The injected slowdown is removed; the authored tail distribution remains visible.", "success")];
      break;
    default:
      return assertNever(action);
  }

  const derived = deriveDistribution(state);
  state.latencySamples = derived.samples;
  state.metrics = derived.metrics;
  state.completion = {
    meaningfulAction,
    progressObserved: state.completion.progressObserved,
    completed: state.completion.completed,
  };
  state.events = appendEvents(state.events, emitted);

  // A control action changes the current window immediately, while the
  // bounded history records observations only when the learner steps time.
  if (action.type !== "step" && previousMetrics.p99Ms !== derived.metrics.p99Ms) {
    state.history = state.history.slice(-MAX_LATENCY_HISTORY);
  }

  return { state, events: emitted, metrics: derived.metrics };
}

/** Alias retained for callers that use the longer state-oriented name. */
export const transitionTailLatencyState = transitionTailLatency;

export function toTailLatencySimulationMetrics(
  metrics: TailLatencyMetrics,
): SimulationMetric[] {
  return [
    metric("average", "Average", formatMs(metrics.averageMs), "The mean can stay healthy while the slow edge grows."),
    metric("p50", "p50 / median", formatMs(metrics.p50Ms), "Half of sampled requests are at or below this value."),
    metric("p95", "p95", formatMs(metrics.p95Ms), "Five percent of sampled requests are slower.", metrics.p95Ms > metrics.p50Ms * 1.5 ? "warning" : "info"),
    metric("p99", "p99", formatMs(metrics.p99Ms), "One percent are slower in this stated window.", metrics.p99Ms > metrics.p50Ms * 2 ? "warning" : "info"),
    metric("fan-out-risk", "Fan-out slow risk", formatPercent(metrics.fanOutSlowProbability), `${metrics.fanOutCount} parallel calls; independent estimate ${formatPercent(metrics.independentFanOutRisk)}.`, metrics.fanOutSlowProbability > 0.1 ? "warning" : "info"),
    metric("tail-cost", "Tail mitigation cost", metrics.hedgeLoadMultiplier > 1 ? `+${Math.round((metrics.hedgeLoadMultiplier - 1) * 100)}% load` : metrics.partialResponseRate > 0 ? `${formatPercent(metrics.partialResponseRate)} partial` : metrics.timeoutRate > 0 ? `${formatPercent(metrics.timeoutRate)} timeout` : "none", mitigationDetail(metrics), metrics.timeoutRate > 0 ? "failure" : metrics.partialResponseRate > 0 || metrics.hedgeLoadMultiplier > 1 ? "warning" : "success"),
  ];
}

export const tailLatencySimulationMetrics = toTailLatencySimulationMetrics;

function deriveDistribution(state: TailLatencyState): DistributionResult {
  const config = state.config;
  const mitigations = state.mitigations;
  const sampleCount = Math.min(MAX_LATENCY_SAMPLE_COUNT, config.sampleWindow);
  const slowdownProbabilityBoost = state.slowdownActive
    ? mitigations.correlatedSlowdownEnabled
      ? 0.15
      : 0.05
    : 0;
  const dependencySlowProbability = clamp(
    config.slowRequestProbability + slowdownProbabilityBoost,
    0,
    1,
  );
  const independentRisk = 1 - (1 - dependencySlowProbability) ** config.fanOutCount;
  const fanOutRisk = mitigations.correlatedSlowdownEnabled
    ? dependencySlowProbability
    : independentRisk;
  const effectiveRisk = mitigations.hedgingEnabled
    ? fanOutRisk * fanOutRisk
    : fanOutRisk;
  const queueWaitMs = calculateQueueWait(config.averageServiceMs, config.queueUtilization);
  const slowdownFactor = state.slowdownActive
    ? mitigations.correlatedSlowdownEnabled
      ? 1.8
      : 1.35
    : 1;
  const fastLatency = (config.averageServiceMs + queueWaitMs) * slowdownFactor;
  const rawSlowLatency = (config.slowRequestLatencyMs + queueWaitMs) * slowdownFactor;
  const effectiveSlowLatency = mitigations.hedgingEnabled
    ? Math.min(rawSlowLatency, config.slowRequestLatencyMs * 0.65 + queueWaitMs)
    : rawSlowLatency;
  const rawSlowCount = countForProbability(sampleCount, fanOutRisk);
  const effectiveSlowCount = countForProbability(sampleCount, effectiveRisk);
  const rawSamples = buildSamples(sampleCount, rawSlowCount, fastLatency, rawSlowLatency);
  const timeoutApplies = mitigations.timeoutEnabled || mitigations.gracefulDegradationEnabled;
  const cappedSlowLatency = timeoutApplies
    ? Math.min(effectiveSlowLatency, mitigations.timeoutMs)
    : effectiveSlowLatency;
  const effectiveSamples = buildSamples(sampleCount, effectiveSlowCount, fastLatency, cappedSlowLatency);
  const timeoutCount = mitigations.timeoutEnabled && effectiveSlowLatency > mitigations.timeoutMs
    ? effectiveSlowCount
    : 0;
  const partialCount = mitigations.gracefulDegradationEnabled && effectiveSlowLatency > mitigations.timeoutMs
    ? effectiveSlowCount
    : 0;
  const averageMs = mean(effectiveSamples);
  const p50Ms = percentile(effectiveSamples, PERCENTILES[0]);
  const p95Ms = percentile(effectiveSamples, PERCENTILES[1]);
  const p99Ms = percentile(effectiveSamples, PERCENTILES[2]);
  const maxMs = effectiveSamples.at(-1) ?? 0;
  const rawAverageMs = mean(rawSamples);
  const rawP99Ms = percentile(rawSamples, PERCENTILES[2]);
  const hedgeCount = mitigations.hedgingEnabled
    ? Math.max(0, rawSlowCount - effectiveSlowCount)
    : 0;
  const hedgeRate = sampleCount > 0 ? hedgeCount / sampleCount : 0;
  const hedgeLoadMultiplier = mitigations.hedgingEnabled ? 1 + Math.min(0.75, hedgeRate) : 1;

  return {
    samples: effectiveSamples,
    rawSamples,
    metrics: {
      sampleCount,
      sampleWindow: config.sampleWindow,
      averageMs,
      p50Ms,
      p95Ms,
      p99Ms,
      maxMs,
      rawAverageMs,
      rawP99Ms,
      slowRequestProbability: dependencySlowProbability,
      effectiveSlowProbability: effectiveRisk,
      fanOutCount: config.fanOutCount,
      independentFanOutRisk: independentRisk,
      fanOutSlowProbability: fanOutRisk,
      fanOutAmplification: dependencySlowProbability > 0 ? fanOutRisk / dependencySlowProbability : 1,
      queueUtilization: config.queueUtilization,
      queueWaitMs,
      timeoutRate: sampleCount > 0 ? timeoutCount / sampleCount : 0,
      partialResponseRate: sampleCount > 0 ? partialCount / sampleCount : 0,
      hedgeRate,
      hedgeLoadMultiplier,
      extraHedgeRequests: hedgeCount,
      tailSpreadMs: Math.max(0, p99Ms - p50Ms),
      slowdownActive: state.slowdownActive,
    },
  };
}

function emptyMetrics(config: TailLatencyConfig): TailLatencyMetrics {
  return {
    sampleCount: Math.min(MAX_LATENCY_SAMPLE_COUNT, config.sampleWindow),
    sampleWindow: config.sampleWindow,
    averageMs: 0,
    p50Ms: 0,
    p95Ms: 0,
    p99Ms: 0,
    maxMs: 0,
    rawAverageMs: 0,
    rawP99Ms: 0,
    slowRequestProbability: 0,
    effectiveSlowProbability: 0,
    fanOutCount: config.fanOutCount,
    independentFanOutRisk: 0,
    fanOutSlowProbability: 0,
    fanOutAmplification: 1,
    queueUtilization: config.queueUtilization,
    queueWaitMs: 0,
    timeoutRate: 0,
    partialResponseRate: 0,
    hedgeRate: 0,
    hedgeLoadMultiplier: 1,
    extraHedgeRequests: 0,
    tailSpreadMs: 0,
    slowdownActive: false,
  };
}

function buildSamples(count: number, slowCount: number, fastLatency: number, slowLatency: number): number[] {
  const boundedSlowCount = Math.max(0, Math.min(count, slowCount));
  const fastCount = count - boundedSlowCount;
  return [
    ...Array.from({ length: fastCount }, () => roundMs(fastLatency)),
    ...Array.from({ length: boundedSlowCount }, () => roundMs(Math.max(fastLatency, slowLatency))),
  ];
}

function countForProbability(sampleCount: number, probability: number): number {
  if (sampleCount <= 0 || probability <= 0) return 0;
  // Subtract a tiny epsilon before ceil so authored values such as 0.01 ×
  // 100 do not become two observations because of binary floating point.
  return Math.min(sampleCount, Math.max(1, Math.ceil(sampleCount * probability - 1e-9)));
}

function calculateQueueWait(serviceMs: number, utilization: number): number {
  if (utilization <= 0) return 0;
  const denominator = Math.max(0.05, 1 - utilization);
  return serviceMs * Math.min(6, utilization / denominator);
}

function historyPoint(tick: number, metrics: TailLatencyMetrics): TailLatencyHistoryPoint {
  return {
    tick,
    averageMs: metrics.averageMs,
    p50Ms: metrics.p50Ms,
    p95Ms: metrics.p95Ms,
    p99Ms: metrics.p99Ms,
    maxMs: metrics.maxMs,
    fanOutSlowProbability: metrics.fanOutSlowProbability,
  };
}

function appendHistory(
  history: readonly TailLatencyHistoryPoint[],
  next: TailLatencyHistoryPoint,
): TailLatencyHistoryPoint[] {
  return [...history, next].slice(-MAX_LATENCY_HISTORY);
}

function appendEvents(
  events: readonly SimulationEvent[],
  next: readonly SimulationEvent[],
): SimulationEvent[] {
  return [...events, ...next].slice(-MAX_LATENCY_EVENT_COUNT);
}

function event(
  state: TailLatencyState,
  type: string,
  title: string,
  detail: string,
  tone: SimulationEvent["tone"],
): SimulationEvent {
  return {
    id: `tail-latency-${state.tick}-${state.events.length}-${type}`,
    tick: state.tick,
    type,
    title,
    detail,
    tone,
  };
}

function metric(
  id: string,
  label: string,
  value: string,
  detail: string,
  tone: SimulationMetric["tone"] = "info",
): SimulationMetric {
  return { id, label, value, detail, tone };
}

function mitigationDetail(metrics: TailLatencyMetrics): string {
  if (metrics.timeoutRate > 0 && metrics.partialResponseRate > 0) {
    return "Deadlines cap the tail; graceful degradation labels the omitted optional results.";
  }
  if (metrics.timeoutRate > 0) return "Timeouts cap latency but turn the slow cohort into failed work.";
  if (metrics.partialResponseRate > 0) return "Partial responses protect responsiveness while reducing completeness.";
  if (metrics.hedgeLoadMultiplier > 1) return "Hedging reduces the modeled tail at the cost of duplicate read load.";
  return "No tail mitigation is active; inspect the distribution before changing capacity.";
}

function cloneState(state: TailLatencyState): TailLatencyState {
  return {
    ...state,
    config: { ...state.config },
    mitigations: { ...state.mitigations },
    latencySamples: [...state.latencySamples],
    history: state.history.map((point) => ({ ...point })),
    metrics: { ...state.metrics },
    events: state.events.map((currentEvent) => ({ ...currentEvent })),
    completion: { ...state.completion },
  };
}

function assertTailLatencyState(state: TailLatencyState): void {
  if (!state || typeof state !== "object") throw new TailLatencyValidationError("Tail-latency state must be an object.");
  if (state.schemaVersion !== 1) throw new TailLatencyValidationError("Unsupported tail-latency state schema.");
  if (!TAIL_LATENCY_PRESETS.some((preset) => preset.id === state.presetId)) {
    throw new TailLatencyValidationError(`Unknown tail-latency preset: ${String(state.presetId)}.`);
  }
  assertConfig(state.config);
  assertMitigations(state.mitigations);
  if (!Number.isInteger(state.tick) || state.tick < 0) throw new TailLatencyValidationError("Tick must be a non-negative integer.");
  if (state.history.length > MAX_LATENCY_HISTORY) throw new TailLatencyValidationError("Latency history exceeded its bound.");
  if (state.latencySamples.length > MAX_LATENCY_SAMPLE_COUNT) throw new TailLatencyValidationError("Latency sample exceeded its bound.");
}

function assertConfig(config: TailLatencyConfig): void {
  assertNumberInRange(config.averageServiceMs, MIN_AVERAGE_SERVICE_MS, MAX_AVERAGE_SERVICE_MS, "Average service time");
  assertFractionInRange(config.slowRequestProbability, MIN_SLOW_REQUEST_PROBABILITY, MAX_SLOW_REQUEST_PROBABILITY, "Slow-request probability");
  assertNumberInRange(config.slowRequestLatencyMs, MIN_SLOW_REQUEST_LATENCY_MS, MAX_SLOW_REQUEST_LATENCY_MS, "Slow-request latency");
  assertIntegerInRange(config.fanOutCount, MIN_FAN_OUT_COUNT, MAX_FAN_OUT_COUNT, "Fan-out count");
  assertFractionInRange(config.queueUtilization, MIN_QUEUE_UTILIZATION, MAX_QUEUE_UTILIZATION, "Queue utilization");
  assertIntegerInRange(config.sampleWindow, MIN_SAMPLE_WINDOW, MAX_SAMPLE_WINDOW, "Sample window");
}

function assertMitigations(mitigations: TailLatencyMitigations): void {
  if (!mitigations || typeof mitigations !== "object") throw new TailLatencyValidationError("Mitigations must be an object.");
  for (const value of [mitigations.hedgingEnabled, mitigations.timeoutEnabled, mitigations.gracefulDegradationEnabled, mitigations.correlatedSlowdownEnabled]) {
    if (typeof value !== "boolean") throw new TailLatencyValidationError("Mitigation toggles must be boolean.");
  }
  assertNumberInRange(mitigations.timeoutMs, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS, "Timeout");
}

function assertAction(action: TailLatencyAction): void {
  if (!action || typeof action !== "object" || typeof action.type !== "string") {
    throw new TailLatencyValidationError("Tail-latency action must contain a type.");
  }
}

function assertSpeed(speed: SimulationSpeed): void {
  if (!SIMULATION_SPEEDS.includes(speed)) throw new TailLatencyValidationError(`Unsupported simulation speed: ${String(speed)}.`);
}

function assertNumberInRange(value: number, minimum: number, maximum: number, label: string): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new TailLatencyValidationError(`${label} must be between ${minimum} and ${maximum}; received ${value}.`);
  }
}

function assertFractionInRange(value: number, minimum: number, maximum: number, label: string): void {
  assertNumberInRange(value, minimum, maximum, label);
}

function assertFraction(value: number, label: string): void {
  assertFractionInRange(value, 0, 1, label);
}

function assertIntegerInRange(value: number, minimum: number, maximum: number, label: string): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TailLatencyValidationError(`${label} must be an integer between ${minimum} and ${maximum}; received ${value}.`);
  }
}

function cloneActionNever(action: never): never {
  throw new TailLatencyValidationError(`Unsupported tail-latency action: ${String(action)}.`);
}

function assertNever(action: never): never {
  return cloneActionNever(action);
}

function mean(samples: readonly number[]): number {
  if (samples.length === 0) return 0;
  return samples.reduce((total, value) => total + value, 0) / samples.length;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundMs(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatMs(value: number): string {
  return `${roundMs(value).toLocaleString("en-US", { maximumFractionDigits: 1 })} ms`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(value * 100 >= 10 ? 0 : 1)}%`;
}
