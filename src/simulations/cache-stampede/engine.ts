import {
  SIMULATION_SPEEDS,
  type SimulationEvent,
  type SimulationSpeed,
} from "@/simulations/types";

import { CACHE_STAMPEDE_PRESETS, getCacheStampedePreset } from "./presets";
import {
  CACHE_STAMPEDE_CACHE_STATUSES,
  CACHE_STAMPEDE_MITIGATIONS,
  CACHE_STAMPEDE_PRESET_IDS,
  CACHE_STAMPEDE_STEP_MS,
  MAX_CACHE_STAMPEDE_ACTIVE_LOADS,
  MAX_CACHE_STAMPEDE_EVENTS,
  MAX_CACHE_STAMPEDE_HISTORY,
  MAX_CACHE_STAMPEDE_READER_GROUPS_PER_LOAD,
  type CacheStampedeAction,
  type CacheStampedeCache,
  type CacheStampedeCacheStatus,
  type CacheStampedeComparison,
  type CacheStampedeConfig,
  type CacheStampedeHistoryPoint,
  type CacheStampedeLoadPurpose,
  type CacheStampedeLock,
  type CacheStampedeMetrics,
  type CacheStampedeMitigation,
  type CacheStampedePresetId,
  type CacheStampedeReaderGroup,
  type CacheStampedeSourceLoad,
  type CacheStampedeState,
  type CacheStampedeStepStats,
  type CacheStampedeTotals,
  type CacheStampedeTransition,
  CacheStampedeValidationError,
} from "./types";

export const MIN_CACHE_STAMPEDE_ARRIVAL_RATE = 0;
export const MAX_CACHE_STAMPEDE_ARRIVAL_RATE = 10_000;
export const MIN_CACHE_STAMPEDE_BURST_READERS = 0;
export const MAX_CACHE_STAMPEDE_BURST_READERS = 5_000;
export const MIN_CACHE_STAMPEDE_LOADER_LATENCY_MS = 25;
export const MAX_CACHE_STAMPEDE_LOADER_LATENCY_MS = 2_000;
export const MIN_CACHE_STAMPEDE_TTL_MS = 100;
export const MAX_CACHE_STAMPEDE_TTL_MS = 30_000;
export const MAX_CACHE_STAMPEDE_TTL_JITTER_MS = 15_000;
export const MIN_CACHE_STAMPEDE_PROCESS_COUNT = 1;
export const MAX_CACHE_STAMPEDE_PROCESS_COUNT = 16;
export const MIN_CACHE_STAMPEDE_LOCK_LEASE_MS = 50;
export const MAX_CACHE_STAMPEDE_LOCK_LEASE_MS = 4_000;
export const MIN_CACHE_STAMPEDE_WAITER_TIMEOUT_MS = 25;
export const MAX_CACHE_STAMPEDE_WAITER_TIMEOUT_MS = 4_000;
export const MAX_CACHE_STAMPEDE_STALE_GRACE_MS = 15_000;

const DEFAULT_PRESET_ID: CacheStampedePresetId = "synchronized-expiry";
const DEFAULT_SEED = 20_260_823;
const EMPTY_LOCK: CacheStampedeLock = {
  ownerProcessId: null,
  ownerToken: null,
  acquiredAtMs: null,
  leaseExpiresAtMs: null,
};

const MITIGATION_LABELS: Record<CacheStampedeMitigation, string> = {
  none: "None",
  jitter: "TTL jitter",
  "local-single-flight": "Local single-flight",
  "distributed-lock": "Distributed lock",
  "stale-while-revalidate": "Stale-while-revalidate",
};

const MITIGATION_TRADEOFFS: Record<CacheStampedeMitigation, string> = {
  none: "Every miss loads the source; easiest path, highest burst amplification.",
  jitter: "Moves the expiry boundary, but one hot key can still miss together.",
  "local-single-flight": "One loader per process; cheap, but processes still duplicate work.",
  "distributed-lock": "One lease owner protects the source; lease expiry can duplicate a slow load.",
  "stale-while-revalidate": "Readers avoid waiting on stale data; freshness budget and refresh capacity are spent.",
};

export function cacheStampedeMitigationLabel(mitigation: CacheStampedeMitigation): string {
  return MITIGATION_LABELS[mitigation];
}

export function createCacheStampedeState(
  presetId: CacheStampedePresetId = DEFAULT_PRESET_ID,
  seed = DEFAULT_SEED,
): CacheStampedeState {
  if (!CACHE_STAMPEDE_PRESET_IDS.includes(presetId)) {
    throw new CacheStampedeValidationError(`Unknown cache-stampede preset: ${String(presetId)}.`);
  }
  assertInteger(seed, "Seed");
  const preset = getCacheStampedePreset(presetId);
  const initialCache: CacheStampedeCache = preset.initialCache === "warm"
    ? {
        status: "fresh",
        valueVersion: 1,
        filledAtMs: 0,
        freshUntilMs: preset.config.ttlMs,
        staleUntilMs: preset.config.ttlMs + preset.config.staleGraceMs,
      }
    : {
        status: "cold",
        valueVersion: 0,
        filledAtMs: null,
        freshUntilMs: null,
        staleUntilMs: null,
      };
  const state: CacheStampedeState = {
    schemaVersion: 1,
    presetId,
    tick: 0,
    timeMs: 0,
    seed: seed >>> 0,
    config: { ...preset.config },
    mitigation: preset.mitigation,
    sourceFailure: preset.sourceFailed ?? false,
    ownerFailure: false,
    cache: initialCache,
    activeLoads: [],
    lock: { ...EMPTY_LOCK },
    arrivalRemainder: 0,
    nextLoadNumber: 1,
    nextReaderGroupNumber: 1,
    nextLockNumber: 1,
    fillSequence: 0,
    eventSequence: 0,
    failedOwnerLoadIds: [],
    totals: emptyTotals(),
    lastStep: emptyStepStats(),
    history: [],
    events: [],
    completion: {
      meaningfulAction: false,
      progressObserved: false,
      completed: false,
    },
    speed: 1,
    playing: false,
  };
  assertCacheStampedeState(state);
  state.history = [historyPointFor(state)];
  return state;
}

