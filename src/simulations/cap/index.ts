import type {
  SimulationEvent,
  SimulationEventTone,
  SimulationPreset,
} from "@/simulations/types";

/**
 * CAP is intentionally modelled as a per-operation choice made while a
 * partition is in progress. The engine does not know about React, timers, or
 * random values; a state plus an action is enough to reproduce every frame.
 */

export const CAP_PRESET_IDS = ["inventory", "profile-edits", "like-counters"] as const;

export type CapPresetId = (typeof CAP_PRESET_IDS)[number];

export const CAP_POLICY_IDS = ["reject-writes", "route-to-owner", "accept-both"] as const;

export type CapPolicy = (typeof CAP_POLICY_IDS)[number];

export const CAP_SIDE_IDS = ["left", "right"] as const;

export type CapSide = (typeof CAP_SIDE_IDS)[number];

export const CAP_REPLICA_IDS = ["replica-a", "replica-b", "replica-c"] as const;

export type CapReplicaId = (typeof CAP_REPLICA_IDS)[number];

export type CapValue = number | string;
export type CapValueKind = "inventory" | "profile" | "counter";
export type CapMergeStrategy = "inventory-safe" | "last-write-wins" | "counter-sum";

export interface CapPresetDefinition extends SimulationPreset<CapPresetId> {
  key: string;
  valueKind: CapValueKind;
  initialValue: CapValue;
  leftWrite: CapValue;
  rightWrite: CapValue;
  writeLabel: string;
  readLabel: string;
  invariant: string;
  mergeStrategy: CapMergeStrategy;
}

export type CapReplicaStatus = "healthy";

export interface CapReplica {
  id: CapReplicaId;
  label: string;
  side: CapSide;
  status: CapReplicaStatus;
  value: CapValue;
  version: number;
  lastOperationId: string | null;
}

export type CapOperationKind = "read" | "write";
export type CapOperationStatus = "acknowledged" | "rejected" | "stale";

export interface CapOperation {
  id: string;
  sequence: number;
  tick: number;
  partitionEpoch: number;
  kind: CapOperationKind;
  side: CapSide;
  replicaId: CapReplicaId;
  requestedValue: CapValue | null;
  delta: number | null;
  observedValue: CapValue | null;
  status: CapOperationStatus;
  acknowledged: boolean;
  available: boolean;
  stale: boolean;
  linearizabilityViolation: boolean;
  targetReplicaIds: CapReplicaId[];
  targetReplicaId: CapReplicaId | null;
  detail: string;
}

export interface CapProgress {
  partitionObserved: boolean;
  policyObserved: boolean;
  readObserved: boolean;
  writeObserved: boolean;
  healingObserved: boolean;
  repairObserved: boolean;
  completed: boolean;
}

export interface CapState {
  schemaVersion: 1;
  presetId: CapPresetId;
  key: string;
  valueKind: CapValueKind;
  mergeStrategy: CapMergeStrategy;
  initialValue: CapValue;
  policy: CapPolicy;
  ownerReplicaId: CapReplicaId;
  partitioned: boolean;
  partitionEpoch: number;
  partitionStartedTick: number | null;
  tick: number;
  nextOperationNumber: number;
  nextEventNumber: number;
  replicas: CapReplica[];
  operations: CapOperation[];
  events: SimulationEvent[];
  pendingRepair: boolean;
  repairCount: number;
  resolvedConflictEpochs: number[];
  progress: CapProgress;
}

export type CapAction =
  | { type: "step" }
  | { type: "partition" }
  | { type: "heal" }
  | { type: "set-policy"; policy: CapPolicy | string }
  | { type: "read"; side: CapSide | string }
  | { type: "write"; side: CapSide | string; value?: CapValue; delta?: number }
  | { type: "repair" }
  | { type: "reset" };

export interface CapSideMetrics {
  side: CapSide;
  value: CapValue;
  replicaIds: CapReplicaId[];
  acknowledgedWrites: number;
  rejectedWrites: number;
  reads: number;
  staleReads: number;
  available: boolean;
}

