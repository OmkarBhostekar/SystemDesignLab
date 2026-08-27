import type {
  SimulationEvent,
  SimulationEventTone,
  SimulationMetric,
} from "@/simulations/types";

import { getBackpressurePreset } from "./presets";
import {
  BACKPRESSURE_ADMISSION_POLICIES,
  BACKPRESSURE_PRESET_IDS,
  BACKPRESSURE_PRIORITY_POLICIES,
  MAX_BACKPRESSURE_EVENT_COUNT,
  MAX_BACKPRESSURE_HISTORY,
  MAX_BACKPRESSURE_QUEUE_CAPACITY,
  type BackpressureAction,
  type BackpressureAdmissionPolicy,
  type BackpressureCompletion,
  type BackpressureConfig,
  type BackpressureCounters,
  type BackpressureHistoryPoint,
  type BackpressureMetrics,
  type BackpressurePriorityPolicy,
  type BackpressurePresetId,
  type BackpressureRetryItem,
  type BackpressureRuntime,
  type BackpressureState,
  type BackpressureTransition,
  type BackpressureWorkItem,
  type BackpressureWorkPriority,
  BackpressureValidationError,
} from "./types";

export * from "./types";
export {
  BACKPRESSURE_PRESETS,
  BACKPRESSURE_PRESET_BY_ID,
  getBackpressurePreset,
} from "./presets";

export const BACKPRESSURE_MIN_ARRIVAL_RATE = 0;
export const BACKPRESSURE_MAX_ARRIVAL_RATE = 64;
export const BACKPRESSURE_MIN_SERVICE_RATE = 0;
export const BACKPRESSURE_MAX_SERVICE_RATE = 24;
export const BACKPRESSURE_MIN_QUEUE_CAPACITY = 1;
export const BACKPRESSURE_MIN_PREFETCH = 1;
export const BACKPRESSURE_MAX_PREFETCH = 16;
export const BACKPRESSURE_MIN_CONSUMERS = 1;
export const BACKPRESSURE_MAX_CONSUMERS = 12;
export const BACKPRESSURE_MIN_DOWNSTREAM_LIMIT = 1;
export const BACKPRESSURE_MAX_DOWNSTREAM_LIMIT = 32;
export const BACKPRESSURE_MIN_RETRY_LIMIT = 0;
export const BACKPRESSURE_MAX_RETRY_LIMIT = 6;
export const BACKPRESSURE_MIN_PARTITIONS = 1;
export const BACKPRESSURE_MAX_PARTITIONS = 8;

const WORK_PRIORITY_RANK: Record<BackpressureWorkPriority, number> = {
  "best-effort": 0,
  normal: 1,
  critical: 2,
};

interface StepAdmissionSummary {
  accepted: number;
  rejected: number;
  dropped: number;
  throttled: number;
  retriesDue: number;
}

/**
 * Reconstruct the exact authored initial state. No browser clock, random
 * source, or mutable preset object participates in a transition.
 */
export function createBackpressureState(
  presetId: BackpressurePresetId = "steady-capacity",
): BackpressureState {
  const preset = getBackpressurePreset(presetId);
  const runtime: BackpressureRuntime = {
    downstreamAvailable: preset.initialDownstreamAvailable ?? true,
    outageStartTick: null,
    recoveryTick: null,
    recoveryCompletedTick: null,
    recoveryObserved: false,
  };
  const counters = emptyCounters();
  const initial: BackpressureState = {
    schemaVersion: 1,
    presetId: preset.id,
    tick: 0,
    config: { ...preset.config },
    runtime,
    queue: [],
    workerBuffer: [],
    processing: [],
    retryQueue: [],
    nextJobNumber: 1,
    counters,
    lastThroughput: 0,
    history: [],
    events: [],
    eventSequence: 0,
    metrics: emptyMetrics(0, preset.config, runtime, [], [], [], [], counters, 0),
    completion: emptyCompletion(),
  };
  initial.metrics = backpressureMetrics(initial);
  initial.history = [historyPoint(initial.metrics)];
  initial.metrics = backpressureMetrics(initial);
  return initial;
}

export function backpressureMetrics(state: BackpressureState): BackpressureMetrics {
  assertBackpressureState(state);
  return metricsFor(state);
}

export const calculateBackpressureMetrics = backpressureMetrics;

/**
 * Advance one deterministic model tick or apply a bounded control change.
 * React owns playback; this function only owns domain state.
 */