export function getCacheStampedePresetDefinition(presetId: CacheStampedePresetId) {
  return getCacheStampedePreset(presetId);
}

export function transitionCacheStampede(
  input: CacheStampedeState,
  action: CacheStampedeAction,
): CacheStampedeTransition {
  assertCacheStampedeState(input);
  if (action.type === "reset") {
    const reset = createCacheStampedeState(input.presetId, input.seed);
    return { state: reset, events: [], metrics: cacheStampedeMetrics(reset) };
  }

  const next = cloneState(input);
  const events: SimulationEvent[] = [];

  switch (action.type) {
    case "step":
      advanceOneStep(next, events);
      next.completion.progressObserved = true;
      next.completion.completed = next.completion.meaningfulAction && next.completion.progressObserved;
      break;
    case "play":
      next.playing = true;
      break;
    case "pause":
      next.playing = false;
      break;
    case "set-speed":
      assertSpeed(action.speed);
      next.speed = action.speed;
      break;
    case "set-arrival-rate":
    case "set-arrival-rate-per-second":
      next.config.arrivalRatePerSecond = boundedNumber(
        action.rate,
        MIN_CACHE_STAMPEDE_ARRIVAL_RATE,
        MAX_CACHE_STAMPEDE_ARRIVAL_RATE,
        "Arrival rate",
      );
      markMeaningful(next);
      emitEvent(next, events, "arrival-rate-changed", "Reader rate changed", `${formatNumber(next.config.arrivalRatePerSecond)} readers/s now target key K.`, "info");
      break;
    case "set-burst-readers":
      next.config.burstReaders = boundedInteger(action.readers, MIN_CACHE_STAMPEDE_BURST_READERS, MAX_CACHE_STAMPEDE_BURST_READERS, "Burst readers");
      markMeaningful(next);
      emitEvent(next, events, "burst-size-changed", "Reader burst changed", `${formatNumber(next.config.burstReaders)} synchronized readers join cold start and expiry.`, "info");
      break;
    case "set-loader-latency":
      next.config.loaderLatencyMs = boundedNumber(action.milliseconds, MIN_CACHE_STAMPEDE_LOADER_LATENCY_MS, MAX_CACHE_STAMPEDE_LOADER_LATENCY_MS, "Loader latency");
      markMeaningful(next);
      emitEvent(next, events, "loader-latency-changed", "Loader latency changed", `The source now takes ${formatMs(next.config.loaderLatencyMs)} per fill.`, "info");
      break;
    case "set-ttl":
      next.config.ttlMs = boundedNumber(action.milliseconds, MIN_CACHE_STAMPEDE_TTL_MS, MAX_CACHE_STAMPEDE_TTL_MS, "TTL");
      markMeaningful(next);
      emitEvent(next, events, "ttl-changed", "TTL changed", `Freshness lasts ${formatMs(next.config.ttlMs)} after a successful fill.`, "info");
      break;
    case "set-ttl-jitter":
      next.config.ttlJitterMs = boundedNumber(action.milliseconds, 0, MAX_CACHE_STAMPEDE_TTL_JITTER_MS, "TTL jitter");
      markMeaningful(next);
      emitEvent(next, events, "jitter-changed", "TTL jitter changed", `Each fill may move expiry by ±${formatMs(next.config.ttlJitterMs)}.`, "info");
      break;
    case "set-process-count":
      next.config.processCount = boundedInteger(action.count, MIN_CACHE_STAMPEDE_PROCESS_COUNT, MAX_CACHE_STAMPEDE_PROCESS_COUNT, "Process count");
      markMeaningful(next);
      emitEvent(next, events, "process-count-changed", "Process count changed", `${formatNumber(next.config.processCount)} processes receive the hot-key readers.`, "info");
      break;
    case "set-lock-lease":
      next.config.lockLeaseMs = boundedNumber(action.milliseconds, MIN_CACHE_STAMPEDE_LOCK_LEASE_MS, MAX_CACHE_STAMPEDE_LOCK_LEASE_MS, "Lock lease");
      markMeaningful(next);
      emitEvent(next, events, "lease-changed", "Lock lease changed", `Distributed owners hold the lease for ${formatMs(next.config.lockLeaseMs)}.`, "info");
      break;
    case "set-waiter-timeout":
      next.config.waiterTimeoutMs = boundedNumber(action.milliseconds, MIN_CACHE_STAMPEDE_WAITER_TIMEOUT_MS, MAX_CACHE_STAMPEDE_WAITER_TIMEOUT_MS, "Waiter timeout");
      markMeaningful(next);
      emitEvent(next, events, "waiter-timeout-changed", "Waiter timeout changed", `Miss readers wait at most ${formatMs(next.config.waiterTimeoutMs)}.`, "info");
      break;
    case "set-stale-grace":
      next.config.staleGraceMs = boundedNumber(action.milliseconds, 0, MAX_CACHE_STAMPEDE_STALE_GRACE_MS, "Stale grace");
      if (next.cache.freshUntilMs !== null) {
        next.cache.staleUntilMs = next.cache.freshUntilMs + next.config.staleGraceMs;
      }
      markMeaningful(next);
      emitEvent(next, events, "stale-grace-changed", "Stale grace changed", `SWR may serve stale data for ${formatMs(next.config.staleGraceMs)}.`, "info");
      break;
    case "set-mitigation":
    case "set-strategy":
      assertMitigation(action.mitigation);
      next.mitigation = action.mitigation;
      markMeaningful(next);
      emitEvent(next, events, "mitigation-changed", "Mitigation changed", `${cacheStampedeMitigationLabel(next.mitigation)} is now active for key K.`, "info");
      break;
    case "set-source-failure":
      next.sourceFailure = action.failed;
      markMeaningful(next);
      emitEvent(next, events, action.failed ? "source-failure-injected" : "source-failure-recovered", action.failed ? "Source failure injected" : "Source recovered", action.failed ? "New source calls fail; inspect failed loads and stale fallback." : "New source calls can complete and refill the cache.", action.failed ? "failure" : "success");
      break;
    case "inject-source-failure":
    case "inject-failure":
      next.sourceFailure = true;
      markMeaningful(next);
      emitEvent(next, events, "source-failure-injected", "Source failure injected", "New source calls fail; SWR can still serve a value inside its stale grace window.", "failure");
      break;
    case "recover-source-failure":
    case "recover-failure":
      next.sourceFailure = false;
      markMeaningful(next);
      emitEvent(next, events, "source-failure-recovered", "Source recovered", "Future refreshes may refill the cache.", "success");
      break;
    case "inject-owner-failure": {
      next.ownerFailure = true;
      const ownerLoad = next.activeLoads.find((load) => load.ownerToken === next.lock.ownerToken)
        ?? next.activeLoads.find((load) => load.ownerToken !== null);
      if (ownerLoad) {
        ownerLoad.ownerCrashed = true;
        if (!next.failedOwnerLoadIds.includes(ownerLoad.id)) next.failedOwnerLoadIds.push(ownerLoad.id);
      }
      markMeaningful(next);
      emitEvent(next, events, "owner-failure-injected", "Lock owner crashed", ownerLoad ? `Owner ${ownerLoad.ownerProcessId ?? "worker"} stopped before releasing ${ownerLoad.ownerToken}.` : "The next lock owner will fail before releasing its lease.", "failure");
      break;
    }
    case "recover-owner-failure":
      next.ownerFailure = false;
      markMeaningful(next);
      emitEvent(next, events, "owner-failure-recovered", "Owner failure cleared", "New lock owners can complete normally; an already crashed owner still cannot release its token.", "success");
      break;
    default:
      assertNever(action);
  }

  next.cache.status = cacheStatusAt(next.cache, next.timeMs);
  assertCacheStampedeState(next);
  next.events = [...next.events, ...events].slice(-MAX_CACHE_STAMPEDE_EVENTS);
  return { state: next, events, metrics: cacheStampedeMetrics(next) };
}

