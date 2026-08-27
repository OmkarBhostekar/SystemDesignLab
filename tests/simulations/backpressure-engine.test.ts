import { describe, expect, it } from "vitest";

import {
  BACKPRESSURE_PRESET_IDS,
  createBackpressureState,
  transitionBackpressure,
  type BackpressureAction,
  type BackpressureState,
} from "@/simulations/backpressure";

function run(state: BackpressureState, actions: readonly BackpressureAction[]): BackpressureState {
  return actions.reduce((current, action) => transitionBackpressure(current, action).state, state);
}

function conservation(state: BackpressureState): void {
  const pending = state.queue.length + state.workerBuffer.length + state.processing.length + state.retryQueue.length;
  expect(state.counters.generated).toBe(
    state.counters.completed + state.counters.rejected + state.counters.dropped + pending,
  );
  expect(state.queue.length).toBeLessThanOrEqual(state.config.queueCapacity);
  expect(state.workerBuffer.length + state.processing.length).toBeLessThanOrEqual(
    state.config.consumerCount * state.config.prefetch,
  );
}

describe("backpressure engine", () => {
  it("creates serializable deterministic state for every authored preset", () => {
    expect(BACKPRESSURE_PRESET_IDS).toHaveLength(4);
    for (const presetId of BACKPRESSURE_PRESET_IDS) {
      const first = run(createBackpressureState(presetId), [
        { type: "step" },
        { type: "step" },
        { type: "inject-outage" },
        { type: "step" },
        { type: "recover-outage" },
      ]);
      const second = run(createBackpressureState(presetId), [
        { type: "step" },
        { type: "step" },
        { type: "inject-outage" },
        { type: "step" },
        { type: "recover-outage" },
      ]);
      expect(second).toEqual(first);
      expect(JSON.parse(JSON.stringify(first))).toEqual(first);
      conservation(first);
    }
  });

  it("grows a bounded backlog when arrival outruns service", () => {
    let state = createBackpressureState("steady-capacity");
    state = run(state, [
      { type: "set-arrival-rate", rate: 20 },
      { type: "set-service-rate", rate: 1 },
      { type: "set-consumer-count", count: 1 },
      { type: "set-prefetch", count: 1 },
      { type: "set-queue-capacity", capacity: 8 },
    ]);
    for (let tick = 0; tick < 5; tick += 1) {
      state = transitionBackpressure(state, { type: "step" }).state;
      conservation(state);
    }
    expect(state.metrics.queueDepth).toBeGreaterThan(0);
    expect(state.metrics.oldestAgeTicks).toBeGreaterThan(0);
    expect(state.metrics.rejected).toBeGreaterThan(0);
    expect(state.metrics.queueDepth).toBeLessThanOrEqual(8);
  });

  it("throttles producer admission without allowing queue growth", () => {
    let state = createBackpressureState("steady-capacity");
    state = run(state, [
      { type: "set-arrival-rate", rate: 24 },
      { type: "set-service-rate", rate: 2 },
      { type: "set-consumer-count", count: 1 },
      { type: "set-prefetch", count: 1 },
      { type: "set-admission-policy", policy: "throttle" },
    ]);
    for (let tick = 0; tick < 6; tick += 1) state = transitionBackpressure(state, { type: "step" }).state;
    conservation(state);
    expect(state.metrics.throttled).toBeGreaterThan(0);
    expect(state.metrics.queueDepth).toBeLessThanOrEqual(2);
    expect(state.metrics.rejectedOrDropped).toBeGreaterThan(0);
  });

  it("sheds lower-priority work while preserving a bounded critical path", () => {
    let state = createBackpressureState("steady-capacity");
    state = run(state, [
      { type: "set-arrival-rate", rate: 32 },
      { type: "set-service-rate", rate: 1 },
      { type: "set-consumer-count", count: 1 },
      { type: "set-prefetch", count: 1 },
      { type: "set-queue-capacity", capacity: 6 },
      { type: "set-priority-policy", policy: "reserved-critical" },
      { type: "set-admission-policy", policy: "shed-low-priority" },
    ]);
    for (let tick = 0; tick < 4; tick += 1) state = transitionBackpressure(state, { type: "step" }).state;
    conservation(state);
    expect(state.metrics.dropped).toBeGreaterThan(0);
    expect(state.queue.every((item) => item.priority === "critical" || item.priority === "normal")).toBe(true);
  });

  it("bounds retry amplification and drains after a dependency recovers", () => {
    let state = createBackpressureState("downstream-outage");
    state = run(state, [
      { type: "set-arrival-rate", rate: 4 },
      { type: "set-burst-rate", rate: 4 },
      { type: "set-retry-limit", count: 2 },
      { type: "inject-outage" },
    ]);
    for (let tick = 0; tick < 7; tick += 1) state = transitionBackpressure(state, { type: "step" }).state;
    expect(state.metrics.outageFailures).toBeGreaterThan(0);
    expect(state.metrics.retries).toBeGreaterThan(0);
    expect(state.metrics.retryAmplification).toBeGreaterThan(1);
    conservation(state);

    state = run(state, [
      { type: "set-arrival-rate", rate: 0 },
      { type: "set-burst-rate", rate: 0 },
      { type: "recover-outage" },
    ]);
    for (let tick = 0; tick < 14; tick += 1) state = transitionBackpressure(state, { type: "step" }).state;
    conservation(state);
    expect(state.metrics.downstreamAvailable).toBe(true);
    expect(state.metrics.recoveryTimeTicks).not.toBeNull();
    expect(state.metrics.completed).toBeGreaterThan(0);
  });

  it("does not label outage duration as recovery drain time", () => {
    let state = createBackpressureState("steady-capacity");
    state = run(state, [
      { type: "set-arrival-rate", rate: 20 },
      { type: "set-burst-rate", rate: 0 },
      { type: "set-service-rate", rate: 1 },
      { type: "set-consumer-count", count: 1 },
      { type: "set-prefetch", count: 1 },
      { type: "set-queue-capacity", capacity: 8 },
      { type: "step" },
      { type: "inject-outage" },
      { type: "step" },
      { type: "set-arrival-rate", rate: 0 },
      { type: "recover-outage" },
    ]);

    const outageDuration = state.runtime.recoveryTick! - state.runtime.outageStartTick!;
    expect(outageDuration).toBe(1);
    expect(state.metrics.recoveryTimeTicks).toBeNull();
    expect(state.metrics.recoveryElapsedTicks).toBe(0);
    expect(state.metrics.recoveryComplete).toBe(false);

    let drainSteps = 0;
    while (!state.metrics.recoveryComplete && drainSteps < 40) {
      state = transitionBackpressure(state, { type: "step" }).state;
      drainSteps += 1;
    }
    expect(state.metrics.recoveryComplete).toBe(true);
    expect(state.metrics.recoveryTimeTicks).toBe(drainSteps);
    expect(state.metrics.recoveryTimeTicks).toBeGreaterThan(outageDuration);
    expect(state.metrics.recoveryElapsedTicks).toBe(drainSteps);
  });

  it("opens a safe circuit for throttle and shedding policies during outage", () => {
    let state = createBackpressureState("steady-capacity");
    state = run(state, [
      { type: "set-admission-policy", policy: "throttle" },
      { type: "set-arrival-rate", rate: 10 },
      { type: "inject-outage" },
    ]);
    state = transitionBackpressure(state, { type: "step" }).state;
    const attemptsAfterFirstFailure = state.metrics.attempts;
    state = transitionBackpressure(state, { type: "step" }).state;
    expect(state.metrics.attempts).toBe(attemptsAfterFirstFailure);
    expect(state.metrics.dependencyStatus).toBe("outage");
    conservation(state);
  });
});