export function transitionBackpressure(
  input: BackpressureState,
  action: BackpressureAction,
): BackpressureTransition {
  assertBackpressureState(input);
  assertBackpressureAction(action);

  if (action.type === "reset") {
    const reset = createBackpressureState(input.presetId);
    return { state: reset, events: [], metrics: reset.metrics };
  }

  const state = cloneState(input);
  const emitted: SimulationEvent[] = [];
  let meaningfulAction = state.completion.meaningfulAction;

  switch (action.type) {
    case "step":
      meaningfulAction = true;
      advanceOneTick(state, emitted);
      break;
    case "play":
    case "pause":
      // Playback is presentation state in the shared shell. Accepting these
      // actions keeps the pure engine convenient for callers that serialize a
      // complete action stream without making outcomes depend on playback.
      meaningfulAction = state.completion.meaningfulAction;
      break;
    case "set-arrival-rate":
    case "set-arrival":
      state.config.arrivalRate = assertIntegerRange(
        action.rate,
        BACKPRESSURE_MIN_ARRIVAL_RATE,
        BACKPRESSURE_MAX_ARRIVAL_RATE,
        "Arrival rate",
      );
      meaningfulAction = true;
      emitControlEvent(state, emitted, "arrival-rate", "Producer rate changed", `The producer now offers ${state.config.arrivalRate} jobs per tick.`, "info");
      break;
    case "set-burst-rate":
      state.config.burstRate = assertIntegerRange(
        action.rate,
        BACKPRESSURE_MIN_ARRIVAL_RATE,
        BACKPRESSURE_MAX_ARRIVAL_RATE,
        "Burst arrival rate",
      );
      meaningfulAction = true;
      emitControlEvent(state, emitted, "burst-rate", "Burst rate changed", `The burst window offers ${state.config.burstRate} jobs per tick.`, "info");
      break;
    case "set-service-rate":
      state.config.serviceRate = assertIntegerRange(
        action.rate,
        BACKPRESSURE_MIN_SERVICE_RATE,
        BACKPRESSURE_MAX_SERVICE_RATE,
        "Service rate",
      );
      meaningfulAction = true;
      emitControlEvent(state, emitted, "service-rate", "Worker service rate changed", `Each consumer can complete ${state.config.serviceRate} jobs per tick.`, "info");
      break;
    case "set-queue-capacity":
    case "set-queue-size": {
      const capacity = assertIntegerRange(
        action.capacity,
        BACKPRESSURE_MIN_QUEUE_CAPACITY,
        MAX_BACKPRESSURE_QUEUE_CAPACITY,
        "Queue capacity",
      );
      if (capacity < state.queue.length) {
        throw new BackpressureValidationError(
          `Queue capacity ${capacity} is below the current broker depth ${state.queue.length}; shed or drain work first.`,
        );
      }
      state.config.queueCapacity = capacity;
      meaningfulAction = true;
      emitControlEvent(state, emitted, "queue-capacity", "Broker capacity changed", `The bounded broker now retains at most ${capacity} queued jobs.`, "info");
      break;
    }
    case "set-prefetch":
      state.config.prefetch = assertIntegerRange(
        action.count,
        BACKPRESSURE_MIN_PREFETCH,
        BACKPRESSURE_MAX_PREFETCH,
        "Prefetch",
      );
      meaningfulAction = true;
      emitControlEvent(state, emitted, "prefetch", "Consumer prefetch changed", `Each consumer may hold ${state.config.prefetch} unacknowledged jobs.`, "info");
      break;
    case "set-consumer-count":
    case "set-consumers":
      state.config.consumerCount = assertIntegerRange(
        action.count,
        BACKPRESSURE_MIN_CONSUMERS,
        BACKPRESSURE_MAX_CONSUMERS,
        "Consumer count",
      );
      meaningfulAction = true;
      emitControlEvent(state, emitted, "consumer-count", "Consumer count changed", `${state.config.consumerCount} consumers share the partitions.`, "info");
      break;
    case "set-downstream-limit":
      state.config.downstreamLimit = assertIntegerRange(
        action.limit,
        BACKPRESSURE_MIN_DOWNSTREAM_LIMIT,
        BACKPRESSURE_MAX_DOWNSTREAM_LIMIT,
        "Downstream limit",
      );
      meaningfulAction = true;
      emitControlEvent(state, emitted, "downstream-limit", "Dependency limit changed", `The downstream allows ${state.config.downstreamLimit} concurrent calls.`, "info");
      break;
    case "set-retry-limit":
    case "set-retries":
      state.config.retryLimit = assertIntegerRange(
        action.count,
        BACKPRESSURE_MIN_RETRY_LIMIT,
        BACKPRESSURE_MAX_RETRY_LIMIT,
        "Retry limit",
      );
      meaningfulAction = true;
      emitControlEvent(state, emitted, "retry-limit", "Retry budget changed", `Each failed attempt can be retried ${state.config.retryLimit} time${state.config.retryLimit === 1 ? "" : "s"}.`, "warning");
      break;
    case "set-priority-policy":
    case "set-priority":
      assertPriorityPolicy(action.policy);
      state.config.priorityPolicy = action.policy;
      meaningfulAction = true;
      emitControlEvent(state, emitted, "priority-policy", "Priority policy changed", priorityPolicyDetail(action.policy), "info");
      break;
    case "set-admission-policy":
    case "set-shedding-policy":
      assertAdmissionPolicy(action.policy);
      state.config.admissionPolicy = action.policy;
      meaningfulAction = true;
      emitControlEvent(state, emitted, "admission-policy", "Admission policy changed", admissionPolicyDetail(action.policy), "warning");
      break;
    case "set-partition-count": {
      const count = assertIntegerRange(
        action.count,
        BACKPRESSURE_MIN_PARTITIONS,
        BACKPRESSURE_MAX_PARTITIONS,
        "Partition count",
      );
      state.config.partitionCount = count;
      for (const item of [...state.queue, ...state.workerBuffer, ...state.processing]) {
        item.partition = partitionForJob(item.id, count);
      }
      for (const retry of state.retryQueue) retry.item.partition = partitionForJob(retry.item.id, count);
      meaningfulAction = true;
      emitControlEvent(state, emitted, "partition-count", "Partition count changed", `${count} broker partitions now receive the logical workload.`, "info");
      break;
    }
    case "inject-outage":
    case "inject-failure":
      if (state.runtime.downstreamAvailable) {
        state.runtime.downstreamAvailable = false;
        state.runtime.outageStartTick = state.tick;
        state.runtime.recoveryTick = null;
        state.runtime.recoveryCompletedTick = null;
        state.runtime.recoveryObserved = false;
        emitControlEvent(state, emitted, "outage-injected", "Downstream outage injected", "New calls fail while the dependency is unavailable; watch retries and queue age.", "failure");
      }
      meaningfulAction = true;
      break;
    case "recover-outage":
    case "recover-failure":
      if (!state.runtime.downstreamAvailable) {
        state.runtime.downstreamAvailable = true;
        state.runtime.recoveryTick = state.tick;
        state.runtime.recoveryCompletedTick = pendingWorkCount(state) === 0 ? state.tick : null;
        state.runtime.recoveryObserved = true;
        emitControlEvent(state, emitted, "outage-recovered", "Downstream recovered", "New calls can complete again; drain the bounded backlog and compare recovery time.", "success");
        if (state.runtime.recoveryCompletedTick !== null) {
          emitControlEvent(state, emitted, "recovery-drained", "Backlog already drained", "No pending work remained when the dependency recovered; post-recovery drain time is 0 ticks.", "success");
        }
      }
      meaningfulAction = true;
      break;
    case "toggle-outage":
      if (state.runtime.downstreamAvailable) {
        state.runtime.downstreamAvailable = false;
        state.runtime.outageStartTick = state.tick;
        state.runtime.recoveryTick = null;
        state.runtime.recoveryCompletedTick = null;
        state.runtime.recoveryObserved = false;
        emitControlEvent(state, emitted, "outage-injected", "Downstream outage injected", "New calls fail while the dependency is unavailable; watch retries and queue age.", "failure");
      } else {
        state.runtime.downstreamAvailable = true;
        state.runtime.recoveryTick = state.tick;
        state.runtime.recoveryCompletedTick = pendingWorkCount(state) === 0 ? state.tick : null;
        state.runtime.recoveryObserved = true;
        emitControlEvent(state, emitted, "outage-recovered", "Downstream recovered", "New calls can complete again; drain the bounded backlog and compare recovery time.", "success");
        if (state.runtime.recoveryCompletedTick !== null) {
          emitControlEvent(state, emitted, "recovery-drained", "Backlog already drained", "No pending work remained when the dependency recovered; post-recovery drain time is 0 ticks.", "success");
        }
      }
      meaningfulAction = true;
      break;
    default:
      return assertNever(action);
  }

  state.metrics = metricsFor(state);
  if (action.type === "step") {
    state.history = appendHistory(state.history, historyPoint(state.metrics));
    state.metrics = metricsFor(state);
  }

  state.completion = completionFor(state, meaningfulAction);
  state.events = appendEvents(state.events, emitted);
  state.metrics = metricsFor(state);
  return { state, events: emitted, metrics: state.metrics };
}