/** Alias used by a few lesson-specific callers that prefer a State suffix. */
export const transitionCacheStampedeState = transitionCacheStampede;

export function cacheStampedeMetrics(state: CacheStampedeState): CacheStampedeMetrics {
  assertCacheStampedeState(state);
  const currentSourceConcurrency = state.activeLoads.reduce((sum, load) => sum + load.callCount, 0);
  const waitLatencyMs = state.totals.waitSamples > 0
    ? state.totals.waitMs / state.totals.waitSamples
    : 0;
  const staleAgeMs = state.cache.status === "stale" && state.cache.freshUntilMs !== null
    ? Math.max(0, state.timeMs - state.cache.freshUntilMs)
    : 0;
  const ttlRemainingMs = state.cache.freshUntilMs === null
    ? 0
    : Math.max(0, state.cache.freshUntilMs - state.timeMs);
  const comparisons = compareCacheStampedeMitigations(state);
  const metrics: CacheStampedeMetrics = {
    tick: state.tick,
    timeMs: state.timeMs,
    mitigation: state.mitigation,
    cacheStatus: state.cache.status,
    cacheAgeMs: state.cache.filledAtMs === null ? 0 : Math.max(0, state.timeMs - state.cache.filledAtMs),
    staleAgeMs,
    ttlRemainingMs,
    readersThisStep: state.lastStep.readers,
    totalReaders: state.totals.readers,
    cacheHits: state.totals.cacheHits,
    cacheMisses: state.totals.cacheMisses,
    sourceCalls: state.totals.sourceCalls,
    sourceQps: (state.lastStep.sourceCallsStarted * 1_000) / CACHE_STAMPEDE_STEP_MS,
    currentSourceConcurrency,
    peakSourceConcurrency: state.totals.peakSourceConcurrency,
    averageWaitLatencyMs: waitLatencyMs,
    waitLatencyMs,
    maxWaitLatencyMs: state.totals.maxWaitMs,
    staleServed: state.totals.staleServed,
    staleServeRate: state.totals.staleServed / Math.max(1, state.totals.readers),
    lockContention: state.totals.lockContention,
    lockContentionThisStep: state.lastStep.lockContention,
    lockAcquisitions: state.totals.lockAcquisitions,
    leaseExpirations: state.totals.leaseExpirations,
    ownerFailures: state.totals.ownerFailures,
    failedLoads: state.totals.failedLoads,
    failedReaders: state.totals.failedReaders,
    timedOutReaders: state.totals.timedOutReaders,
    coalescedReaders: state.totals.coalescedReaders,
    coalescingRatio: state.totals.coalescedReaders / Math.max(1, state.totals.cacheMisses),
    refreshes: state.totals.refreshes,
    activeLoadCount: state.activeLoads.length,
    lockHeld: state.lock.ownerToken !== null,
    lockOwner: state.lock.ownerProcessId,
    leaseRemainingMs: state.lock.leaseExpiresAtMs === null ? 0 : Math.max(0, state.lock.leaseExpiresAtMs - state.timeMs),
    sourceFailure: state.sourceFailure,
    ownerFailure: state.ownerFailure,
    amplification: state.totals.sourceCalls / Math.max(1, state.totals.cacheMisses),
    comparisons,
  };
  return metrics;
}