export interface CapMetrics {
  tick: number;
  partitioned: boolean;
  partitionDurationTicks: number;
  policy: CapPolicy;
  ownerReplicaId: CapReplicaId;
  acknowledgedOperations: number;
  acknowledgedOperationCount: number;
  acknowledgedWrites: number;
  rejectedWrites: number;
  totalWrites: number;
  totalReads: number;
  availableReads: number;
  availableWrites: number;
  writeAvailability: number;
  readAvailability: number;
  userVisibleAvailability: number;
  availability: number;
  staleReads: number;
  conflictCount: number;
  conflictsResolved: number;
  linearizabilityViolations: number;
  linearizabilityViolationCount: number;
  repairPending: number;
  repairPendingReplicas: number;
  converged: boolean;
  valuesAgree: boolean;
  leftValue: CapValue;
  rightValue: CapValue;
  canonicalValue: CapValue;
  lastAcknowledgedValue: CapValue | null;
  sideMetrics: Record<CapSide, CapSideMetrics>;
}

export interface CapTransition {
  state: CapState;
  events: SimulationEvent[];
  metrics: CapMetrics;
}

export class CapValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapValidationError";
  }
}

const LEFT_REPLICA_ID: CapReplicaId = "replica-a";
const MAX_OPERATIONS = 64;
const MAX_EVENTS = 64;
const MAX_RESOLVED_CONFLICT_EPOCHS = 64;

export const CAP_PRESETS: readonly CapPresetDefinition[] = [
  {
    id: "inventory",
    label: "Last-ticket inventory",
    description: "One remaining ticket exposes why two acknowledged reservations cannot both be true.",
    key: "concert-ticket",
    valueKind: "inventory",
    initialValue: 1,
    leftWrite: 0,
    rightWrite: 0,
    writeLabel: "Reserve ticket",
    readLabel: "Read stock",
    invariant: "At most one reservation may consume the last ticket.",
    mergeStrategy: "inventory-safe",
  },
  {
    id: "profile-edits",
    label: "Profile edits",
    description: "Concurrent text edits can both be acknowledged, but one value still needs a merge decision.",
    key: "profile.displayName",
    valueKind: "profile",
    initialValue: "Ari",
    leftWrite: "Ari (mobile)",
    rightWrite: "Ari (web)",
    writeLabel: "Save profile edit",
    readLabel: "Read profile",
    invariant: "A profile has one visible value after repair; losing an edit must be explicit.",
    mergeStrategy: "last-write-wins",
  },
  {
    id: "like-counters",
    label: "Like counter",
    description: "Independent increments can remain available on both sides and merge without a write conflict.",
    key: "post.likes",
    valueKind: "counter",
    initialValue: 0,
    leftWrite: 1,
    rightWrite: 1,
    writeLabel: "Add like",
    readLabel: "Read likes",
    invariant: "Each acknowledged like contributes once to the final count.",
    mergeStrategy: "counter-sum",
  },
] as const;

export const capPresets = CAP_PRESETS;

const PRESETS_BY_ID = new Map(CAP_PRESETS.map((preset) => [preset.id, preset]));

const POLICY_LABELS: Record<CapPolicy, string> = {
  "reject-writes": "Reject writes during partition",
  "route-to-owner": "Route writes to one owner",
  "accept-both": "Accept writes on both sides",
};

export function getCapPreset(presetId: CapPresetId): CapPresetDefinition {
  const preset = PRESETS_BY_ID.get(presetId);
  if (!preset) throw new CapValidationError(`Unknown CAP preset: ${String(presetId)}.`);
  return clonePreset(preset);
}

export function createCapState(presetId: CapPresetId): CapState {
  const preset = getCapPreset(presetId);
  return {
    schemaVersion: 1,
    presetId: preset.id,
    key: preset.key,
    valueKind: preset.valueKind,
    mergeStrategy: preset.mergeStrategy,
    initialValue: cloneValue(preset.initialValue),
    policy: "reject-writes",
    ownerReplicaId: "replica-b",
    partitioned: false,
    partitionEpoch: 0,
    partitionStartedTick: null,
    tick: 0,
    nextOperationNumber: 1,
    nextEventNumber: 1,
    replicas: [
      { id: "replica-a", label: "Replica A", side: "left", status: "healthy", value: cloneValue(preset.initialValue), version: 1, lastOperationId: null },
      { id: "replica-b", label: "Replica B", side: "right", status: "healthy", value: cloneValue(preset.initialValue), version: 1, lastOperationId: null },
      { id: "replica-c", label: "Replica C", side: "right", status: "healthy", value: cloneValue(preset.initialValue), version: 1, lastOperationId: null },
    ],
    operations: [],
    events: [],
    pendingRepair: false,
    repairCount: 0,
    resolvedConflictEpochs: [],
    progress: {
      partitionObserved: false,
      policyObserved: false,
      readObserved: false,
      writeObserved: false,
      healingObserved: false,
      repairObserved: false,
      completed: false,
    },
  };
}