/** Alias retained for callers that prefer a state-oriented function name. */
export const transitionBackpressureState = transitionBackpressure;

export function toBackpressureSimulationMetrics(
  metrics: BackpressureMetrics,
): SimulationMetric[] {
  return [
    metric("queue-depth", "Queue depth", `${metrics.queueDepth} / ${metrics.queueCapacity}`, `${formatPercent(metrics.queueUtilization)} of bounded broker capacity; oldest queued job is ${formatAge(metrics.oldestAgeTicks)}.`, metrics.queueUtilization >= 0.8 ? "warning" : "info"),
    metric("in-flight-memory", "In-flight memory", `${metrics.inFlightMemory} / ${metrics.inFlightMemoryCapacity}`, "Prefetch controls unacknowledged worker memory; it does not raise downstream service rate.", metrics.inFlightMemory >= metrics.inFlightMemoryCapacity ? "warning" : "info"),
    metric("throughput", "Throughput", `${metrics.throughput} jobs/tick`, `${metrics.serviceCapacity} jobs/tick is the current worker/dependency capacity.`, metrics.throughput > 0 ? "success" : "info"),
    metric("rejected-dropped", "Rejected / dropped", `${metrics.rejected} / ${metrics.dropped}`, `${metrics.throttled} arrivals were throttled; explicit loss stays visible.`, metrics.rejected + metrics.dropped > 0 ? "failure" : "success"),
    metric("dependency-saturation", "Dependency saturation", metrics.downstreamAvailable ? formatPercent(metrics.dependencySaturation) : "outage", metrics.downstreamAvailable ? `${metrics.processingCount} of ${metrics.downstreamLimit} downstream slots are modeled.` : "The dependency is unavailable; safe policies stop issuing new calls.", metrics.downstreamAvailable ? (metrics.dependencySaturation >= 0.9 ? "warning" : "info") : "failure"),
    metric("retry-amplification", "Retry amplification", `${metrics.retryAmplification.toFixed(2)}×`, `${metrics.retries} retry attempts across ${metrics.attempts} total calls; a retry budget bounds failure traffic.`, metrics.retryAmplification > 1.2 ? "warning" : "info"),
  ];
}

/** Alias retained for renderer callers using the longer helper name. */
export const backpressureSimulationMetrics = toBackpressureSimulationMetrics;