export function compareCacheStampedeMitigations(
  state: CacheStampedeState,
): CacheStampedeComparison[] {
  assertCacheStampedeState(state);
  const burst = Math.max(
    1,
    state.lastStep.readers,
    Math.floor(state.config.arrivalRatePerSecond * CACHE_STAMPEDE_STEP_MS / 1_000) + state.config.burstReaders,
  );
  const leaseCopies = Math.max(1, Math.ceil(state.config.loaderLatencyMs / state.config.lockLeaseMs));
  const sourceFailures = state.sourceFailure;
  const entries: Array<{
    mitigation: CacheStampedeMitigation;
    peak: number;
    calls: number;
    wait: number;
    stale: number;
    contention: number;
  }> = [
    { mitigation: "none", peak: burst, calls: burst, wait: state.config.loaderLatencyMs, stale: 0, contention: 0 },
    { mitigation: "jitter", peak: burst, calls: burst, wait: state.config.loaderLatencyMs, stale: 0, contention: 0 },
    {
      mitigation: "local-single-flight",
      peak: Math.min(state.config.processCount, burst),
      calls: Math.min(state.config.processCount, burst),
      wait: state.config.loaderLatencyMs,
      stale: 0,
      contention: 0,
    },
    {
      mitigation: "distributed-lock",
      peak: leaseCopies,
      calls: leaseCopies,
      wait: state.config.loaderLatencyMs,
      stale: 0,
      contention: Math.max(0, burst - 1),
    },
    {
      mitigation: "stale-while-revalidate",
      peak: 1,
      calls: 1,
      wait: state.cache.status === "stale" ? 0 : state.config.loaderLatencyMs,
      stale: state.cache.status === "stale" ? burst : 0,
      contention: state.cache.status === "stale" ? 0 : Math.max(0, burst - 1),
    },
  ];
  return entries.map((entry) => ({
    mitigation: entry.mitigation,
    label: MITIGATION_LABELS[entry.mitigation],
    peakSourceConcurrency: entry.peak,
    sourceCalls: entry.calls,
    waitLatencyMs: entry.wait,
    staleReaders: entry.stale,
    lockContention: entry.contention,
    failedLoads: sourceFailures ? entry.calls : 0,
    tradeoff: MITIGATION_TRADEOFFS[entry.mitigation],
  }));
}

export function assertCacheStampedeState(state: CacheStampedeState): void {
  if (typeof state !== "object" || state === null || state.schemaVersion !== 1) {
    throw new CacheStampedeValidationError("Unsupported cache-stampede simulation state version.");
  }
  if (!CACHE_STAMPEDE_PRESET_IDS.includes(state.presetId)) {
    throw new CacheStampedeValidationError(`Unknown cache-stampede preset: ${String(state.presetId)}.`);
  }
  assertMitigation(state.mitigation);
  assertInteger(state.tick, "Tick");
  assertFiniteNumber(state.timeMs, "Simulation time");
  assertInteger(state.seed, "Seed");
  validateConfig(state.config);
  if (!CACHE_STAMPEDE_CACHE_STATUSES.includes(state.cache.status)) {
    throw new CacheStampedeValidationError(`Unsupported cache status: ${String(state.cache.status)}.`);
  }
  if (state.activeLoads.length > MAX_CACHE_STAMPEDE_ACTIVE_LOADS) {
    throw new CacheStampedeValidationError("Active source loads exceeded the bounded simulation limit.");
  }
  if (state.history.length > MAX_CACHE_STAMPEDE_HISTORY) {
    throw new CacheStampedeValidationError("Cache-stampede history exceeded its bounded limit.");
  }
  if (state.events.length > MAX_CACHE_STAMPEDE_EVENTS) {
    throw new CacheStampedeValidationError("Cache-stampede events exceeded their bounded limit.");
  }
  for (const load of state.activeLoads) {
    if (!Number.isInteger(load.callCount) || load.callCount < 1) {
      throw new CacheStampedeValidationError("A source load must represent at least one call.");
    }
    if (load.readerGroups.length > MAX_CACHE_STAMPEDE_READER_GROUPS_PER_LOAD) {
      throw new CacheStampedeValidationError("A source load exceeded the bounded reader-group limit.");
    }
  }
}

