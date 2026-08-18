import { describe, expect, it } from "vitest";

import {
  HORIZONTAL_SCALING_PRESETS,
  HorizontalScalingValidationError,
  createHorizontalScalingState,
  horizontalScalingMetrics,
  transitionHorizontalScaling,
} from "./index";

function step(state: ReturnType<typeof createHorizontalScalingState>) {
  return transitionHorizontalScaling(state, { type: "step" });
}

describe("horizontal scaling simulation", () => {
  it("creates deterministic serializable states for every preset", () => {
    for (const preset of HORIZONTAL_SCALING_PRESETS) {
      const first = createHorizontalScalingState(preset.id);
      const second = createHorizontalScalingState(preset.id);
      expect(first).toEqual(second);
      expect(JSON.parse(JSON.stringify(first))).toEqual(first);
      expect(first.tick).toBe(0);
      expect(first.events).toEqual([]);
    }
  });

  it("shows saturation, bounded queue growth, and rejection", () => {
    const state = createHorizontalScalingState("stateless-scale-out");
    state.config.demandQps = 20_000;
    state.config.queueCapacity = 100;
    const first = step(state);
    const second = step(first.state);

    expect(first.metrics.overloaded).toBe(true);
    expect(first.metrics.queueDepth).toBe(100);
    expect(first.metrics.rejectedQps).toBeGreaterThan(0);
    expect(first.metrics.backlogQps).toBe(
      first.metrics.processedQps + first.metrics.queuedQps + first.metrics.rejectedQps,
    );
    expect(second.metrics.queueDepth).toBe(100);
    expect(second.metrics.rejectedQps).toBeGreaterThan(0);
    expect(second.state.queueDepth).toBeLessThanOrEqual(100);
    expect(first.events.map((event) => event.type)).toContain("overload-observed");
    expect(first.events.map((event) => event.type)).toContain("requests-rejected");
  });

  it("does not count a warming replica until its delay completes", () => {
    let state = createHorizontalScalingState("stateless-scale-out");
    const before = horizontalScalingMetrics(state);
    const added = transitionHorizontalScaling(state, { type: "add-replica" });
    const warming = horizontalScalingMetrics(added.state);
    expect(warming.appCapacityQps).toBe(before.appCapacityQps);
    expect(added.state.replicas.at(-1)?.status).toBe("warming");

    state = added.state;
    state = step(state).state;
    expect(state.replicas.at(-1)?.status).toBe("warming");
    state = step(state).state;
    expect(state.replicas.at(-1)?.status).toBe("active");
    expect(horizontalScalingMetrics(state).appCapacityQps).toBeGreaterThan(before.appCapacityQps);
  });

  it("models a disruptive vertical replacement and applies the target capacity after it", () => {
    let state = createHorizontalScalingState("small-internal-tool");
    const upgraded = transitionHorizontalScaling(state, {
      type: "upgrade-server",
      cores: 8,
      memoryGb: 16,
      replacementTicks: 2,
    });
    expect(upgraded.state.replicas[0]?.status).toBe("replacing");
    expect(horizontalScalingMetrics(upgraded.state).appCapacityQps).toBe(0);
    state = step(upgraded.state).state;
    expect(state.replicas[0]?.status).toBe("replacing");
    state = step(state).state;
    expect(state.replicas[0]).toMatchObject({ status: "active", cores: 8, memoryGb: 16 });
    expect(horizontalScalingMetrics(state).appCapacityQps).toBe(4_000);
  });

  it("keeps a shared dependency as the bottleneck after adding replicas", () => {
    let state = createHorizontalScalingState("shared-dependency-bottleneck");
    const before = step(state);
    state = before.state;
    const added = transitionHorizontalScaling(state, { type: "add-replica", cores: 8, memoryGb: 16 });
    state = step(added.state).state;
    state = step(state).state;
    const after = horizontalScalingMetrics(state);
    expect(after.appCapacityQps).toBeGreaterThan(before.metrics.appCapacityQps);
    expect(after.effectiveCapacityQps).toBe(700);
    expect(after.dependencySaturated).toBe(true);
  });

  it("supports failure and warm recovery for replicas and the database", () => {
    let state = createHorizontalScalingState("stateless-scale-out");
    const failed = transitionHorizontalScaling(state, { type: "fail-replica", replicaId: "replica-1" });
    expect(horizontalScalingMetrics(failed.state).activeReplicaCount).toBe(0);
    const recovered = transitionHorizontalScaling(failed.state, { type: "recover-replica", replicaId: "replica-1" });
    expect(recovered.state.replicas[0]?.status).toBe("warming");
    state = recovered.state;
    state = step(state).state;
    state = step(state).state;
    expect(state.replicas[0]?.status).toBe("active");

    const databaseFailed = transitionHorizontalScaling(state, { type: "fail-database" });
    expect(horizontalScalingMetrics(databaseFailed.state).effectiveCapacityQps).toBe(0);
    const databaseRecovered = transitionHorizontalScaling(databaseFailed.state, { type: "recover-database" });
    expect(databaseRecovered.state.database.status).toBe("healthy");
  });

  it("supports control actions and replica removal with deterministic events", () => {
    let state = createHorizontalScalingState("small-internal-tool");
    state = transitionHorizontalScaling(state, { type: "set-load-balancer", policy: "least-loaded" }).state;
    state = transitionHorizontalScaling(state, { type: "set-demand", qps: 600 }).state;
    state = transitionHorizontalScaling(state, { type: "set-hot-key", fraction: 0.2 }).state;
    state = transitionHorizontalScaling(state, { type: "set-session-mode", mode: "shared" }).state;
    state = transitionHorizontalScaling(state, { type: "set-sticky-sessions", sticky: false }).state;
    expect(state.config).toMatchObject({
      demandQps: 600,
      loadBalancer: "least-loaded",
      sessionMode: "shared",
      hotKeyFraction: 0.2,
    });
    const added = transitionHorizontalScaling(state, { type: "add-replica", cores: 1, memoryGb: 2 });
    expect(added.state.replicas).toHaveLength(2);
    const removed = transitionHorizontalScaling(added.state, {
      type: "remove-replica",
      replicaId: "replica-2",
    });
    expect(removed.state.replicas.map((replica) => replica.id)).toEqual(["replica-1"]);
    expect(new Set(removed.state.events.map((event) => event.id)).size).toBe(removed.state.events.length);
    expect(removed.state.events.map((event) => event.tick)).toEqual(
      [...removed.state.events.map((event) => event.tick)].sort((left, right) => left - right),
    );
  });

  it("reports local-session misses and hot-key concentration deterministically", () => {
    let state = createHorizontalScalingState("shared-dependency-bottleneck");
    state = transitionHorizontalScaling(state, { type: "add-replica" }).state;
    state = step(state).state;
    state = step(state).state;
    state = transitionHorizontalScaling(state, { type: "set-session-mode", mode: "local" }).state;
    state = transitionHorizontalScaling(state, { type: "set-sticky-sessions", sticky: false }).state;
    const result = step(state);
    expect(result.metrics.sessionMissesQps).toBeGreaterThan(0);
    expect(result.metrics.hotKeyQps).toBeGreaterThan(0);
    expect(result.metrics.hotKeyOwnerId).toBe("replica-1");
  });

  it("marks completion only after overload, capacity action, and a later step", () => {
    const state = createHorizontalScalingState("stateless-scale-out");
    state.config.demandQps = 3_000;
    const overload = step(state);
    expect(overload.state.progress.completed).toBe(false);
    const add = transitionHorizontalScaling(overload.state, { type: "add-replica" });
    expect(add.state.progress.completed).toBe(false);
    const later = step(add.state);
    expect(later.state.progress.resultObservedTick).toBe(later.state.tick);
    expect(later.state.progress.completed).toBe(true);
  });

  it("keeps transitions deterministic and preserves the input", () => {
    const state = createHorizontalScalingState("stateless-scale-out");
    const snapshot = structuredClone(state);
    const first = transitionHorizontalScaling(state, { type: "step" });
    const second = transitionHorizontalScaling(state, { type: "step" });
    expect(state).toEqual(snapshot);
    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(first.state.events.map((event) => event.id)).toEqual(
      first.state.events.map((event) => event.id),
    );
  });

  it("resets exactly to the preset and rejects invalid controls", () => {
    let state = createHorizontalScalingState("small-internal-tool");
    state = transitionHorizontalScaling(state, { type: "set-demand", qps: 900 }).state;
    state = step(state).state;
    const reset = transitionHorizontalScaling(state, { type: "reset" });
    expect(reset.state).toEqual(createHorizontalScalingState("small-internal-tool"));

    expect(() => transitionHorizontalScaling(state, { type: "set-demand", qps: -1 })).toThrow(
      HorizontalScalingValidationError,
    );
    expect(() => transitionHorizontalScaling(state, { type: "set-hot-key", fraction: 2 })).toThrow(
      HorizontalScalingValidationError,
    );
    expect(() => transitionHorizontalScaling(state, { type: "fail-replica", replicaId: "missing" })).toThrow(
      HorizontalScalingValidationError,
    );
  });
});