export function capPolicyLabel(policy: CapPolicy): string {
  return POLICY_LABELS[policy];
}

export function transitionCap(state: CapState, action: CapAction): CapTransition {
  assertState(state);
  if (action.type === "reset") {
    const reset = createCapState(state.presetId);
    return { state: reset, events: [], metrics: capMetrics(reset) };
  }

  const next = cloneState(state);
  const emitted: SimulationEvent[] = [];
  next.tick += 1;

  switch (action.type) {
    case "step":
      step(next, emitted);
      break;
    case "partition":
      beginPartition(next, emitted);
      break;
    case "heal":
      healPartition(next, emitted);
      break;
    case "set-policy":
      setPolicy(next, action.policy, emitted);
      break;
    case "read":
      readFromSide(next, action.side, emitted);
      break;
    case "write":
      writeFromSide(next, action.side, action.value, action.delta, emitted);
      break;
    case "repair":
      repairReplicas(next, emitted);
      break;
    default:
      assertNever(action);
  }

  updateCompletion(next);
  next.events = [...next.events, ...emitted].slice(-MAX_EVENTS);
  return { state: next, events: emitted, metrics: capMetrics(next) };
}

export function capMetrics(state: CapState): CapMetrics {
  assertState(state);
  const operations = state.operations;
  const writes = operations.filter((operation) => operation.kind === "write");
  const reads = operations.filter((operation) => operation.kind === "read");
  const acknowledgedWrites = writes.filter((operation) => operation.acknowledged).length;
  const rejectedWrites = writes.filter((operation) => !operation.acknowledged).length;
  const availableReads = reads.filter((operation) => operation.available).length;
  const availableWrites = writes.filter((operation) => operation.available).length;
  const staleReads = reads.filter((operation) => operation.stale).length;
  const conflictCount = countConflicts(state);
  const linearizabilityViolations = countLinearizabilityViolations(state);
  const values = state.replicas.map((replica) => replica.value);
  const valuesAgree = values.every((value) => valuesEqual(value, values[0]));
  const repairPendingReplicas = valuesAgree ? 0 : countDivergentReplicas(state);
  const canonicalValue = canonicalValueFor(state);
  const sideMetrics = {
    left: sideMetricsFor(state, "left"),
    right: sideMetricsFor(state, "right"),
  } satisfies Record<CapSide, CapSideMetrics>;
  const writeAvailability = writes.length === 0 ? 1 : availableWrites / writes.length;
  const readAvailability = reads.length === 0 ? 1 : availableReads / reads.length;
  const totalOperations = operations.length;
  const userVisibleAvailability = totalOperations === 0
    ? 1
    : operations.filter((operation) => operation.available).length / totalOperations;
  const converged = !state.partitioned && !state.pendingRepair && valuesAgree;
  const lastAcknowledged = [...writes].reverse().find((operation) => operation.acknowledged);

  return {
    tick: state.tick,
    partitioned: state.partitioned,
    partitionDurationTicks: state.partitioned && state.partitionStartedTick !== null
      ? Math.max(0, state.tick - state.partitionStartedTick)
      : 0,
    policy: state.policy,
    ownerReplicaId: state.ownerReplicaId,
    acknowledgedOperations: operations.filter((operation) => operation.acknowledged).length,
    acknowledgedOperationCount: operations.filter((operation) => operation.acknowledged).length,
    acknowledgedWrites,
    rejectedWrites,
    totalWrites: writes.length,
    totalReads: reads.length,
    availableReads,
    availableWrites,
    writeAvailability,
    readAvailability,
    userVisibleAvailability,
    availability: userVisibleAvailability,
    staleReads,
    conflictCount,
    conflictsResolved: state.resolvedConflictEpochs.length,
    linearizabilityViolations,
    linearizabilityViolationCount: linearizabilityViolations,
    // Divergence is already a repair obligation while the partition is open;
    // `pendingRepair` on state only gates the repair control until healing.
    repairPending: repairPendingReplicas,
    repairPendingReplicas,
    converged,
    valuesAgree,
    leftValue: sideMetrics.left.value,
    rightValue: sideMetrics.right.value,
    canonicalValue,
    lastAcknowledgedValue: lastAcknowledged?.requestedValue ?? null,
    sideMetrics,
  };
}