function advanceOneStep(state: CacheStampedeState, events: SimulationEvent[]): void {
  const beforeStatus = cacheStatusAt(state.cache, state.timeMs);
  state.tick += 1;
  state.timeMs += CACHE_STAMPEDE_STEP_MS;
  state.lastStep = emptyStepStats();

  resolveCompletedLoads(state, events);
  expireLeaseIfNeeded(state, events);

  const statusBeforeReaders = cacheStatusAt(state.cache, state.timeMs);
  const baseArrivals = arrivalsForStep(state);
  const expiryBurst = state.config.burstReaders > 0 && (
    state.tick === 1 || (beforeStatus === "fresh" && statusBeforeReaders !== "fresh")
  )
    ? state.config.burstReaders
    : 0;
  const arrivals = baseArrivals + expiryBurst;
  if (arrivals > 0) {
    state.lastStep.readers = arrivals;
    state.totals.readers += arrivals;
    emitEvent(state, events, "reader-burst", "Readers arrive", `${formatNumber(arrivals)} readers check key K while the cache is ${statusBeforeReaders}.`, statusBeforeReaders === "fresh" ? "success" : "warning");
    handleReaders(state, events, arrivals, state.totals.readers - arrivals);
  }

  state.cache.status = cacheStatusAt(state.cache, state.timeMs);
  const currentConcurrency = sourceConcurrency(state);
  state.totals.peakSourceConcurrency = Math.max(state.totals.peakSourceConcurrency, currentConcurrency);
  if (statusBeforeReaders === "fresh" && state.cache.status !== "fresh") {
    emitEvent(state, events, "ttl-expired", "TTL expired", "The synchronized freshness boundary passed; the next readers can stampede the source.", "warning");
  }
  state.history = [...state.history, historyPointFor(state)].slice(-MAX_CACHE_STAMPEDE_HISTORY);
}

function resolveCompletedLoads(state: CacheStampedeState, events: SimulationEvent[]): void {
  const remaining: CacheStampedeSourceLoad[] = [];
  for (const load of state.activeLoads) {
    if (load.completeAtMs > state.timeMs) {
      remaining.push(load);
      continue;
    }
    state.lastStep.sourceCallsCompleted += load.callCount;
    state.totals.sourceCallsCompleted += load.callCount;
    const ownerCrashed = load.ownerCrashed || state.failedOwnerLoadIds.includes(load.id);
    const failed = state.sourceFailure || ownerCrashed;
    const readerCount = load.readerGroups.reduce((sum, group) => sum + group.count, 0);
    let timedOutReaders = 0;
    for (const group of load.readerGroups) {
      const waitMs = Math.max(0, state.timeMs - group.arrivedAtMs);
      const timedOut = state.timeMs > group.deadlineAtMs;
      state.totals.waitSamples += group.count;
      state.totals.waitMs += waitMs * group.count;
      state.totals.maxWaitMs = Math.max(state.totals.maxWaitMs, waitMs);
      state.lastStep.waitSamples += group.count;
      state.lastStep.waitMs += waitMs * group.count;
      if (timedOut) timedOutReaders += group.count;
    }
    if (timedOutReaders > 0) {
      state.lastStep.timedOutReaders += timedOutReaders;
      state.totals.timedOutReaders += timedOutReaders;
    }
    if (failed) {
      state.lastStep.failedLoads += load.callCount;
      state.totals.failedLoads += load.callCount;
      // A timed-out reader is also a failed reader when the source load fails;
      // count the union once rather than adding the timeout subset twice.
      state.totals.failedReaders += readerCount;
      emitEvent(
        state,
        events,
        ownerCrashed ? "owner-load-failed" : "source-load-failed",
        ownerCrashed ? "Owner load failed" : "Source load failed",
        ownerCrashed
          ? `${load.ownerToken ?? "Owner"} failed; its lease remains until expiry.`
          : `${formatNumber(load.callCount)} source call${load.callCount === 1 ? "" : "s"} failed at completion.`,
        "failure",
      );
    } else {
      // A successful fill can still arrive after a bounded waiter deadline;
      // only that timeout subset is failed in this branch.
      if (timedOutReaders > 0) state.totals.failedReaders += timedOutReaders;
      fillCache(state, state.timeMs);
      emitEvent(
        state,
        events,
        load.purpose === "refresh" ? "refresh-completed" : "load-completed",
        load.purpose === "refresh" ? "Background refresh completed" : "Source load completed",
        `${formatNumber(load.callCount)} source call${load.callCount === 1 ? "" : "s"} wrote cache version ${state.cache.valueVersion}.`,
        "success",
      );
    }

    if (load.ownerCrashed) state.totals.ownerFailures += 1;
    if (load.ownerToken !== null && state.lock.ownerToken === load.ownerToken && !ownerCrashed) {
      emitEvent(state, events, "lock-released", "Lease released safely", `Owner token ${load.ownerToken} matched; the distributed lock is free.`, "success");
      state.lock = { ...EMPTY_LOCK };
    }
  }
  state.activeLoads = remaining;
}

function expireLeaseIfNeeded(state: CacheStampedeState, events: SimulationEvent[]): void {
  if (state.lock.ownerToken === null || state.lock.leaseExpiresAtMs === null) return;
  if (state.lock.leaseExpiresAtMs > state.timeMs) return;
  const oldToken = state.lock.ownerToken;
  state.totals.leaseExpirations += 1;
  emitEvent(state, events, "lease-expired", "Lease expired", `Owner token ${oldToken} no longer protects the key; a new owner may start, even if the old load is still running.`, "warning");
  state.lock = { ...EMPTY_LOCK };
}