function advanceOneTick(state: BackpressureState, emitted: SimulationEvent[]): void {
  state.tick += 1;
  state.lastThroughput = 0;
  const summary: StepAdmissionSummary = {
    accepted: 0,
    rejected: 0,
    dropped: 0,
    throttled: 0,
    retriesDue: 0,
  };

  completeProcessing(state, emitted, summary);
  admitDueRetries(state, summary);

  const arrivals = arrivalsForTick(state);
  const throttleBudget = state.config.admissionPolicy === "throttle"
    ? Math.max(0, effectiveServiceCapacity(state) - pendingWorkCount(state))
    : Number.POSITIVE_INFINITY;
  let remainingThrottleBudget = throttleBudget;
  state.counters.generated += arrivals;
  for (let index = 0; index < arrivals; index += 1) {
    const item = createWorkItem(state);
    const result = admitItem(state, item, false, remainingThrottleBudget);
    remainingThrottleBudget = result.remainingThrottleBudget;
    applyAdmissionResult(result, summary);
  }

  // A consumer only prefetches up to its aggregate unacknowledged budget. The
  // broker remains bounded independently, so high prefetch is visible as
  // memory rather than accidentally becoming extra service capacity.
  refillWorkerBuffer(state);
  startProcessing(state);
  refillWorkerBuffer(state);

  const pending = pendingWorkCount(state);
  state.counters.peakQueueDepth = Math.max(state.counters.peakQueueDepth, state.queue.length);
  state.counters.peakInFlight = Math.max(
    state.counters.peakInFlight,
    state.workerBuffer.length + state.processing.length,
  );

  if (summary.retriesDue > 0) {
    emitControlEvent(state, emitted, "retry-arrivals", "Retries re-entered the broker", `${summary.retriesDue} failed job${summary.retriesDue === 1 ? "" : "s"} competed with fresh arrivals for bounded capacity.`, "warning");
  }
  if (summary.dropped > 0) {
    emitControlEvent(state, emitted, "work-dropped", "Work was shed or exhausted its retry budget", `${summary.dropped} logical job${summary.dropped === 1 ? "" : "s"} became explicit loss; inspect priority and admission policy.`, "failure");
  }
  if (summary.rejected > 0) {
    emitControlEvent(state, emitted, "work-rejected", "Producer admission was refused", `${summary.rejected} fresh job${summary.rejected === 1 ? "" : "s"} did not enter the bounded broker.`, "warning");
  }
  if (arrivals > 0 && state.queue.length >= state.config.queueCapacity) {
    emitControlEvent(state, emitted, "queue-full", "Broker reached its bound", `Queue depth is ${state.queue.length}; future work needs throttle, shed, or rejection.`, "warning");
  }
  if (pending === 0
    && state.runtime.recoveryObserved
    && state.runtime.recoveryTick !== null
    && state.runtime.recoveryCompletedTick === null) {
    state.runtime.recoveryCompletedTick = state.tick;
    emitControlEvent(state, emitted, "recovery-drained", "Backlog drained after recovery", `The queue and retry backlog are empty ${state.tick - state.runtime.recoveryTick} tick${state.tick - state.runtime.recoveryTick === 1 ? "" : "s"} after recovery.`, "success");
  }
}

function completeProcessing(
  state: BackpressureState,
  emitted: SimulationEvent[],
  summary: StepAdmissionSummary,
): void {
  if (state.processing.length === 0) return;
  const completedBatch = state.processing;
  state.processing = [];

  if (state.runtime.downstreamAvailable) {
    state.counters.completed += completedBatch.length;
    state.lastThroughput += completedBatch.length;
    return;
  }

  let retryCount = 0;
  let exhaustedCount = 0;
  for (const item of completedBatch) {
    state.counters.outageFailures += 1;
    if (item.attempt <= state.config.retryLimit) {
      const backoff = Math.min(
        32,
        state.config.retryBackoffTicks * (2 ** Math.max(0, item.attempt - 1)),
      );
      state.retryQueue.push({ item, dueTick: state.tick + backoff });
      state.counters.retryScheduled += 1;
      retryCount += 1;
    } else {
      state.counters.dropped += 1;
      exhaustedCount += 1;
    }
  }

  if (retryCount > 0 || exhaustedCount > 0) {
    emitControlEvent(
      state,
      emitted,
      "downstream-failure",
      "Downstream calls failed",
      `${retryCount} call${retryCount === 1 ? "" : "s"} scheduled for retry and ${exhaustedCount} exhausted the retry budget.`,
      "failure",
    );
  }
  summary.dropped += exhaustedCount;
}

function admitDueRetries(state: BackpressureState, summary: StepAdmissionSummary): void {
  const due: BackpressureRetryItem[] = [];
  const pending: BackpressureRetryItem[] = [];
  for (const retry of state.retryQueue) {
    if (retry.dueTick <= state.tick) due.push(retry);
    else pending.push(retry);
  }
  due.sort((left, right) => left.dueTick - right.dueTick || left.item.id.localeCompare(right.item.id));
  state.retryQueue = pending;
  for (const retry of due) {
    summary.retriesDue += 1;
    const result = admitItem(state, retry.item, true, Number.POSITIVE_INFINITY);
    applyAdmissionResult(result, summary);
  }
}

