import { describe, expect, it } from "vitest";

import {
  LOAD_BALANCING_POLICY_IDS,
  LOAD_BALANCING_PRESETS,
  compareLoadBalancingPolicies,
  createLoadBalancingState,
  evaluateLoadBalancingTrace,
  fixedHash32,
  getLoadBalancingHashOwner,
  loadBalancingMetrics,
  transitionLoadBalancing,
} from "@/simulations/load-balancing";

function step(state: ReturnType<typeof createLoadBalancingState>) {
  return transitionLoadBalancing(state, { type: "step" });
}

describe("load-balancing trace engine", () => {
  it("creates deterministic serializable traces for each authored preset", () => {
    for (const preset of LOAD_BALANCING_PRESETS) {
      const first = createLoadBalancingState(preset.id);
      const second = createLoadBalancingState(preset.id);
      expect(first).toEqual(second);
      expect(JSON.parse(JSON.stringify(first))).toEqual(first);
      expect(first.trace).toHaveLength(preset.traceLength);
      expect(first.results).toEqual([]);
    }
  });

  it("replays the same request trace for every policy", () => {
    const state = createLoadBalancingState("mixed-checkout-work");
    const comparisons = compareLoadBalancingPolicies(state.trace, state.config, state.nodes);
    expect(comparisons.map((comparison) => comparison.policy)).toEqual([...LOAD_BALANCING_POLICY_IDS]);
    expect(comparisons.every((comparison) => comparison.servedRequests + comparison.rejectedRequests === state.trace.length)).toBe(true);

    const first = evaluateLoadBalancingTrace(state.trace, state.config, state.nodes);
    const second = evaluateLoadBalancingTrace(state.trace, state.config, state.nodes);
    expect(first).toEqual(second);
    expect(first.results.map((result) => result.requestId)).toEqual(state.trace.map((request) => request.id));
  });

  it("keeps equal request counts distinct from work and tail latency", () => {
    const state = createLoadBalancingState("mixed-checkout-work");
    let roundRobin = state;
    while (roundRobin.traceCursor < roundRobin.trace.length) roundRobin = step(roundRobin).state;
    const metrics = loadBalancingMetrics(roundRobin);
    expect(metrics.servedRequests + metrics.rejectedRequests).toBe(roundRobin.trace.length);
    expect(metrics.totalWorkMs).toBeGreaterThan(metrics.servedRequests);
    expect(metrics.latencyP95Ms).toBeGreaterThanOrEqual(metrics.latencyP50Ms);
    expect(metrics.comparisons).toHaveLength(LOAD_BALANCING_POLICY_IDS.length);
    expect(new Set(metrics.nodeMetrics.map((node) => node.nodeId)).size).toBe(roundRobin.nodes.length);
    expect(metrics.nodeMetrics.some((node) => node.workMs > 0)).toBe(true);
  });

  it("shows hot-key concentration and topology remapping", () => {
    const initial = createLoadBalancingState("celebrity-cache-key");
    const stepped = step(initial).state;
    const hotKeyMetrics = loadBalancingMetrics(stepped);
    expect(hotKeyMetrics.hotKeyRequests).toBeGreaterThan(0);
    expect(hotKeyMetrics.hotKeyNodeId).toBeTruthy();
    expect(hotKeyMetrics.hotKeyShare).toBeGreaterThan(0.5);

    const expanded = transitionLoadBalancing(stepped, { type: "add-node" });
    expect(expanded.state.nodes.some((node) => node.id === "node-1")).toBe(true);
    expect(expanded.state.remapping.totalKeys).toBeGreaterThan(0);
    expect(expanded.metrics.remappedKeyCount).toBeGreaterThan(0);
  });

  it("uses stable consistent-ring ownership to limit topology remapping", () => {
    const initial = createLoadBalancingState("celebrity-cache-key");
    const beforeIds = initial.nodes.filter((node) => node.status === "active").map((node) => node.id).sort();
    const expanded = transitionLoadBalancing(initial, { type: "add-node" });
    const afterIds = expanded.state.nodes.filter((node) => node.status === "active").map((node) => node.id).sort();
    const keys = [...new Set(initial.trace.map((request) =>
      request.hotKeyRoll < initial.config.hotKeyProbability ? "celebrity-key" : request.key))];
    const moduloMoved = keys.filter((key) =>
      beforeIds[fixedHash32(key) % beforeIds.length] !== afterIds[fixedHash32(key) % afterIds.length]).length;

    expect(getLoadBalancingHashOwner(keys[0]!, beforeIds)).toBe(
      getLoadBalancingHashOwner(keys[0]!, [...beforeIds].reverse()),
    );
    expect(expanded.state.remapping.fraction).toBeLessThan(0.35);
    expect(expanded.state.remapping.fraction).toBeLessThan(moduloMoved / keys.length);
  });

  it("publishes latency observations after the configured metric delay", () => {
    const initial = createLoadBalancingState("celebrity-cache-key");
    const nodes = initial.nodes.slice(0, 2).map((node) => ({ ...node, weight: 1 }));
    const trace = [
      { ...initial.trace[0]!, id: "slow-request", tick: 0, workMs: 1_000, hotKeyRoll: 1 },
      { ...initial.trace[1]!, id: "next-request", tick: 1, workMs: 10, hotKeyRoll: 1 },
    ];
    const baseConfig = {
      ...initial.config,
      policy: "latency-aware" as const,
      selectionUnit: "request" as const,
      requestsPerStep: 1,
      hotKeyProbability: 0,
    };
    const oneTickDelay = evaluateLoadBalancingTrace(trace, { ...baseConfig, metricDelayTicks: 1 }, nodes);
    const staleForFiveTicks = evaluateLoadBalancingTrace(trace, { ...baseConfig, metricDelayTicks: 5 }, nodes);

    expect(oneTickDelay.results.map((result) => result.nodeId)).toEqual(["cache-a", "cache-b"]);
    expect(staleForFiveTicks.results.map((result) => result.nodeId)).toEqual(["cache-a", "cache-a"]);
  });

  it("removes failed nodes from selection and recovers them", () => {
    const initial = createLoadBalancingState("mixed-checkout-work");
    const failed = transitionLoadBalancing(initial, { type: "fail-node", nodeId: "checkout-a" });
    expect(failed.state.nodes.find((node) => node.id === "checkout-a")?.status).toBe("failed");
    const afterFailure = step(failed.state);
    expect(afterFailure.metrics.nodeMetrics.find((node) => node.nodeId === "checkout-a")?.assignments).toBe(0);
    const recovered = transitionLoadBalancing(afterFailure.state, { type: "recover-node", nodeId: "checkout-a" });
    expect(recovered.state.nodes.find((node) => node.id === "checkout-a")?.status).toBe("active");
  });

  it("models connection-level pinning and deterministic remaps after failure", () => {
    const initial = createLoadBalancingState("connection-skew");
    const first = step(initial);
    const pinned = first.state.results.filter((result) => result.status === "served");
    expect(new Set(pinned.map((result) => result.connectionId)).size).toBeGreaterThan(1);
    const failedNode = first.state.nodes.find((node) => node.status === "active")?.id;
    expect(failedNode).toBeTruthy();
    const failed = transitionLoadBalancing(first.state, { type: "fail-node", nodeId: failedNode! });
    const next = step(failed.state);
    expect(next.metrics.connectionRemaps).toBeGreaterThanOrEqual(0);
    expect(next.metrics.nodeMetrics.find((node) => node.nodeId === failedNode)?.assignments).toBe(0);
  });

  it("marks completion after the trace produces a policy comparison", () => {
    let state = createLoadBalancingState("mixed-checkout-work");
    while (state.traceCursor < state.trace.length) state = step(state).state;
    expect(state.progress.traceCompleted).toBe(true);
    expect(state.progress.comparisonObserved).toBe(true);
    expect(state.progress.completed).toBe(true);
  });

  it("preserves input state and rejects invalid controls", () => {
    const state = createLoadBalancingState("mixed-checkout-work");
    const snapshot = JSON.stringify(state);
    const stepped = transitionLoadBalancing(state, { type: "step" });
    expect(JSON.stringify(state)).toBe(snapshot);
    expect(stepped.state).not.toBe(state);
    expect(() => transitionLoadBalancing(state, { type: "set-hot-key-rate", rate: 1.2 })).toThrow();
    expect(() => transitionLoadBalancing(state, { type: "set-node-weight", nodeId: "missing", weight: 2 })).toThrow();
  });
});