function handleReaders(
  state: CacheStampedeState,
  events: SimulationEvent[],
  arrivals: number,
  readerOrdinalStart: number,
): void {
  const status = cacheStatusAt(state.cache, state.timeMs);
  state.cache.status = status;
  if (status === "fresh") {
    state.lastStep.cacheHits += arrivals;
    state.totals.cacheHits += arrivals;
    return;
  }

  if (status === "stale" && state.mitigation === "stale-while-revalidate") {
    state.lastStep.staleServed += arrivals;
    state.totals.staleServed += arrivals;
    emitEvent(state, events, "stale-served", "Stale value served", `${formatNumber(arrivals)} readers avoided the source; stale age is ${formatMs(state.timeMs - (state.cache.freshUntilMs ?? state.timeMs))}.`, "warning");
    const refreshActive = state.activeLoads.some((load) => load.purpose === "refresh" && load.ownerToken !== null);
    if (!refreshActive) startGlobalLoad(state, events, "refresh", [], 1, "Refresh owner");
    return;
  }

  state.lastStep.cacheMisses += arrivals;
  state.totals.cacheMisses += arrivals;
  const groups = readerGroupsFor(state, arrivals, readerOrdinalStart);
  switch (state.mitigation) {
    case "none":
    case "jitter":
      startLoad(state, events, "miss", null, null, arrivals, groups);
      break;
    case "local-single-flight":
      for (const group of groups) {
        const existing = state.activeLoads.find(
          (load) => load.purpose === "miss" && load.ownerProcessId === group.processId && load.ownerToken === null,
        );
        if (existing) {
          appendGroup(existing, group);
          state.lastStep.coalescedReaders += group.count;
          state.totals.coalescedReaders += group.count;
        } else {
          startLoad(state, events, "miss", group.processId, null, 1, [group]);
          const collapsed = Math.max(0, group.count - 1);
          state.lastStep.coalescedReaders += collapsed;
          state.totals.coalescedReaders += collapsed;
        }
      }
      break;
    case "distributed-lock":
      startOrJoinGlobalMiss(state, events, groups);
      break;
    case "stale-while-revalidate":
      startOrJoinGlobalMiss(state, events, groups);
      break;
    default:
      assertNever(state.mitigation);
  }
}

function startOrJoinGlobalMiss(
  state: CacheStampedeState,
  events: SimulationEvent[],
  groups: CacheStampedeReaderGroup[],
): void {
  const currentOwner = state.lock.ownerToken === null
    ? null
    : state.activeLoads.find((load) => load.ownerToken === state.lock.ownerToken) ?? null;
  if (currentOwner) {
    const arrivals = groups.reduce((sum, group) => sum + group.count, 0);
    groups.forEach((group) => appendGroup(currentOwner, group));
    state.lastStep.lockContention += arrivals;
    state.totals.lockContention += arrivals;
    state.lastStep.coalescedReaders += arrivals;
    state.totals.coalescedReaders += arrivals;
    return;
  }
  const firstProcess = groups[0]?.processId ?? "process-1";
  acquireLock(state, events, firstProcess);
  const arrivals = groups.reduce((sum, group) => sum + group.count, 0);
  startLoad(state, events, "miss", firstProcess, state.lock.ownerToken, 1, groups);
  const collapsed = Math.max(0, arrivals - 1);
  state.lastStep.lockContention += collapsed;
  state.totals.lockContention += collapsed;
  state.lastStep.coalescedReaders += collapsed;
  state.totals.coalescedReaders += collapsed;
}

function startGlobalLoad(
  state: CacheStampedeState,
  events: SimulationEvent[],
  purpose: CacheStampedeLoadPurpose,
  groups: CacheStampedeReaderGroup[],
  callCount: number,
  ownerProcessId: string,
): void {
  const existing = state.lock.ownerToken === null
    ? null
    : state.activeLoads.find((load) => load.ownerToken === state.lock.ownerToken && load.purpose === purpose) ?? null;
  if (existing) {
    groups.forEach((group) => appendGroup(existing, group));
    return;
  }
  acquireLock(state, events, ownerProcessId);
  startLoad(state, events, purpose, ownerProcessId, state.lock.ownerToken, callCount, groups);
}

function acquireLock(state: CacheStampedeState, events: SimulationEvent[], processId: string): void {
  const token = `lock-${state.nextLockNumber}`;
  state.nextLockNumber += 1;
  state.lock = {
    ownerProcessId: processId,
    ownerToken: token,
    acquiredAtMs: state.timeMs,
    leaseExpiresAtMs: state.timeMs + state.config.lockLeaseMs,
  };
  state.lastStep.lockAcquisitions += 1;
  state.totals.lockAcquisitions += 1;
  emitEvent(state, events, "lock-acquired", "Lease acquired", `${processId} owns ${token} for ${formatMs(state.config.lockLeaseMs)}.`, "info");
}

