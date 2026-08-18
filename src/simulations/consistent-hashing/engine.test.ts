import { describe, expect, it } from "vitest";

import {
  CONSISTENT_HASHING_PRESET_IDS,
  CONSISTENT_HASHING_PRESETS,
  ConsistentHashingValidationError,
  buildConsistentHashTokens,
  calculateOwnershipVariance,
  createConsistentHashingState,
  fixedHash32,
  getKeyPlacement,
  transitionConsistentHashing,
} from "./index";

describe("consistent-hashing engine", () => {
  it("uses documented fixed FNV-1a UTF-8 hash vectors", () => {
    expect(fixedHash32("")).toBe(2_166_136_261);
    expect(fixedHash32("a")).toBe(3_826_002_220);
    expect(fixedHash32("hello")).toBe(1_335_831_723);
    expect(fixedHash32("key-0")).toBe(1_491_088_857);
    expect(fixedHash32("😀")).toBe(866_293_256);
  });

  it("builds stable sorted token positions without browser or random state", () => {
    const first = buildConsistentHashTokens(["node-b", "node-a"], "seed", true, 4);
    const second = buildConsistentHashTokens(["node-a", "node-b"], "seed", true, 4);
    expect(first).toEqual(second);
    expect(first).toHaveLength(8);
    expect(first).toEqual([...first].sort((left, right) => left.position - right.position || left.tokenId.localeCompare(right.tokenId)));
    expect(first.every((token) => token.position >= 0 && token.position <= 0xffff_ffff)).toBe(true);
  });

  it("creates all documented presets as serializable deterministic state", () => {
    expect(CONSISTENT_HASHING_PRESETS.map((preset) => preset.id)).toEqual([...CONSISTENT_HASHING_PRESET_IDS]);
    for (const presetId of CONSISTENT_HASHING_PRESET_IDS) {
      const state = createConsistentHashingState(presetId);
      expect(JSON.parse(JSON.stringify(state))).toEqual(state);
      expect(state.servers).toEqual([...state.servers].sort((left, right) => left.id.localeCompare(right.id)));
      expect(state.assignments.map((assignment) => assignment.keyId)).toEqual(
        [...state.assignments.map((assignment) => assignment.keyId)].sort((left, right) => Number(left.slice(4)) - Number(right.slice(4))),
      );
      expect(state.completion.completed).toBe(false);
    }
    expect(createConsistentHashingState("modulo-baseline").tokens).toEqual([]);
    expect(createConsistentHashingState("one-token-ring").tokens).toHaveLength(4);
    expect(createConsistentHashingState("vnode-ring").tokens).toHaveLength(64);
  });

  it("selects distinct physical replicas and respects a failed owner", () => {
    const initial = createConsistentHashingState("node-failure-migration");
    const placement = initial.assignments.find((assignment) => assignment.replicaNodeIds.length > 0);
    expect(placement).toBeDefined();
    expect(new Set([placement!.primaryNodeId, ...placement!.replicaNodeIds]).size).toBe(
      1 + placement!.replicaNodeIds.length,
    );

    const failed = transitionConsistentHashing(initial, { type: "fail-server", nodeId: placement!.primaryNodeId! });
    expect(failed.assignments.every((assignment) => assignment.primaryNodeId !== placement!.primaryNodeId || assignment.replicaNodeIds.length === 0)).toBe(true);
    expect(failed.metrics.remappedKeys).toBeGreaterThan(0);
    expect(failed.completion.completed).toBe(false);

    const observed = transitionConsistentHashing(failed, { type: "step" });
    expect(observed.completion.completed).toBe(true);
    expect(observed.assignments.every((assignment) => assignment.primaryNodeId !== placement!.primaryNodeId)).toBe(true);
  });

  it("shows broad modulo remapping and completes after lazy cutover", () => {
    let state = createConsistentHashingState("modulo-baseline");
    state = transitionConsistentHashing(state, { type: "set-key-count", count: 10_000 });
    const before = JSON.stringify(state);
    const pending = transitionConsistentHashing(state, { type: "add-server", nodeId: "node-e" });
    expect(JSON.stringify(state)).toBe(before);
    expect(pending.rolloutStatus).toBe("pending");
    expect(pending.metrics.pendingRemappedFraction).toBeGreaterThan(0.7);
    expect(pending.migration.length).toBe(pending.metrics.pendingRemappedKeys);
    expect(pending.completion.completed).toBe(false);

    const cutover = transitionConsistentHashing(pending, { type: "cutover" });
    expect(cutover.pendingNodeIds).toBeNull();
    expect(cutover.metrics.remappedFraction).toBeGreaterThan(0.7);
    expect(cutover.lazyRefillKeys).toHaveLength(cutover.metrics.remappedKeys);
    expect(cutover.completion.completed).toBe(true);
  });

  it("localizes ring movement and virtual nodes improve interval variance", () => {
    let modulo = createConsistentHashingState("modulo-baseline");
    modulo = transitionConsistentHashing(modulo, { type: "set-key-count", count: 10_000 });
    modulo = transitionConsistentHashing(modulo, { type: "add-server", nodeId: "node-e" });

    let oneToken = createConsistentHashingState("one-token-ring");
    oneToken = transitionConsistentHashing(oneToken, { type: "set-key-count", count: 10_000 });
    const oneTokenVariance = oneToken.metrics.ownershipVariance;
    oneToken = transitionConsistentHashing(oneToken, { type: "add-server", nodeId: "node-e" });

    let vnodes = createConsistentHashingState("vnode-ring");
    vnodes = transitionConsistentHashing(vnodes, { type: "set-key-count", count: 10_000 });
    const vnodeVariance = vnodes.metrics.ownershipVariance;
    vnodes = transitionConsistentHashing(vnodes, { type: "add-server", nodeId: "node-e" });

    expect(oneToken.metrics.pendingRemappedFraction).toBeGreaterThan(0);
    expect(vnodes.metrics.pendingRemappedFraction).toBeGreaterThan(0);
    expect(oneToken.metrics.pendingRemappedFraction).toBeLessThan(modulo.metrics.pendingRemappedFraction);
    expect(vnodes.metrics.pendingRemappedFraction).toBeLessThan(modulo.metrics.pendingRemappedFraction);
    expect(vnodeVariance).toBeLessThan(oneTokenVariance);
  });

  it("pauses a durable rollout until deterministic copy and verification batches finish", () => {
    let state = createConsistentHashingState("node-failure-migration");
    state = transitionConsistentHashing(state, { type: "add-server", nodeId: "node-e" });
    state = transitionConsistentHashing(state, { type: "pause-rollout" });
    expect(() => transitionConsistentHashing(state, { type: "cutover" })).toThrow(ConsistentHashingValidationError);
    const pausedSnapshot = JSON.stringify(state);
    const pausedStep = transitionConsistentHashing(state, { type: "step" });
    expect(pausedStep.migration).toEqual(state.migration);
    expect(JSON.stringify(state)).toBe(pausedSnapshot);

    state = transitionConsistentHashing(state, { type: "resume-rollout" });
    expect(state.rolloutStatus).toBe("migrating");
    let guard = 0;
    while (state.rolloutStatus !== "ready") {
      state = transitionConsistentHashing(state, { type: "step" });
      guard += 1;
      if (guard > 100) throw new Error("durable migration did not become ready");
    }
    expect(state.metrics.migrationVerifiedKeys).toBe(state.migration.length);
    state = transitionConsistentHashing(state, { type: "cutover" });
    expect(state.rolloutStatus).toBe("stable");
    expect(state.currentRingVersion).toBe(2);
    expect(state.completion.completed).toBe(true);
  });

  it("shows celebrity-key traffic skew separately from ownership balance", () => {
    const state = createConsistentHashingState("celebrity-key");
    const hotPlacement = getKeyPlacement(state, "key-0");
    expect(hotPlacement?.primaryNodeId).toBe(state.metrics.hotNodeId);
    expect(state.metrics.hotKeyQps).toBe(4_000);
    expect(state.metrics.hotNodeQps).toBeGreaterThanOrEqual(state.metrics.hotKeyQps);
    expect(state.metrics.ownershipVariance).toBeLessThan(0.02);
  });

  it("supports 10,000 aggregated keys and reset returns the exact preset state", () => {
    const initial = createConsistentHashingState("vnode-ring");
    const expanded = transitionConsistentHashing(initial, { type: "add-10000-keys" });
    expect(expanded.keyCount).toBe(10_000);
    expect(expanded.assignments).toHaveLength(10_000);
    const reset = transitionConsistentHashing(expanded, { type: "reset" });
    expect(reset).toEqual(initial);
  });

  it("keeps ownership variance helper deterministic and stable", () => {
    const state = createConsistentHashingState("vnode-ring");
    const reversed = [...state.assignments].reverse();
    expect(calculateOwnershipVariance(state.assignments, ["node-a", "node-b", "node-c", "node-d"])).toBe(
      calculateOwnershipVariance(reversed, ["node-d", "node-c", "node-b", "node-a"]),
    );
  });

  it("rejects impossible or out-of-range actions", () => {
    const state = createConsistentHashingState("modulo-baseline");
    expect(() => transitionConsistentHashing(state, { type: "set-key-count", count: 0 })).toThrow(ConsistentHashingValidationError);
    expect(() => transitionConsistentHashing(state, { type: "set-vnode-count", count: 0 })).toThrow(ConsistentHashingValidationError);
    expect(() => transitionConsistentHashing(state, { type: "set-hot-key-rate", rate: 1.1 })).toThrow(ConsistentHashingValidationError);
    expect(() => transitionConsistentHashing(state, { type: "set-replication-factor", factor: 5 })).toThrow(ConsistentHashingValidationError);
    expect(() => transitionConsistentHashing(state, { type: "add-server", nodeId: "node-a" })).toThrow(ConsistentHashingValidationError);
    expect(() => transitionConsistentHashing(state, { type: "remove-server", nodeId: "missing" })).toThrow(ConsistentHashingValidationError);
    expect(() => transitionConsistentHashing(state, { type: "cutover" })).toThrow(ConsistentHashingValidationError);
  });
});