function admitItem(
  state: BackpressureState,
  item: BackpressureWorkItem,
  isRetry: boolean,
  throttleBudget: number,
): { accepted: boolean; dropped: boolean; rejected: boolean; throttled: boolean; remainingThrottleBudget: number } {
  const nonCritical = item.priority !== "critical";
  const reservedSlots = state.config.priorityPolicy === "reserved-critical"
    ? Math.max(1, Math.floor(state.config.queueCapacity * 0.25))
    : 0;
  const reservedForCritical = nonCritical && state.queue.length >= state.config.queueCapacity - reservedSlots;
  const throttleBlocked = !isRetry && state.config.admissionPolicy === "throttle" && throttleBudget <= 0;

  if (!reservedForCritical && !throttleBlocked && state.queue.length < state.config.queueCapacity) {
    item.enqueuedTick = state.tick;
    state.queue.push(item);
    state.counters.admitted += 1;
    return {
      accepted: true,
      dropped: false,
      rejected: false,
      throttled: false,
      remainingThrottleBudget: throttleBudget === Number.POSITIVE_INFINITY ? throttleBudget : Math.max(0, throttleBudget - 1),
    };
  }

  if (state.config.admissionPolicy === "shed-low-priority") {
    const candidateIndex = lowestPriorityIndex(state.queue);
    const candidate = candidateIndex >= 0 ? state.queue[candidateIndex] : null;
    if (candidate && WORK_PRIORITY_RANK[candidate.priority] < WORK_PRIORITY_RANK[item.priority]) {
      state.queue.splice(candidateIndex, 1);
      state.counters.dropped += 1;
      item.enqueuedTick = state.tick;
      state.queue.push(item);
      state.counters.admitted += 1;
      return {
        accepted: true,
        dropped: true,
        rejected: false,
        throttled: false,
        remainingThrottleBudget: throttleBudget,
      };
    }
  }

  if (isRetry) {
    state.counters.dropped += 1;
    return {
      accepted: false,
      dropped: true,
      rejected: false,
      throttled: false,
      remainingThrottleBudget: throttleBudget,
    };
  }

  state.counters.rejected += 1;
  const throttled = state.config.admissionPolicy === "throttle";
  if (throttled) state.counters.throttled += 1;
  return {
    accepted: false,
    dropped: false,
    rejected: true,
    throttled,
    remainingThrottleBudget: throttleBudget,
  };
}

function applyAdmissionResult(
  result: { accepted: boolean; dropped: boolean; rejected: boolean; throttled: boolean },
  summary: StepAdmissionSummary,
): void {
  if (result.accepted) summary.accepted += 1;
  if (result.dropped) summary.dropped += 1;
  if (result.rejected) summary.rejected += 1;
  if (result.throttled) summary.throttled += 1;
}

function refillWorkerBuffer(state: BackpressureState): void {
  const workerCapacity = state.config.consumerCount * state.config.prefetch;
  while (state.workerBuffer.length + state.processing.length < workerCapacity && state.queue.length > 0) {
    const index = queueSelectionIndex(state.queue, state.config.priorityPolicy);
    const [item] = state.queue.splice(index, 1);
    if (item) state.workerBuffer.push(item);
  }
}

function startProcessing(state: BackpressureState): void {
  const serviceSlots = effectiveServiceCapacity(state);
  if (serviceSlots <= 0) return;

  // Throttling and explicit shedding act as a circuit breaker during a known
  // outage. The open buffer preset intentionally keeps calling to demonstrate
  // retry amplification; safe policies stop producing more failed traffic.
  const circuitOpen = !state.runtime.downstreamAvailable && state.config.admissionPolicy !== "buffer";
  if (circuitOpen) return;

  let started = 0;
  while (state.workerBuffer.length > 0 && started < serviceSlots) {
    const index = queueSelectionIndex(state.workerBuffer, state.config.priorityPolicy);
    const [item] = state.workerBuffer.splice(index, 1);
    if (!item) break;
    item.attempt += 1;
    state.counters.attempts += 1;
    if (item.attempt > 1) state.counters.retries += 1;
    state.processing.push(item);
    started += 1;
  }
}

function arrivalsForTick(state: BackpressureState): number {
  const inBurst = state.config.burstDurationTicks > 0
    && state.tick >= state.config.burstStartTick
    && state.tick < state.config.burstStartTick + state.config.burstDurationTicks;
  return inBurst ? state.config.burstRate : state.config.arrivalRate;
}

function createWorkItem(state: BackpressureState): BackpressureWorkItem {
  const number = state.nextJobNumber;
  state.nextJobNumber += 1;
  const id = `job-${number}`;
  return {
    id,
    partition: partitionForJob(id, state.config.partitionCount),
    priority: priorityForJob(number),
    createdTick: state.tick,
    enqueuedTick: state.tick,
    attempt: 0,
  };
}

function priorityForJob(number: number): BackpressureWorkPriority {
  const position = (number - 1) % 5;
  if (position === 0) return "critical";
  if (position === 1 || position === 2) return "normal";
  return "best-effort";
}

function partitionForJob(id: string, partitionCount: number): number {
  const match = id.match(/(\d+)$/);
  const number = match ? Number(match[1]) : 0;
  return number % partitionCount;
}

function queueSelectionIndex(
  items: readonly BackpressureWorkItem[],
  policy: BackpressurePriorityPolicy,
): number {
  if (items.length === 0 || policy === "fifo") return 0;
  let selectedIndex = 0;
  for (let index = 1; index < items.length; index += 1) {
    const selected = items[selectedIndex];
    const candidate = items[index];
    if (!selected || !candidate) continue;
    if (WORK_PRIORITY_RANK[candidate.priority] > WORK_PRIORITY_RANK[selected.priority]) {
      selectedIndex = index;
      continue;
    }
    if (WORK_PRIORITY_RANK[candidate.priority] === WORK_PRIORITY_RANK[selected.priority]
      && (candidate.enqueuedTick < selected.enqueuedTick
        || (candidate.enqueuedTick === selected.enqueuedTick && candidate.id.localeCompare(selected.id) < 0))) {
      selectedIndex = index;
    }
  }
  return selectedIndex;
}

