import { describe, expect, it } from "vitest";

import {
  TRANSACTION_ISOLATION_PRESET_IDS,
  createTransactionIsolationState,
  transactionIsolationMetrics,
  transitionTransactionIsolation,
  type TransactionIsolationAction,
  type TransactionIsolationState,
} from "@/simulations/transaction-isolation";

function apply(state: TransactionIsolationState, action: TransactionIsolationAction): TransactionIsolationState {
  return transitionTransactionIsolation(state, action).state;
}

function run(state: TransactionIsolationState, limit = 80): TransactionIsolationState {
  let next = state;
  for (let index = 0; index < limit && !next.progress.completed; index += 1) next = apply(next, { type: "step" });
  return next;
}

describe("transaction-isolation engine", () => {
  it("creates deterministic serializable states for every authored anomaly", () => {
    for (const presetId of TRANSACTION_ISOLATION_PRESET_IDS) {
      const first = createTransactionIsolationState(presetId);
      const second = createTransactionIsolationState(presetId);
      expect(first).toEqual(second);
      expect(JSON.parse(JSON.stringify(first))).toEqual(first);
      expect(first.transactions.map((transaction) => transaction.id)).toEqual(["T1", "T2"]);
    }
  });

  it("exposes a dirty read at read uncommitted and prevents it at read committed", () => {
    const weak = run(createTransactionIsolationState("dirty-read"));
    expect(transactionIsolationMetrics(weak).dirtyReads).toBe(1);
    expect(transactionIsolationMetrics(weak).invariant.status).toBe("violated");

    let strong = apply(createTransactionIsolationState("dirty-read"), {
      type: "set-isolation",
      isolation: "read-committed",
    });
    strong = run(strong);
    expect(transactionIsolationMetrics(strong).dirtyReads).toBe(0);
    expect(transactionIsolationMetrics(strong).invariant.status).toBe("preserved");
  });

  it("distinguishes statement snapshots from a repeatable transaction snapshot", () => {
    const committed = run(createTransactionIsolationState("non-repeatable-read"));
    expect(transactionIsolationMetrics(committed).nonRepeatableReads).toBe(1);

    let repeatable = apply(createTransactionIsolationState("non-repeatable-read"), {
      type: "set-isolation",
      isolation: "repeatable-read",
    });
    repeatable = run(repeatable);
    expect(transactionIsolationMetrics(repeatable).nonRepeatableReads).toBe(0);
    expect(repeatable.transactions[0]?.snapshotVersion).toBe(1);
  });

  it("prevents a phantom with a stable snapshot or predicate lock", () => {
    const weak = run(createTransactionIsolationState("phantom-insert"));
    expect(transactionIsolationMetrics(weak).phantomReads).toBe(1);

    let locked = apply(createTransactionIsolationState("phantom-insert"), {
      type: "set-protection",
      protection: "predicate-lock",
    });
    locked = run(locked);
    const lockedMetrics = transactionIsolationMetrics(locked);
    expect(lockedMetrics.phantomReads).toBe(0);
    expect(lockedMetrics.waits).toBeGreaterThan(0);
    expect(lockedMetrics.invariant.status).toBe("preserved");
  });

  it("shows doctor write skew under snapshot isolation and aborts a conflicting serializable commit", () => {
    const snapshot = run(createTransactionIsolationState("doctor-write-skew"));
    expect(transactionIsolationMetrics(snapshot).writeSkew).toBe(1);
    expect(transactionIsolationMetrics(snapshot).invariant.status).toBe("violated");

    let serializable = apply(createTransactionIsolationState("doctor-write-skew"), {
      type: "set-isolation",
      isolation: "serializable",
    });
    serializable = run(serializable);
    const metrics = transactionIsolationMetrics(serializable);
    expect(metrics.aborts).toBeGreaterThan(0);
    expect(metrics.invariant.status).toBe("preserved");
    expect(serializable.transactions.some((transaction) => transaction.status === "aborted")).toBe(true);
  });

  it("uses a unique constraint to reject a duplicate seat after waiting", () => {
    let state = apply(createTransactionIsolationState("seat-uniqueness"), {
      type: "set-protection",
      protection: "unique-constraint",
    });
    state = run(state);
    const metrics = transactionIsolationMetrics(state);
    expect(metrics.waits).toBeGreaterThan(0);
    expect(metrics.constraintViolations).toBe(1);
    expect(metrics.aborts).toBe(1);
    expect(metrics.invariant.status).toBe("preserved");
    expect(state.versions.filter((version) => version.rowId === "seat-42" && version.status === "committed")).toHaveLength(1);
  });

  it("replays the complete logical transaction and increments retries", () => {
    const completed = run(createTransactionIsolationState("dirty-read"));
    const replay = transitionTransactionIsolation(completed, { type: "replay" });
    expect(replay.state.retryCount).toBe(1);
    expect(replay.state.progress.completed).toBe(false);
    expect(replay.state.transactions.every((transaction) => transaction.status === "active")).toBe(true);
    expect(replay.events[0]?.type).toBe("replay");
  });

  it("does not mutate input state and keeps event history bounded", () => {
    const initial = createTransactionIsolationState("dirty-read");
    const snapshot = structuredClone(initial);
    let state = initial;
    for (let index = 0; index < 90; index += 1) {
      state = apply(state, { type: "replay" });
      state = apply(state, { type: "step" });
    }
    expect(initial).toEqual(snapshot);
    expect(state.events.length).toBeLessThanOrEqual(64);
  });
});