export const calculateCapMetrics = capMetrics;
export const getCapMetrics = capMetrics;

function beginPartition(state: CapState, emitted: SimulationEvent[]): void {
  if (state.partitioned) throw new CapValidationError("The replicas are already partitioned.");
  state.partitioned = true;
  state.partitionEpoch += 1;
  state.partitionStartedTick = state.tick;
  state.pendingRepair = false;
  state.progress.partitionObserved = true;
  emit(
    state,
    emitted,
    "partition-started",
    "Network partition started",
    "Replica A can no longer communicate with replicas B and C. Reads remain local; write policy now decides the trade-off.",
    "warning",
  );
}

function healPartition(state: CapState, emitted: SimulationEvent[]): void {
  if (!state.partitioned) throw new CapValidationError("The replica network is already healed.");
  state.partitioned = false;
  state.partitionStartedTick = null;
  state.pendingRepair = !replicasConverged(state);
  state.progress.healingObserved = true;
  emit(
    state,
    emitted,
    "partition-healed",
    "Network healed",
    state.pendingRepair
      ? "Communication is back, but replicas still hold divergent values. Repair is visible and must be run explicitly."
      : "Communication is back and replicas already agree; no repair is pending.",
    state.pendingRepair ? "warning" : "success",
  );
}

function setPolicy(state: CapState, value: string, emitted: SimulationEvent[]): void {
  const policy = normalizePolicy(value);
  state.policy = policy;
  state.progress.policyObserved = true;
  emit(
    state,
    emitted,
    "policy-changed",
    "Partition policy changed",
    `${capPolicyLabel(policy)}. This is CP/AP behavior for the partition, not a permanent label for the service.`,
    "info",
  );
}

function readFromSide(state: CapState, sideValue: string, emitted: SimulationEvent[]): void {
  const side = normalizeSide(sideValue);
  const replica = firstReplicaForSide(state, side);
  const stale = isStaleRead(state, side, replica.value);
  const operation = addOperation(state, {
    kind: "read",
    side,
    replicaId: replica.id,
    requestedValue: null,
    delta: null,
    observedValue: cloneValue(replica.value),
    status: stale ? "stale" : "acknowledged",
    acknowledged: true,
    available: true,
    stale,
    linearizabilityViolation: stale,
    targetReplicaIds: [replica.id],
    targetReplicaId: null,
    detail: stale
      ? `${replica.label} returned ${formatValue(replica.value, state.valueKind)} while another side had a newer value.`
      : `${replica.label} returned ${formatValue(replica.value, state.valueKind)} from local state.`,
  });
  state.progress.readObserved = true;
  emit(
    state,
    emitted,
    stale ? "stale-read" : "read-served",
    stale ? "Stale read served" : "Read served",
    `${operation.side === "left" ? "Left" : "Right"} side read ${formatValue(replica.value, state.valueKind)}${stale ? "; this response cannot fit a single linearizable order." : "."}`,
    stale ? "warning" : "success",
  );
}