function startLoad(
  state: CacheStampedeState,
  events: SimulationEvent[],
  purpose: CacheStampedeLoadPurpose,
  ownerProcessId: string | null,
  ownerToken: string | null,
  callCount: number,
  groups: CacheStampedeReaderGroup[],
): void {
  if (state.activeLoads.length >= MAX_CACHE_STAMPEDE_ACTIVE_LOADS) {
    throw new CacheStampedeValidationError("The bounded source-load sample is full; lower arrival rate or step to drain it.");
  }
  const load: CacheStampedeSourceLoad = {
    id: `source-load-${state.nextLoadNumber}`,
    purpose,
    ownerProcessId,
    ownerToken,
    startedAtMs: state.timeMs,
    completeAtMs: state.timeMs + state.config.loaderLatencyMs,
    callCount,
    readerGroups: groups.slice(0, MAX_CACHE_STAMPEDE_READER_GROUPS_PER_LOAD),
    ownerCrashed: state.ownerFailure && ownerToken !== null,
  };
  state.nextLoadNumber += 1;
  state.activeLoads = [...state.activeLoads, load];
  state.lastStep.sourceCallsStarted += callCount;
  state.totals.sourceCalls += callCount;
  if (purpose === "refresh") {
    state.lastStep.refreshes += callCount;
    state.totals.refreshes += callCount;
    emitEvent(state, events, "refresh-started", "Background refresh started", `One ${ownerToken ?? "refresh"} source call is refreshing the key while readers continue.`, "info");
  } else {
    emitEvent(state, events, "source-load-started", "Source load started", `${formatNumber(callCount)} source call${callCount === 1 ? "" : "s"} now run for the ${ownerToken ? "lease owner" : state.mitigation === "none" || state.mitigation === "jitter" ? "miss cohort" : "process owner"}.`, "warning");
  }
}

function appendGroup(load: CacheStampedeSourceLoad, group: CacheStampedeReaderGroup): void {
  if (load.readerGroups.length >= MAX_CACHE_STAMPEDE_READER_GROUPS_PER_LOAD) return;
  const existing = load.readerGroups.find(
    (candidate) => candidate.processId === group.processId && candidate.arrivedAtMs === group.arrivedAtMs && candidate.deadlineAtMs === group.deadlineAtMs,
  );
  if (existing) existing.count += group.count;
  else load.readerGroups.push({ ...group });
}

function readerGroupsFor(
  state: CacheStampedeState,
  arrivals: number,
  readerOrdinalStart: number,
): CacheStampedeReaderGroup[] {
  const counts = new Map<string, number>();
  for (let index = 0; index < arrivals; index += 1) {
    const processNumber = (readerOrdinalStart + index) % state.config.processCount;
    const processId = `process-${processNumber + 1}`;
    counts.set(processId, (counts.get(processId) ?? 0) + 1);
  }
  return [...counts.entries()].map(([processId, count]) => ({
    id: `reader-group-${state.nextReaderGroupNumber++}`,
    processId,
    count,
    arrivedAtMs: state.timeMs,
    deadlineAtMs: state.timeMs + state.config.waiterTimeoutMs,
  }));
}

function fillCache(state: CacheStampedeState, filledAtMs: number): void {
  const jitterOffset = state.mitigation === "jitter" && state.config.ttlJitterMs > 0
    ? Math.round((deterministicUnit(state.seed, state.fillSequence++) * 2 - 1) * state.config.ttlJitterMs)
    : 0;
  if (state.mitigation !== "jitter") state.fillSequence += 1;
  const effectiveTtl = Math.max(MIN_CACHE_STAMPEDE_TTL_MS, state.config.ttlMs + jitterOffset);
  state.cache = {
    status: "fresh",
    valueVersion: state.cache.valueVersion + 1,
    filledAtMs,
    freshUntilMs: filledAtMs + effectiveTtl,
    staleUntilMs: filledAtMs + effectiveTtl + state.config.staleGraceMs,
  };
}

function arrivalsForStep(state: CacheStampedeState): number {
  const logical = state.arrivalRemainder + state.config.arrivalRatePerSecond * CACHE_STAMPEDE_STEP_MS / 1_000;
  const count = Math.floor(logical + 1e-9);
  state.arrivalRemainder = Math.max(0, logical - count);
  return count;
}

function cacheStatusAt(cache: CacheStampedeCache, timeMs: number): CacheStampedeCacheStatus {
  if (cache.filledAtMs === null || cache.freshUntilMs === null) return "cold";
  if (timeMs < cache.freshUntilMs) return "fresh";
  if (cache.staleUntilMs !== null && timeMs < cache.staleUntilMs) return "stale";
  return "expired";
}

function sourceConcurrency(state: CacheStampedeState): number {
  return state.activeLoads.reduce((sum, load) => sum + load.callCount, 0);
}

function historyPointFor(state: CacheStampedeState): CacheStampedeHistoryPoint {
  const waitLatencyMs = state.totals.waitSamples > 0 ? state.totals.waitMs / state.totals.waitSamples : 0;
  const staleAgeMs = state.cache.status === "stale" && state.cache.freshUntilMs !== null
    ? Math.max(0, state.timeMs - state.cache.freshUntilMs)
    : 0;
  return {
    tick: state.tick,
    timeMs: state.timeMs,
    readers: state.lastStep.readers,
    cacheMisses: state.lastStep.cacheMisses,
    sourceQps: (state.lastStep.sourceCallsStarted * 1_000) / CACHE_STAMPEDE_STEP_MS,
    sourceConcurrency: sourceConcurrency(state),
    waitLatencyMs,
    staleAgeMs,
    lockContention: state.lastStep.lockContention,
    failedLoads: state.lastStep.failedLoads,
  };
}

function emptyStepStats(): CacheStampedeStepStats {
  return {
    readers: 0,
    cacheHits: 0,
    cacheMisses: 0,
    staleServed: 0,
    sourceCallsStarted: 0,
    sourceCallsCompleted: 0,
    failedLoads: 0,
    timedOutReaders: 0,
    waitSamples: 0,
    waitMs: 0,
    coalescedReaders: 0,
    lockContention: 0,
    lockAcquisitions: 0,
    refreshes: 0,
  };
}