function lowestPriorityIndex(items: readonly BackpressureWorkItem[]): number {
  if (items.length === 0) return -1;
  let selectedIndex = 0;
  for (let index = 1; index < items.length; index += 1) {
    const selected = items[selectedIndex];
    const candidate = items[index];
    if (!selected || !candidate) continue;
    if (WORK_PRIORITY_RANK[candidate.priority] < WORK_PRIORITY_RANK[selected.priority]
      || (WORK_PRIORITY_RANK[candidate.priority] === WORK_PRIORITY_RANK[selected.priority]
        && (candidate.enqueuedTick > selected.enqueuedTick
          || (candidate.enqueuedTick === selected.enqueuedTick && candidate.id.localeCompare(selected.id) > 0)))) {
      selectedIndex = index;
    }
  }
  return selectedIndex;
}

function metricsFor(state: BackpressureState): BackpressureMetrics {
  const queueDepth = state.queue.length;
  const queueCapacity = state.config.queueCapacity;
  const oldestAgeTicks = queueDepth === 0
    ? 0
    : Math.max(...state.queue.map((item) => Math.max(0, state.tick - item.enqueuedTick)));
  const inFlightMemory = state.workerBuffer.length + state.processing.length;
  const inFlightMemoryCapacity = state.config.consumerCount * state.config.prefetch;
  const serviceCapacity = effectiveServiceCapacity(state);
  const partitionDepths = Array.from({ length: state.config.partitionCount }, () => 0);
  for (const item of state.queue) {
    partitionDepths[item.partition] = (partitionDepths[item.partition] ?? 0) + 1;
  }
  const dependencySaturation = state.runtime.downstreamAvailable
    ? Math.min(1, state.processing.length / state.config.downstreamLimit)
    : state.processing.length > 0
      ? 1
      : 0;
  const pendingWork = pendingWorkCount(state);
  // Compare actual downstream calls with the number of first attempts. A
  // backlog can make attempts smaller than arrivals; using generated arrivals
  // as the denominator would call that ordinary queueing "negative retry
  // amplification" and hide the failure traffic we want to teach.
  const initialAttempts = state.counters.attempts - state.counters.retries;
  const retryAmplification = initialAttempts === 0
    ? 1
    : state.counters.attempts / initialAttempts;
  const recoveryElapsedTicks = state.runtime.recoveryTick === null
    ? null
    : Math.max(0, state.tick - state.runtime.recoveryTick);
  const recoveryTimeTicks = state.runtime.recoveryTick === null || state.runtime.recoveryCompletedTick === null
    ? null
    : Math.max(0, state.runtime.recoveryCompletedTick - state.runtime.recoveryTick);
  const recoveryComplete = state.runtime.recoveryObserved
    && state.runtime.recoveryCompletedTick !== null
    && queueDepth === 0
    && state.workerBuffer.length === 0
    && state.processing.length === 0
    && state.retryQueue.length === 0;

  return {
    tick: state.tick,
    arrivalRate: arrivalsForTick(state),
    serviceCapacity,
    downstreamLimit: state.config.downstreamLimit,
    queueDepth,
    queueCapacity,
    queueUtilization: queueCapacity === 0 ? 0 : queueDepth / queueCapacity,
    oldestAgeTicks,
    oldestAge: oldestAgeTicks,
    partitionDepths,
    workerBufferDepth: state.workerBuffer.length,
    processingCount: state.processing.length,
    inFlightMemory,
    inFlightMemoryCapacity,
    retryBacklog: state.retryQueue.length,
    pendingWork,
    throughput: state.lastThroughput,
    completed: state.counters.completed,
    generated: state.counters.generated,
    admitted: state.counters.admitted,
    rejected: state.counters.rejected,
    dropped: state.counters.dropped,
    rejectedOrDropped: state.counters.rejected + state.counters.dropped,
    throttled: state.counters.throttled,
    attempts: state.counters.attempts,
    retries: state.counters.retries,
    retryAmplification,
    outageFailures: state.counters.outageFailures,
    dependencySaturation,
    downstreamAvailable: state.runtime.downstreamAvailable,
    dependencyStatus: state.runtime.downstreamAvailable ? "healthy" : "outage",
    recoveryTimeTicks,
    recoveryElapsedTicks,
    recoveryComplete,
    overloaded: queueDepth >= Math.max(1, Math.ceil(queueCapacity * 0.8))
      || state.counters.rejected > 0
      || state.counters.dropped > 0
      || !state.runtime.downstreamAvailable,
    history: state.history.map((point) => ({ ...point })),
  };
}

function effectiveServiceCapacity(state: BackpressureState): number {
  return Math.min(
    state.config.consumerCount * state.config.serviceRate,
    state.config.downstreamLimit,
  );
}

function pendingWorkCount(state: BackpressureState): number {
  return state.queue.length + state.workerBuffer.length + state.processing.length + state.retryQueue.length;
}

function historyPoint(metrics: BackpressureMetrics): BackpressureHistoryPoint {
  return {
    tick: metrics.tick,
    queueDepth: metrics.queueDepth,
    oldestAgeTicks: metrics.oldestAgeTicks,
    inFlightMemory: metrics.inFlightMemory,
    throughput: metrics.throughput,
    rejected: metrics.rejected,
    dropped: metrics.dropped,
    dependencySaturation: metrics.dependencySaturation,
    retryAmplification: metrics.retryAmplification,
  };
}