function writeFromSide(
  state: CapState,
  sideValue: string,
  requestedValue: CapValue | undefined,
  requestedDelta: number | undefined,
  emitted: SimulationEvent[],
): void {
  const side = normalizeSide(sideValue);
  const sourceReplica = firstReplicaForSide(state, side);
  const input = resolveWriteInput(state, sourceReplica, requestedValue, requestedDelta);
  const targetReplicaIds = writeTargets(state, side);
  const businessRejected = input.businessRejected;
  const acknowledged = targetReplicaIds.length > 0 && !businessRejected;
  const available = businessRejected ? true : targetReplicaIds.length > 0;
  const detail = !available
    ? routeRejectionDetail(state, side)
    : businessRejected
      ? input.rejectionDetail
      : acknowledgedWriteDetail(state, side, targetReplicaIds, input.value);

  const operation = addOperation(state, {
    kind: "write",
    side,
    replicaId: sourceReplica.id,
    requestedValue: acknowledged ? cloneValue(input.value) : null,
    delta: input.delta,
    observedValue: acknowledged ? cloneValue(input.value) : cloneValue(sourceReplica.value),
    status: acknowledged ? "acknowledged" : "rejected",
    acknowledged,
    available,
    stale: false,
    linearizabilityViolation: false,
    targetReplicaIds,
    targetReplicaId: state.policy === "route-to-owner" ? state.ownerReplicaId : null,
    detail,
  });

  state.progress.writeObserved = true;
  if (acknowledged) {
    applyWrite(state, targetReplicaIds, input.value, operation.id);
    emit(state, emitted, "write-acknowledged", "Write acknowledged", detail, "success");
    if (state.partitioned && state.valueKind !== "counter" && operationIntroducesConflict(state, operation)) {
      const currentOperation = state.operations.find((candidate) => candidate.id === operation.id);
      if (currentOperation) currentOperation.linearizabilityViolation = true;
      emit(
        state,
        emitted,
        "conflict-detected",
        "Concurrent conflict detected",
        "Both sides acknowledged incompatible values while partitioned; no single linearizable order can explain both commits.",
        "failure",
      );
    }
  } else {
    emit(state, emitted, "write-rejected", "Write rejected", detail, "failure");
  }
}

function repairReplicas(state: CapState, emitted: SimulationEvent[]): void {
  if (state.partitioned) throw new CapValidationError("Repair requires the network partition to be healed first.");
  const before = state.replicas.map((replica) => replica.value);
  const mergedValue = mergeValue(state);
  const resolvedConflictEpochs = [...state.resolvedConflictEpochs];
  for (const epoch of conflictEpochs(state)) {
    if (!resolvedConflictEpochs.includes(epoch)) resolvedConflictEpochs.push(epoch);
  }
  state.resolvedConflictEpochs = resolvedConflictEpochs.slice(-MAX_RESOLVED_CONFLICT_EPOCHS);
  const changed = before.some((value) => !valuesEqual(value, mergedValue));
  const latestOperationId = latestAcknowledgedWrite(state)?.id ?? null;
  for (const replica of state.replicas) {
    replica.value = cloneValue(mergedValue);
    replica.version += changed ? 1 : 0;
    replica.lastOperationId = latestOperationId;
  }
  state.pendingRepair = false;
  state.repairCount += changed || state.operations.length > 0 ? 1 : 0;
  state.progress.repairObserved = true;
  emit(
    state,
    emitted,
    "repair-started",
    "Repair started",
    state.mergeStrategy === "counter-sum"
      ? "Unique acknowledged increments are merged once per operation."
      : "A deterministic application merge resolves divergent side values; inspect the conflict before accepting the result.",
    "info",
  );
  emit(
    state,
    emitted,
    "repair-completed",
    "Replicas converged",
    changed
      ? `All three replicas now expose ${formatValue(mergedValue, state.valueKind)}.`
      : "All three replicas already exposed the same value.",
    "success",
  );
}

function step(state: CapState, emitted: SimulationEvent[]): void {
  if (state.partitioned) {
    const divergent = !replicasConverged(state);
    emit(
      state,
      emitted,
      "partition-observed",
      "Partition remains in effect",
      divergent
        ? "Messages between the two sides are delayed; local reads can now become stale and local writes can diverge."
        : "Messages between the two sides are delayed; no divergent write has been acknowledged yet.",
      divergent ? "warning" : "info",
    );
    return;
  }
  if (state.pendingRepair) {
    emit(
      state,
      emitted,
      "repair-pending",
      "Repair is pending",
      "The network is healthy, but replicas do not converge until the merge/repair action runs.",
      "warning",
    );
    return;
  }
  emit(state, emitted, "steady-state", "Replicas agree", "All three replicas currently expose one converged value.", "success");
}

