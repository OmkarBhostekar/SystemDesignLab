import { describe, expect, it } from "vitest";

import {
  CACHE_STAMPEDE_PRESETS,
  MAX_CACHE_STAMPEDE_EVENTS,
  MAX_CACHE_STAMPEDE_HISTORY,
  cacheStampedeMetrics,
  createCacheStampedeState,
  transitionCacheStampede,
} from "@/simulations/cache-stampede";

function step(state: ReturnType<typeof createCacheStampedeState>, count = 1) {
  let next = state;
  for (let index = 0; index < count; index += 1) {
    next = transitionCacheStampede(next, { type: "step" }).state;
  }
  return next;
}

describe("cache stampede simulation engine", () => {
  it("creates deterministic serializable states for every authored scenario", () => {
    for (const preset of CACHE_STAMPEDE_PRESETS) {
      const first = createCacheStampedeState(preset.id);
      const second = createCacheStampedeState(preset.id);
      expect(first).toEqual(second);
      expect(JSON.parse(JSON.stringify(first))).toEqual(first);
      expect(first.history).toHaveLength(1);
      expect(first.events).toEqual([]);
    }
  });

  it("amplifies a synchronized miss and collapses it with local or distributed coordination", () => {
    const naive = step(createCacheStampedeState("synchronized-expiry"));
    expect(naive.lastStep.readers).toBeGreaterThan(100);
    expect(naive.lastStep.sourceCallsStarted).toBe(naive.lastStep.readers);
    expect(naive.totals.peakSourceConcurrency).toBe(naive.lastStep.readers);

    const local = step(transitionCacheStampede(
      createCacheStampedeState("synchronized-expiry"),
      { type: "set-mitigation", mitigation: "local-single-flight" },
    ).state);
    expect(local.lastStep.sourceCallsStarted).toBe(local.config.processCount);
    expect(local.totals.coalescedReaders).toBeGreaterThan(0);
    expect(local.totals.peakSourceConcurrency).toBe(local.config.processCount);

    const distributed = step(transitionCacheStampede(
      createCacheStampedeState("synchronized-expiry"),
      { type: "set-mitigation", mitigation: "distributed-lock" },
    ).state);
    expect(distributed.lastStep.sourceCallsStarted).toBe(1);
    expect(distributed.lock.ownerToken).toBe("lock-1");
    expect(distributed.totals.lockContention).toBeGreaterThan(0);
  });

  it("keeps owner tokens safe across lease expiry and a crashed old owner", () => {
    let state = createCacheStampedeState("cold-start-burst");
    state = transitionCacheStampede(state, { type: "set-mitigation", mitigation: "distributed-lock" }).state;
    state = transitionCacheStampede(state, { type: "set-lock-lease", milliseconds: 100 }).state;
    state = step(state);
    const oldToken = state.lock.ownerToken;
    expect(oldToken).toBe("lock-1");

    state = transitionCacheStampede(state, { type: "inject-owner-failure" }).state;
    state = step(state);
    expect(state.lock.ownerToken).toBe("lock-2");
    expect(state.totals.leaseExpirations).toBeGreaterThanOrEqual(1);

    state = step(state);
    const newerToken = state.lock.ownerToken;
    state = step(state, 3);
    expect(state.lock.ownerToken).not.toBe(oldToken);
    expect(state.lock.ownerToken).not.toBe(newerToken);
    expect(state.totals.ownerFailures).toBeGreaterThan(0);
  });

  it("serves stale data during SWR refresh failure and exposes stale age", () => {
    let state = createCacheStampedeState("failure-and-stale");
    state = transitionCacheStampede(state, { type: "set-source-failure", failed: true }).state;
    state = step(state, 9);
    const metrics = cacheStampedeMetrics(state);
    expect(metrics.cacheStatus).toBe("stale");
    expect(metrics.staleServed).toBeGreaterThan(0);
    expect(metrics.staleAgeMs).toBeGreaterThan(0);
    state = step(state, 4);
    expect(cacheStampedeMetrics(state).failedLoads).toBeGreaterThan(0);
  });

  it("counts a timed-out source failure once per reader", () => {
    let state = createCacheStampedeState("synchronized-expiry");
    state = transitionCacheStampede(state, { type: "set-loader-latency", milliseconds: 1_000 }).state;
    state = transitionCacheStampede(state, { type: "set-waiter-timeout", milliseconds: 100 }).state;
    state = transitionCacheStampede(state, { type: "set-source-failure", failed: true }).state;
    state = step(state, 12);

    const metrics = cacheStampedeMetrics(state);
    // Every completed source-failed reader also timed out in this scenario.
    // The timeout count is a subset of that same reader set, not an extra set.
    expect(metrics.timedOutReaders).toBeGreaterThan(0);
    expect(metrics.failedReaders).toBe(metrics.timedOutReaders);
    expect(metrics.timedOutReaders).toBeLessThanOrEqual(metrics.failedReaders);
    expect(metrics.failedReaders).toBeLessThanOrEqual(metrics.totalReaders);
  });

  it("bounds history and event timelines while preserving completion and reset", () => {
    let state = createCacheStampedeState("synchronized-expiry");
    state = transitionCacheStampede(state, { type: "set-mitigation", mitigation: "jitter" }).state;
    state = transitionCacheStampede(state, { type: "set-ttl-jitter", milliseconds: 400 }).state;
    state = step(state, MAX_CACHE_STAMPEDE_HISTORY + 12);
    expect(state.history.length).toBeLessThanOrEqual(MAX_CACHE_STAMPEDE_HISTORY);
    expect(state.events.length).toBeLessThanOrEqual(MAX_CACHE_STAMPEDE_EVENTS);
    expect(state.completion.completed).toBe(true);

    const reset = transitionCacheStampede(state, { type: "reset" }).state;
    expect(reset).toEqual(createCacheStampedeState("synchronized-expiry"));
  });
});