function appendHistory(
  history: readonly BackpressureHistoryPoint[],
  point: BackpressureHistoryPoint,
): BackpressureHistoryPoint[] {
  return [...history, point].slice(-MAX_BACKPRESSURE_HISTORY);
}

function appendEvents(
  events: readonly SimulationEvent[],
  emitted: readonly SimulationEvent[],
): SimulationEvent[] {
  return [...events, ...emitted].slice(-MAX_BACKPRESSURE_EVENT_COUNT);
}

function emitControlEvent(
  state: BackpressureState,
  emitted: SimulationEvent[],
  type: string,
  title: string,
  detail: string,
  tone: SimulationEventTone,
): void {
  state.eventSequence += 1;
  emitted.push({
    id: `backpressure-${state.tick}-${state.eventSequence}`,
    tick: state.tick,
    type,
    title,
    detail,
    tone,
  });
}

function emptyCounters(): BackpressureCounters {
  return {
    generated: 0,
    admitted: 0,
    completed: 0,
    rejected: 0,
    dropped: 0,
    throttled: 0,
    attempts: 0,
    retries: 0,
    retryScheduled: 0,
    outageFailures: 0,
    peakQueueDepth: 0,
    peakInFlight: 0,
  };
}

function emptyCompletion(): BackpressureCompletion {
  return {
    meaningfulAction: false,
    pressureObserved: false,
    responseObserved: false,
    completed: false,
  };
}

function emptyMetrics(
  tick: number,
  config: BackpressureConfig,
  runtime: BackpressureRuntime,
  queue: readonly BackpressureWorkItem[],
  workerBuffer: readonly BackpressureWorkItem[],
  processing: readonly BackpressureWorkItem[],
  retryQueue: readonly BackpressureRetryItem[],
  counters: BackpressureCounters,
  lastThroughput: number,
): BackpressureMetrics {
  const partitionDepths = Array.from({ length: config.partitionCount }, () => 0);
  for (const item of queue) partitionDepths[item.partition] = (partitionDepths[item.partition] ?? 0) + 1;
  return {
    tick,
    arrivalRate: config.arrivalRate,
    serviceCapacity: Math.min(config.consumerCount * config.serviceRate, config.downstreamLimit),
    downstreamLimit: config.downstreamLimit,
    queueDepth: queue.length,
    queueCapacity: config.queueCapacity,
    queueUtilization: queue.length / config.queueCapacity,
    oldestAgeTicks: 0,
    oldestAge: 0,
    partitionDepths,
    workerBufferDepth: workerBuffer.length,
    processingCount: processing.length,
    inFlightMemory: workerBuffer.length + processing.length,
    inFlightMemoryCapacity: config.consumerCount * config.prefetch,
    retryBacklog: retryQueue.length,
    pendingWork: queue.length + workerBuffer.length + processing.length + retryQueue.length,
    throughput: lastThroughput,
    completed: counters.completed,
    generated: counters.generated,
    admitted: counters.admitted,
    rejected: counters.rejected,
    dropped: counters.dropped,
    rejectedOrDropped: counters.rejected + counters.dropped,
    throttled: counters.throttled,
    attempts: counters.attempts,
    retries: counters.retries,
    retryAmplification: 1,
    outageFailures: counters.outageFailures,
    dependencySaturation: runtime.downstreamAvailable ? processing.length / config.downstreamLimit : 0,
    downstreamAvailable: runtime.downstreamAvailable,
    dependencyStatus: runtime.downstreamAvailable ? "healthy" : "outage",
    recoveryTimeTicks: null,
    recoveryElapsedTicks: null,
    recoveryComplete: false,
    overloaded: false,
    history: [],
  };
}

function completionFor(
  state: BackpressureState,
  meaningfulAction: boolean,
): BackpressureCompletion {
  const pressureObserved = state.counters.peakQueueDepth > 0
    || state.counters.rejected > 0
    || state.counters.dropped > 0
    || state.counters.outageFailures > 0
    || state.counters.attempts > 0
    || state.runtime.outageStartTick !== null;
  const responseObserved = state.config.admissionPolicy !== "buffer"
    || state.config.priorityPolicy !== "fifo"
    || state.runtime.recoveryObserved
    || state.counters.completed > 0;
  return {
    meaningfulAction,
    pressureObserved,
    responseObserved,
    completed: meaningfulAction && state.tick >= 3 && pressureObserved && responseObserved,
  };
}

function cloneState(input: BackpressureState): BackpressureState {
  return {
    ...input,
    config: { ...input.config },
    runtime: { ...input.runtime },
    queue: input.queue.map(cloneWorkItem),
    workerBuffer: input.workerBuffer.map(cloneWorkItem),
    processing: input.processing.map(cloneWorkItem),
    retryQueue: input.retryQueue.map((retry) => ({ dueTick: retry.dueTick, item: cloneWorkItem(retry.item) })),
    counters: { ...input.counters },
    history: input.history.map((point) => ({ ...point })),
    events: input.events.map((event) => ({ ...event })),
    metrics: {
      ...input.metrics,
      partitionDepths: [...input.metrics.partitionDepths],
      history: input.metrics.history.map((point) => ({ ...point })),
    },
    completion: { ...input.completion },
  };
}

function cloneWorkItem(item: BackpressureWorkItem): BackpressureWorkItem {
  return { ...item };
}