function writeTargets(state: CapState, side: CapSide): CapReplicaId[] {
  if (!state.partitioned) {
    // A single owner decides the order, then normal replication fans the
    // committed value out to every reachable replica. Only the partitioned
    // branch below sacrifices the remote side.
    return state.replicas.map((replica) => replica.id);
  }
  if (state.policy === "reject-writes") return [];
  if (state.policy === "route-to-owner") {
    return sideOfReplica(state.ownerReplicaId) === side ? [state.ownerReplicaId] : [];
  }
  return state.replicas.filter((replica) => replica.side === side).map((replica) => replica.id);
}

function applyWrite(state: CapState, targetReplicaIds: readonly CapReplicaId[], value: CapValue, operationId: string): void {
  for (const replica of state.replicas) {
    if (!targetReplicaIds.includes(replica.id)) continue;
    replica.value = cloneValue(value);
    replica.version += 1;
    replica.lastOperationId = operationId;
  }
  state.pendingRepair = !state.partitioned && !replicasConverged(state);
}

interface ResolvedWriteInput {
  value: CapValue;
  delta: number | null;
  businessRejected: boolean;
  rejectionDetail: string;
}

function resolveWriteInput(
  state: CapState,
  sourceReplica: CapReplica,
  requestedValue: CapValue | undefined,
  requestedDelta: number | undefined,
): ResolvedWriteInput {
  if (state.valueKind === "profile") {
    if (typeof requestedValue !== "string" || requestedValue.trim().length === 0) {
      throw new CapValidationError("Profile edits require a non-empty text value.");
    }
    return { value: requestedValue.trim(), delta: null, businessRejected: false, rejectionDetail: "" };
  }
  const delta = requestedDelta ?? (state.valueKind === "counter" ? 1 : -1);
  if (!Number.isFinite(delta) || !Number.isInteger(delta)) throw new CapValidationError("A write delta must be a finite integer.");
  const current = typeof sourceReplica.value === "number" ? sourceReplica.value : Number(sourceReplica.value);
  const nextValue = requestedValue === undefined ? current + delta : requestedValue;
  if (typeof nextValue !== "number" || !Number.isFinite(nextValue) || !Number.isInteger(nextValue)) {
    throw new CapValidationError("Inventory and counter writes must resolve to an integer value.");
  }
  if (state.valueKind === "inventory" && nextValue < 0) {
    return {
      value: current,
      delta,
      businessRejected: true,
      rejectionDetail: "The local side has no ticket left to reserve; the invariant rejects this write.",
    };
  }
  if (state.valueKind === "counter" && nextValue < 0) {
    return {
      value: current,
      delta,
      businessRejected: true,
      rejectionDetail: "The counter cannot become negative; the application rejected this write.",
    };
  }
  return { value: nextValue, delta, businessRejected: false, rejectionDetail: "" };
}

function mergeValue(state: CapState): CapValue {
  switch (state.mergeStrategy) {
    case "counter-sum": {
      const deltaTotal = state.operations
        .filter((operation) => operation.kind === "write" && operation.acknowledged)
        .reduce((sum, operation) => sum + (operation.delta ?? 0), 0);
      return Number(state.initialValue) + deltaTotal;
    }
    case "inventory-safe": {
      const values = state.replicas.map((replica) => Number(replica.value));
      return Math.max(0, Math.min(...values));
    }
    case "last-write-wins": {
      return cloneValue(latestAcknowledgedWrite(state)?.requestedValue ?? state.initialValue);
    }
    default:
      return assertNever(state.mergeStrategy);
  }
}

function isStaleRead(state: CapState, side: CapSide, value: CapValue): boolean {
  if (state.replicas.every((replica) => valuesEqual(replica.value, value))) return false;
  const latestOtherWrite = [...state.operations]
    .reverse()
    .find((operation) => operation.kind === "write" && operation.acknowledged && operation.side !== side);
  return latestOtherWrite !== undefined && latestOtherWrite.requestedValue !== null && !valuesEqual(latestOtherWrite.requestedValue, value);
}

function countConflicts(state: CapState): number {
  return conflictEpochs(state).filter((epoch) => !state.resolvedConflictEpochs.includes(epoch)).length;
}

function conflictEpochs(state: CapState): number[] {
  if (state.valueKind === "counter") return [];
  const groups = new Set<number>();
  for (const operation of state.operations) {
    if (operation.kind !== "write" || !operation.acknowledged || operation.partitionEpoch === 0) continue;
    const opposite = state.operations.some(
      (other) => operationsConflict(operation, other),
    );
    if (opposite) groups.add(operation.partitionEpoch);
  }
  return [...groups];
}

