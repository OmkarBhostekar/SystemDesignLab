import { describe, expect, it } from "vitest";

import {
  MAX_LATENCY_HISTORY,
  MAX_LATENCY_SAMPLE_COUNT,
  TAIL_LATENCY_PRESETS,
  TailLatencyValidationError,
  createTailLatencyState,
  fanOutSlowProbability,
  tailLatencyMetrics,
  transitionTailLatency,
} from ".";

describe("tail latency simulation", () => {
  it("creates deterministic serializable states and reproduces the average-hidden-tail preset", () => {
    for (const preset of TAIL_LATENCY_PRESETS) {
      const first = createTailLatencyState(preset.id);
      const second = createTailLatencyState(preset.id);
      expect(first).toEqual(second);
      expect(JSON.parse(JSON.stringify(first))).toEqual(first);
      expect(first.tick).toBe(0);
      expect(first.history).toHaveLength(1);
      expect(first.events).toEqual([]);
    }

    const baseline = createTailLatencyState("average-hides-tail");
    expect(baseline.metrics.averageMs).toBeCloseTo(70, 1);
    expect(baseline.metrics.p99Ms).toBe(900);
    expect(baseline.metrics.maxMs).toBe(900);
    expect(baseline.metrics.p50Ms).toBeCloseTo(53.1, 1);
  });

  it("models fan-out amplification and the independent probability formula", () => {
    const state = createTailLatencyState("average-hides-tail");
    expect(fanOutSlowProbability(0.01, 100)).toBeCloseTo(1 - 0.99 ** 100, 10);
    const fanout = transitionTailLatency(state, { type: "set-fan-out", count: 20 });
    expect(fanout.metrics.independentFanOutRisk).toBeCloseTo(1 - 0.98 ** 20, 10);
    expect(fanout.metrics.fanOutSlowProbability).toBe(fanout.metrics.independentFanOutRisk);
    expect(fanout.metrics.p95Ms).toBeGreaterThan(state.metrics.p95Ms);

    const correlated = transitionTailLatency(fanout.state, { type: "toggle-correlated-slowdown" });
    expect(correlated.metrics.independentFanOutRisk).toBeGreaterThan(correlated.metrics.fanOutSlowProbability);
  });

  it("exposes mitigation trade-offs for hedging, deadlines, and degradation", () => {
    let state = createTailLatencyState("fan-out-amplification");
    const before = state.metrics;
    state = transitionTailLatency(state, { type: "toggle-hedging" }).state;
    expect(state.metrics.p99Ms).toBeLessThanOrEqual(before.p99Ms);
    expect(state.metrics.hedgeLoadMultiplier).toBeGreaterThan(1);

    state = transitionTailLatency(state, { type: "toggle-timeout" }).state;
    state = transitionTailLatency(state, { type: "set-timeout", milliseconds: 100 }).state;
    expect(state.metrics.maxMs).toBeLessThanOrEqual(100);
    expect(state.metrics.timeoutRate).toBeGreaterThan(0);

    state = transitionTailLatency(state, { type: "toggle-graceful-degradation" }).state;
    expect(state.metrics.partialResponseRate).toBeGreaterThan(0);
    expect(state.metrics.partialResponseRate).toBe(state.metrics.timeoutRate);
  });

  it("shows queueing and an injected slowdown while bounding samples and history", () => {
    let state = createTailLatencyState("average-hides-tail");
    const queued = transitionTailLatency(state, { type: "set-queue-utilization", utilization: 0.9 });
    expect(queued.metrics.queueWaitMs).toBeGreaterThan(queued.state.config.averageServiceMs);
    expect(queued.metrics.p99Ms).toBeGreaterThan(state.metrics.p99Ms);

    const slowed = transitionTailLatency(queued.state, { type: "inject-slowdown" });
    expect(slowed.metrics.slowdownActive).toBe(true);
    expect(slowed.events.map((event) => event.type)).toContain("slowdown-injected");
    const recovered = transitionTailLatency(slowed.state, { type: "recover-slowdown" });
    expect(recovered.metrics.slowdownActive).toBe(false);

    state = recovered.state;
    for (let index = 0; index < MAX_LATENCY_HISTORY + 12; index += 1) {
      state = transitionTailLatency(state, { type: "step" }).state;
    }
    expect(state.history).toHaveLength(MAX_LATENCY_HISTORY);
    expect(state.latencySamples.length).toBeLessThanOrEqual(MAX_LATENCY_SAMPLE_COUNT);
  });

  it("requires a meaningful action and a later step for completion, preserves input, and resets", () => {
    const initial = createTailLatencyState("average-hides-tail");
    const snapshot = structuredClone(initial);
    const first = transitionTailLatency(initial, { type: "step" });
    expect(first.state.completion.completed).toBe(false);
    expect(initial).toEqual(snapshot);

    const changed = transitionTailLatency(first.state, { type: "inject-slowdown" });
    expect(changed.state.completion.completed).toBe(false);
    const complete = transitionTailLatency(changed.state, { type: "step" });
    expect(complete.state.completion.completed).toBe(true);
    expect(complete.state.completion.progressObserved).toBe(true);

    const reset = transitionTailLatency(complete.state, { type: "reset" });
    expect(reset.state).toEqual(createTailLatencyState("average-hides-tail"));
  });

  it("rejects unbounded controls", () => {
    const state = createTailLatencyState("average-hides-tail");
    expect(() => transitionTailLatency(state, { type: "set-fan-out", count: 0 })).toThrow(TailLatencyValidationError);
    expect(() => transitionTailLatency(state, { type: "set-queue-utilization", utilization: 1 })).toThrow(TailLatencyValidationError);
    expect(() => transitionTailLatency(state, { type: "set-sample-window", requests: 99 })).toThrow(TailLatencyValidationError);
    expect(() => transitionTailLatency(state, { type: "set-timeout", milliseconds: 0 })).toThrow(TailLatencyValidationError);
    expect(() => tailLatencyMetrics({ ...state, history: Array.from({ length: MAX_LATENCY_HISTORY + 1 }, () => state.history[0]!) })).toThrow(TailLatencyValidationError);
  });
});