function assertBackpressureState(state: BackpressureState): void {
  if (!state || typeof state !== "object" || state.schemaVersion !== 1) {
    throw new BackpressureValidationError("Backpressure state must use schema version 1.");
  }
  if (!BACKPRESSURE_PRESET_IDS.includes(state.presetId)) {
    throw new BackpressureValidationError(`Unknown backpressure preset: ${String(state.presetId)}.`);
  }
  assertConfig(state.config);
  if (state.queue.length > state.config.queueCapacity) {
    throw new BackpressureValidationError("Broker queue exceeds its configured bound.");
  }
  if (state.history.length > MAX_BACKPRESSURE_HISTORY || state.events.length > MAX_BACKPRESSURE_EVENT_COUNT) {
    throw new BackpressureValidationError("Backpressure history or event timeline exceeds its bound.");
  }
}

function assertConfig(config: BackpressureConfig): void {
  assertIntegerRange(config.arrivalRate, BACKPRESSURE_MIN_ARRIVAL_RATE, BACKPRESSURE_MAX_ARRIVAL_RATE, "Arrival rate");
  assertIntegerRange(config.burstRate, BACKPRESSURE_MIN_ARRIVAL_RATE, BACKPRESSURE_MAX_ARRIVAL_RATE, "Burst arrival rate");
  assertIntegerRange(config.serviceRate, BACKPRESSURE_MIN_SERVICE_RATE, BACKPRESSURE_MAX_SERVICE_RATE, "Service rate");
  assertIntegerRange(config.queueCapacity, BACKPRESSURE_MIN_QUEUE_CAPACITY, MAX_BACKPRESSURE_QUEUE_CAPACITY, "Queue capacity");
  assertIntegerRange(config.prefetch, BACKPRESSURE_MIN_PREFETCH, BACKPRESSURE_MAX_PREFETCH, "Prefetch");
  assertIntegerRange(config.consumerCount, BACKPRESSURE_MIN_CONSUMERS, BACKPRESSURE_MAX_CONSUMERS, "Consumer count");
  assertIntegerRange(config.downstreamLimit, BACKPRESSURE_MIN_DOWNSTREAM_LIMIT, BACKPRESSURE_MAX_DOWNSTREAM_LIMIT, "Downstream limit");
  assertIntegerRange(config.retryLimit, BACKPRESSURE_MIN_RETRY_LIMIT, BACKPRESSURE_MAX_RETRY_LIMIT, "Retry limit");
  assertIntegerRange(config.retryBackoffTicks, 1, 32, "Retry backoff");
  assertIntegerRange(config.partitionCount, BACKPRESSURE_MIN_PARTITIONS, BACKPRESSURE_MAX_PARTITIONS, "Partition count");
  assertPriorityPolicy(config.priorityPolicy);
  assertAdmissionPolicy(config.admissionPolicy);
}

function assertBackpressureAction(action: BackpressureAction): void {
  if (!action || typeof action !== "object" || typeof action.type !== "string") {
    throw new BackpressureValidationError("Backpressure action must have a type.");
  }
  if ((action.type === "set-priority-policy" || action.type === "set-priority") && !BACKPRESSURE_PRIORITY_POLICIES.includes(action.policy)) {
    throw new BackpressureValidationError(`Unknown priority policy: ${String(action.policy)}.`);
  }
  if ((action.type === "set-admission-policy" || action.type === "set-shedding-policy") && !BACKPRESSURE_ADMISSION_POLICIES.includes(action.policy)) {
    throw new BackpressureValidationError(`Unknown admission policy: ${String(action.policy)}.`);
  }
}

function assertPriorityPolicy(policy: string): asserts policy is BackpressurePriorityPolicy {
  if (!BACKPRESSURE_PRIORITY_POLICIES.includes(policy as BackpressurePriorityPolicy)) {
    throw new BackpressureValidationError(`Unknown priority policy: ${String(policy)}.`);
  }
}

function assertAdmissionPolicy(policy: string): asserts policy is BackpressureAdmissionPolicy {
  if (!BACKPRESSURE_ADMISSION_POLICIES.includes(policy as BackpressureAdmissionPolicy)) {
    throw new BackpressureValidationError(`Unknown admission policy: ${String(policy)}.`);
  }
}

function assertIntegerRange(value: number, min: number, max: number, label: string): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new BackpressureValidationError(`${label} must be an integer between ${min} and ${max}; received ${value}.`);
  }
  return value;
}

function priorityPolicyDetail(policy: BackpressurePriorityPolicy): string {
  if (policy === "critical-first") return "Workers pull critical jobs ahead of normal and best-effort work.";
  if (policy === "reserved-critical") return "A reserved slice of the bounded queue protects critical jobs from optional work.";
  return "Workers pull in FIFO order; all priorities compete for the same buffer.";
}

function admissionPolicyDetail(policy: BackpressureAdmissionPolicy): string {
  if (policy === "throttle") return "The producer is admitted only while current work fits the modeled service budget; excess arrivals are rejected with throttle accounting.";
  if (policy === "shed-low-priority") return "When full, a lower-priority queued job may be dropped to admit more important work.";
  return "The broker buffers until its finite bound, then rejects fresh work rather than growing without limit.";
}

function metric(
  id: string,
  label: string,
  value: string,
  detail: string,
  tone: SimulationEventTone = "info",
): SimulationMetric {
  return { id, label, value, detail, tone };
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatAge(value: number): string {
  return `${value} tick${value === 1 ? "" : "s"}`;
}

function assertNever(value: never): never {
  throw new BackpressureValidationError(`Unsupported backpressure action: ${JSON.stringify(value)}.`);
}