function countLinearizabilityViolations(state: CapState): number {
  const staleReads = state.operations.filter((operation) => operation.kind === "read" && operation.linearizabilityViolation).length;
  return conflictEpochs(state).length + staleReads;
}

function operationIntroducesConflict(state: CapState, operation: CapOperation): boolean {
  return state.operations.some((other) => other.id !== operation.id && operationsConflict(operation, other));
}

function operationsConflict(left: CapOperation, right: CapOperation): boolean {
  return left.kind === "write"
    && right.kind === "write"
    && left.acknowledged
    && right.acknowledged
    && left.partitionEpoch > 0
    && left.partitionEpoch === right.partitionEpoch
    && left.side !== right.side
    && left.requestedValue !== null
    && right.requestedValue !== null
    && !valuesEqual(left.requestedValue, right.requestedValue);
}

function sideMetricsFor(state: CapState, side: CapSide): CapSideMetrics {
  const replicas = state.replicas.filter((replica) => replica.side === side);
  const operations = state.operations.filter((operation) => operation.side === side);
  const writes = operations.filter((operation) => operation.kind === "write");
  const reads = operations.filter((operation) => operation.kind === "read");
  return {
    side,
    value: cloneValue(replicas[0]?.value ?? state.initialValue),
    replicaIds: replicas.map((replica) => replica.id),
    acknowledgedWrites: writes.filter((operation) => operation.acknowledged).length,
    rejectedWrites: writes.filter((operation) => !operation.acknowledged).length,
    reads: reads.length,
    staleReads: reads.filter((operation) => operation.stale).length,
    available: state.partitioned ? side === "left" || side === "right" : true,
  };
}

function canonicalValueFor(state: CapState): CapValue {
  const owner = state.replicas.find((replica) => replica.id === state.ownerReplicaId);
  return cloneValue(owner?.value ?? state.initialValue);
}

function latestAcknowledgedWrite(state: CapState): CapOperation | undefined {
  return [...state.operations].reverse().find((operation) => operation.kind === "write" && operation.acknowledged);
}

function countDivergentReplicas(state: CapState): number {
  const canonical = canonicalValueFor(state);
  return state.replicas.filter((replica) => !valuesEqual(replica.value, canonical)).length;
}

function replicasConverged(state: CapState): boolean {
  const first = state.replicas[0]?.value;
  return state.replicas.every((replica) => valuesEqual(replica.value, first));
}

function addOperation(
  state: CapState,
  operation: Omit<CapOperation, "id" | "sequence" | "tick" | "partitionEpoch">,
): CapOperation {
  const id = `op-${state.nextOperationNumber}`;
  state.nextOperationNumber += 1;
  const next: CapOperation = {
    ...operation,
    id,
    sequence: state.nextOperationNumber - 1,
    tick: state.tick,
    partitionEpoch: state.partitionEpoch,
    targetReplicaIds: [...operation.targetReplicaIds],
  };
  state.operations = [...state.operations, next].slice(-MAX_OPERATIONS);
  return next;
}

function emit(
  state: CapState,
  emitted: SimulationEvent[],
  type: string,
  title: string,
  detail: string,
  tone: SimulationEventTone,
): void {
  const event: SimulationEvent = {
    id: `event-${state.nextEventNumber}-${type}`,
    tick: state.tick,
    type,
    title,
    detail,
    tone,
  };
  state.nextEventNumber += 1;
  emitted.push(event);
}

function updateCompletion(state: CapState): void {
  const metrics = capMetricsWithoutValidation(state);
  state.progress.completed = state.progress.partitionObserved
    && state.progress.policyObserved
    && state.progress.readObserved
    && state.progress.writeObserved
    && state.progress.healingObserved
    && state.progress.repairObserved
    && metrics.converged;
}

function capMetricsWithoutValidation(state: CapState): CapMetrics {
  // capMetrics performs validation, while completion is updated before events
  // are attached. Keeping this small indirection makes that ordering obvious.
  return capMetrics(state);
}