function emptyTotals(): CacheStampedeTotals {
  return {
    readers: 0,
    cacheHits: 0,
    cacheMisses: 0,
    staleServed: 0,
    sourceCalls: 0,
    sourceCallsCompleted: 0,
    failedLoads: 0,
    failedReaders: 0,
    timedOutReaders: 0,
    waitSamples: 0,
    waitMs: 0,
    maxWaitMs: 0,
    coalescedReaders: 0,
    lockContention: 0,
    lockAcquisitions: 0,
    leaseExpirations: 0,
    ownerFailures: 0,
    refreshes: 0,
    peakSourceConcurrency: 0,
  };
}

function cloneState(state: CacheStampedeState): CacheStampedeState {
  return {
    ...state,
    config: { ...state.config },
    cache: { ...state.cache },
    activeLoads: state.activeLoads.map((load) => ({
      ...load,
      readerGroups: load.readerGroups.map((group) => ({ ...group })),
    })),
    lock: { ...state.lock },
    failedOwnerLoadIds: [...state.failedOwnerLoadIds],
    totals: { ...state.totals },
    lastStep: { ...state.lastStep },
    history: state.history.map((point) => ({ ...point })),
    events: [...state.events],
    completion: { ...state.completion },
  };
}

function validateConfig(config: CacheStampedeConfig): void {
  boundedNumber(config.arrivalRatePerSecond, MIN_CACHE_STAMPEDE_ARRIVAL_RATE, MAX_CACHE_STAMPEDE_ARRIVAL_RATE, "Arrival rate");
  boundedInteger(config.burstReaders, MIN_CACHE_STAMPEDE_BURST_READERS, MAX_CACHE_STAMPEDE_BURST_READERS, "Burst readers");
  boundedNumber(config.loaderLatencyMs, MIN_CACHE_STAMPEDE_LOADER_LATENCY_MS, MAX_CACHE_STAMPEDE_LOADER_LATENCY_MS, "Loader latency");
  boundedNumber(config.ttlMs, MIN_CACHE_STAMPEDE_TTL_MS, MAX_CACHE_STAMPEDE_TTL_MS, "TTL");
  boundedNumber(config.ttlJitterMs, 0, MAX_CACHE_STAMPEDE_TTL_JITTER_MS, "TTL jitter");
  boundedInteger(config.processCount, MIN_CACHE_STAMPEDE_PROCESS_COUNT, MAX_CACHE_STAMPEDE_PROCESS_COUNT, "Process count");
  boundedNumber(config.lockLeaseMs, MIN_CACHE_STAMPEDE_LOCK_LEASE_MS, MAX_CACHE_STAMPEDE_LOCK_LEASE_MS, "Lock lease");
  boundedNumber(config.waiterTimeoutMs, MIN_CACHE_STAMPEDE_WAITER_TIMEOUT_MS, MAX_CACHE_STAMPEDE_WAITER_TIMEOUT_MS, "Waiter timeout");
  boundedNumber(config.staleGraceMs, 0, MAX_CACHE_STAMPEDE_STALE_GRACE_MS, "Stale grace");
}

function markMeaningful(state: CacheStampedeState): void {
  state.completion.meaningfulAction = true;
  state.completion.completed = false;
}

function emitEvent(
  state: CacheStampedeState,
  events: SimulationEvent[],
  type: string,
  title: string,
  detail: string,
  tone: SimulationEvent["tone"],
): void {
  const event: SimulationEvent = {
    id: `cache-stampede-event-${state.eventSequence}`,
    tick: state.tick,
    type,
    title,
    detail,
    tone,
  };
  state.eventSequence += 1;
  events.push(event);
}

function deterministicUnit(seed: number, index: number): number {
  let value = (Math.imul(seed || 1, (index + 1) | 0) ^ 0x9e3779b9) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 4_294_967_296;
}

function assertMitigation(value: unknown): asserts value is CacheStampedeMitigation {
  if (!CACHE_STAMPEDE_MITIGATIONS.includes(value as CacheStampedeMitigation)) {
    throw new CacheStampedeValidationError(`Unsupported cache-stampede mitigation: ${String(value)}.`);
  }
}

function assertSpeed(value: unknown): asserts value is SimulationSpeed {
  if (!SIMULATION_SPEEDS.includes(value as SimulationSpeed)) {
    throw new CacheStampedeValidationError(`Unsupported simulation speed: ${String(value)}.`);
  }
}

function boundedNumber(value: number, min: number, max: number, label: string): number {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new CacheStampedeValidationError(`${label} must be between ${min} and ${max}.`);
  }
  return value;
}

function boundedInteger(value: number, min: number, max: number, label: string): number {
  if (!Number.isInteger(value)) {
    throw new CacheStampedeValidationError(`${label} must be an integer.`);
  }
  return boundedNumber(value, min, max, label);
}

function assertInteger(value: number, label: string): void {
  if (!Number.isInteger(value)) throw new CacheStampedeValidationError(`${label} must be an integer.`);
}

function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new CacheStampedeValidationError(`${label} must be finite.`);
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function formatMs(value: number): string {
  return `${Math.round(value)} ms`;
}

function assertNever(value: never): never {
  throw new CacheStampedeValidationError(`Unsupported cache-stampede action: ${String(value)}.`);
}

export { CACHE_STAMPEDE_PRESETS };
