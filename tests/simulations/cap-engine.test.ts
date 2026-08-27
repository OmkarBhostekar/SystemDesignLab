import { describe, expect, it } from "vitest";

import {
  CAP_PRESET_IDS,
  capMetrics,
  createCapState,
  transitionCap,
  CapValidationError,
} from "@/simulations/cap";

function apply(state: ReturnType<typeof createCapState>, action: Parameters<typeof transitionCap>[1]) {
  return transitionCap(state, action).state;
}

describe("CAP simulation engine", () => {
  it("creates deterministic serializable three-replica presets", () => {
    for (const presetId of CAP_PRESET_IDS) {
      const first = createCapState(presetId);
      const second = createCapState(presetId);
      expect(first).toEqual(second);
      expect(JSON.parse(JSON.stringify(first))).toEqual(first);
      expect(first.replicas.map((replica) => replica.id)).toEqual(["replica-a", "replica-b", "replica-c"]);
      expect(first.replicas.filter((replica) => replica.side === "left")).toHaveLength(1);
      expect(first.replicas.filter((replica) => replica.side === "right")).toHaveLength(2);
    }
  });

  it("rejects partition-time writes while keeping local reads available", () => {
    let state = createCapState("inventory");
    state = apply(state, { type: "set-policy", policy: "reject-writes" });
    state = apply(state, { type: "partition" });
    state = apply(state, { type: "write", side: "left", delta: -1 });
    state = apply(state, { type: "write", side: "right", delta: -1 });
    state = apply(state, { type: "read", side: "left" });

    const metrics = capMetrics(state);
    expect(metrics.acknowledgedWrites).toBe(0);
    expect(metrics.rejectedWrites).toBe(2);
    expect(metrics.availableReads).toBe(1);
    expect(metrics.availableWrites).toBe(0);
    expect(state.operations.filter((operation) => operation.kind === "write").every((operation) => !operation.acknowledged)).toBe(true);
    expect(state.replicas.every((replica) => replica.value === 1)).toBe(true);
  });

  it("records the learning checkpoint even when CP rejection leaves no divergence", () => {
    let state = createCapState("inventory");
    state = apply(state, { type: "set-policy", policy: "reject-writes" });
    state = apply(state, { type: "partition" });
    state = apply(state, { type: "write", side: "left", delta: -1 });
    state = apply(state, { type: "read", side: "left" });
    state = apply(state, { type: "heal" });
    expect(state.pendingRepair).toBe(false);
    state = apply(state, { type: "repair" });
    expect(state.progress.completed).toBe(true);
  });

  it("routes writes to one owner and makes the other side unavailable", () => {
    let state = createCapState("inventory");
    state = apply(state, { type: "set-policy", policy: "route-to-owner" });
    state = apply(state, { type: "partition" });
    state = apply(state, { type: "write", side: "left", delta: -1 });
    state = apply(state, { type: "write", side: "right", delta: -1 });

    expect(state.operations.at(-2)).toMatchObject({ acknowledged: false, available: false, targetReplicaId: "replica-b" });
    expect(state.operations.at(-1)).toMatchObject({ acknowledged: true, available: true, targetReplicaId: "replica-b" });
    expect(state.replicas.find((replica) => replica.id === "replica-a")?.value).toBe(1);
    expect(state.replicas.find((replica) => replica.id === "replica-b")?.value).toBe(0);
    expect(state.replicas.find((replica) => replica.id === "replica-c")?.value).toBe(1);

    state = apply(state, { type: "heal" });
    expect(capMetrics(state).converged).toBe(false);
    state = apply(state, { type: "repair" });
    expect(capMetrics(state).converged).toBe(true);
    expect(state.replicas.every((replica) => replica.value === 0)).toBe(true);
  });

  it("shows a profile conflict and a deterministic repair after both sides acknowledge", () => {
    let state = createCapState("profile-edits");
    state = apply(state, { type: "set-policy", policy: "accept-both" });
    state = apply(state, { type: "partition" });
    state = apply(state, { type: "write", side: "left", value: "mobile" });
    state = apply(state, { type: "write", side: "right", value: "web" });

    let metrics = capMetrics(state);
    expect(metrics.acknowledgedWrites).toBe(2);
    expect(metrics.conflictCount).toBe(1);
    expect(metrics.linearizabilityViolations).toBeGreaterThan(0);
    expect(state.events.some((event) => event.type === "conflict-detected")).toBe(true);

    state = apply(state, { type: "heal" });
    expect(capMetrics(state).repairPending).toBeGreaterThan(0);
    state = apply(state, { type: "repair" });
    metrics = capMetrics(state);
    expect(metrics.converged).toBe(true);
    expect(metrics.conflictCount).toBe(0);
    expect(metrics.conflictsResolved).toBe(1);
    expect(new Set(state.replicas.map((replica) => replica.value))).toEqual(new Set(["web"]));
  });

  it("does not report identical concurrent writes as a conflict or linearizability violation", () => {
    let state = createCapState("profile-edits");
    state = apply(state, { type: "set-policy", policy: "accept-both" });
    state = apply(state, { type: "partition" });
    state = apply(state, { type: "write", side: "left", value: "same profile" });
    state = apply(state, { type: "write", side: "right", value: "same profile" });

    const metrics = capMetrics(state);
    expect(metrics.acknowledgedWrites).toBe(2);
    expect(metrics.conflictCount).toBe(0);
    expect(metrics.linearizabilityViolations).toBe(0);
    expect(state.events.some((event) => event.type === "conflict-detected")).toBe(false);
  });

  it("bounds resolved conflict epochs during repeated partition and repair cycles", () => {
    let state = createCapState("profile-edits");
    state = apply(state, { type: "set-policy", policy: "accept-both" });

    for (let index = 0; index < 80; index += 1) {
      state = apply(state, { type: "partition" });
      state = apply(state, { type: "write", side: "left", value: `left-${index}` });
      state = apply(state, { type: "write", side: "right", value: `right-${index}` });
      state = apply(state, { type: "heal" });
      state = apply(state, { type: "repair" });
    }

    expect(state.resolvedConflictEpochs).toHaveLength(64);
    expect(state.resolvedConflictEpochs).toEqual(Array.from({ length: 64 }, (_, index) => index + 17));
    expect(state.operations).toHaveLength(64);
    expect(state.events).toHaveLength(64);
  });

  it("merges independent like increments without counting a conflict", () => {
    let state = createCapState("like-counters");
    state = apply(state, { type: "set-policy", policy: "accept-both" });
    state = apply(state, { type: "partition" });
    state = apply(state, { type: "write", side: "left", delta: 1 });
    state = apply(state, { type: "write", side: "right", delta: 1 });

    expect(capMetrics(state).conflictCount).toBe(0);
    expect(state.replicas.find((replica) => replica.id === "replica-a")?.value).toBe(1);
    expect(state.replicas.find((replica) => replica.id === "replica-b")?.value).toBe(1);
    state = apply(state, { type: "heal" });
    state = apply(state, { type: "repair" });
    expect(state.replicas.every((replica) => replica.value === 2)).toBe(true);
    expect(capMetrics(state).converged).toBe(true);
  });

  it("marks a read from the other side stale after an acknowledged AP write", () => {
    let state = createCapState("profile-edits");
    state = apply(state, { type: "set-policy", policy: "accept-both" });
    state = apply(state, { type: "partition" });
    state = apply(state, { type: "write", side: "right", value: "web" });
    state = apply(state, { type: "read", side: "left" });

    const read = state.operations.at(-1);
    expect(read).toMatchObject({ kind: "read", status: "stale", acknowledged: true, available: true, stale: true, linearizabilityViolation: true });
    expect(capMetrics(state).staleReads).toBe(1);
    expect(capMetrics(state).linearizabilityViolations).toBeGreaterThan(0);
  });

  it("does not mutate the input and reset returns the authored preset", () => {
    const initial = createCapState("like-counters");
    const snapshot = structuredClone(initial);
    let state = apply(initial, { type: "partition" });
    state = apply(state, { type: "set-policy", policy: "accept-both" });
    state = apply(state, { type: "write", side: "left", delta: 1 });
    expect(initial).toEqual(snapshot);
    expect(apply(state, { type: "reset" })).toEqual(createCapState("like-counters"));
  });

  it("rejects invalid policies, duplicate network transitions, and partition-time repair", () => {
    const state = createCapState("inventory");
    expect(() => transitionCap(state, { type: "set-policy", policy: "eventual" })).toThrow(CapValidationError);
    const partitioned = apply(state, { type: "partition" });
    expect(() => transitionCap(partitioned, { type: "partition" })).toThrow(CapValidationError);
    expect(() => transitionCap(partitioned, { type: "repair" })).toThrow(CapValidationError);
  });
});