function routeRejectionDetail(state: CapState, side: CapSide): string {
  if (state.policy === "reject-writes") {
    return "The CP-like policy rejects partition-time writes so no side can commit an order it cannot coordinate.";
  }
  if (state.policy === "route-to-owner") {
    return `The write was routed to ${state.ownerReplicaId}, but the ${side} side cannot reach that owner during the partition.`;
  }
  return "No healthy replica accepted this write.";
}

function acknowledgedWriteDetail(state: CapState, side: CapSide, targets: readonly CapReplicaId[], value: CapValue): string {
  if (!state.partitioned) return `The write committed at ${targets.join(", ")} and replicated to every reachable replica.`;
  if (state.policy === "route-to-owner") return `The ${side} side reached ${state.ownerReplicaId}; the owner acknowledged ${formatValue(value, state.valueKind)}.`;
  return `The AP-like policy acknowledged ${formatValue(value, state.valueKind)} locally on the ${side} side; replication messages are delayed.`;
}

function firstReplicaForSide(state: CapState, side: CapSide): CapReplica {
  const replica = state.replicas.find((candidate) => candidate.side === side);
  if (!replica) throw new CapValidationError(`No replica is available on the ${side} side.`);
  return replica;
}

function sideOfReplica(replicaId: CapReplicaId): CapSide {
  return replicaId === LEFT_REPLICA_ID ? "left" : "right";
}

function normalizePolicy(value: string): CapPolicy {
  const aliases: Record<string, CapPolicy> = {
    reject: "reject-writes",
    "reject-writes": "reject-writes",
    "route-owner": "route-to-owner",
    "route-to-owner": "route-to-owner",
    "route-one-owner": "route-to-owner",
    accept: "accept-both",
    "accept-both": "accept-both",
    "accept-both-writes": "accept-both",
  };
  const policy = aliases[value];
  if (!policy) throw new CapValidationError(`Unknown CAP policy: ${String(value)}.`);
  return policy;
}

function normalizeSide(value: string): CapSide {
  if (value === "left" || value === "right") return value;
  throw new CapValidationError(`Unknown replica side: ${String(value)}.`);
}

function assertState(state: CapState): void {
  if (state.schemaVersion !== 1) throw new CapValidationError("Unsupported CAP simulation state version.");
  if (!PRESETS_BY_ID.has(state.presetId)) throw new CapValidationError(`Unknown CAP preset in state: ${String(state.presetId)}.`);
  if (state.replicas.length !== 3) throw new CapValidationError("CAP simulation requires exactly three replicas.");
  if (state.replicas.some((replica) => !CAP_REPLICA_IDS.includes(replica.id))) throw new CapValidationError("CAP state contains an unknown replica.");
  normalizePolicy(state.policy);
}

function cloneState(state: CapState): CapState {
  return {
    ...state,
    initialValue: cloneValue(state.initialValue),
    replicas: state.replicas.map((replica) => ({ ...replica, value: cloneValue(replica.value) })),
    operations: state.operations.map((operation) => ({
      ...operation,
      requestedValue: cloneOptionalValue(operation.requestedValue),
      observedValue: cloneOptionalValue(operation.observedValue),
      targetReplicaIds: [...operation.targetReplicaIds],
    })),
    events: state.events.map((event) => ({ ...event })),
    resolvedConflictEpochs: [...state.resolvedConflictEpochs],
    progress: { ...state.progress },
  };
}

function clonePreset(preset: CapPresetDefinition): CapPresetDefinition {
  return {
    ...preset,
    initialValue: cloneValue(preset.initialValue),
    leftWrite: cloneValue(preset.leftWrite),
    rightWrite: cloneValue(preset.rightWrite),
  };
}

function cloneValue(value: CapValue): CapValue {
  return typeof value === "string" ? value : Number(value);
}

function cloneOptionalValue(value: CapValue | null): CapValue | null {
  return value === null ? null : cloneValue(value);
}

function valuesEqual(left: CapValue | null, right: CapValue | null): boolean {
  return left === right;
}

function formatValue(value: CapValue, kind: CapValueKind): string {
  if (kind === "inventory") return `${value} ticket${value === 1 ? "" : "s"} remaining`;
  if (kind === "counter") return `${value} like${value === 1 ? "" : "s"}`;
  return `“${String(value)}”`;
}

function assertNever(value: never): never {
  throw new CapValidationError(`Unhandled CAP value: ${String(value)}`);
}
