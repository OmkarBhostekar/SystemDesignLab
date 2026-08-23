import type { SimulationEvent, SimulationEventTone } from "@/simulations/types";

import { getTransactionIsolationPreset } from "./presets";
import {
  TRANSACTION_ISOLATION_LEVELS,
  TRANSACTION_ISOLATION_PRESET_IDS,
  TRANSACTION_PROTECTION_MODES,
  type IsolationInvariant,
  type IsolationValue,
  type IsolationVersion,
  type LockResourceKind,
  type TransactionId,
  type TransactionIsolationAction,
  type TransactionIsolationLevel,
  type TransactionIsolationMetrics,
  type TransactionIsolationState,
  type TransactionIsolationTransition,
  type TransactionIsolationPresetId,
  type TransactionOperation,
  type TransactionProtectionMode,
  type TransactionReadObservation,
  type TransactionState,
  type TransactionStatus,
  type TransactionWriteRecord,
  TransactionIsolationValidationError,
} from "./types";

const MAX_EVENTS = 64;

interface TransitionContext {
  state: TransactionIsolationState;
  events: SimulationEvent[];
}

interface AttemptResult {
  status: "applied" | "waited" | "ignored";
}

interface VisibleRow {
  rowId: string;
  value: IsolationValue;
  version: number | null;
  tags: string[];
  present: boolean;
  visibility: "committed" | "uncommitted" | "snapshot" | "missing";
  sourceTransactionId: TransactionId | "seed" | null;
}

const ISOLATION_LEVEL_SET = new Set<string>(TRANSACTION_ISOLATION_LEVELS);
const PROTECTION_MODE_SET = new Set<string>(TRANSACTION_PROTECTION_MODES);
const TRANSACTION_ID_SET = new Set<string>(["T1", "T2"]);

export function createTransactionIsolationState(
  presetId: TransactionIsolationPresetId,
): TransactionIsolationState {
  const preset = getTransactionIsolationPreset(presetId);
  const rows = preset.rows.map((sourceRow) => ({
    ...sourceRow,
    tags: [...sourceRow.tags],
  }));
  const versions: IsolationVersion[] = rows.map((sourceRow) => ({
    id: `seed-${sourceRow.id}`,
    rowId: sourceRow.id,
    transactionId: "seed",
    value: sourceRow.value,
    version: sourceRow.version,
    status: "committed",
    present: true,
    tags: [...sourceRow.tags],
    operationId: "seed",
    createdTick: 0,
  }));
  return {
    schemaVersion: 1,
    presetId: preset.id,
    isolation: preset.defaultIsolation,
    protection: preset.defaultProtection,
    tick: 0,
    committedVersion: rows.length > 0 ? Math.max(...rows.map((sourceRow) => sourceRow.version)) : 0,
    nextVersion: rows.length > 0 ? Math.max(...rows.map((sourceRow) => sourceRow.version)) + 1 : 1,
    schedule: [...preset.schedule],
    scheduleCursor: 0,
    rows,
    transactions: preset.transactions.map((sourceTransaction) => ({
      id: sourceTransaction.id,
      label: sourceTransaction.label,
      status: "active",
      operations: sourceTransaction.operations.map(cloneOperation),
      cursor: 0,
      snapshotVersion: null,
      statementSnapshotVersion: null,
      reads: [],
      writes: [],
      waitingFor: null,
      lastAction: "Ready",
    })),
    versions,
    locks: [],
    waits: [],
    events: [],
    retryCount: 0,
    progress: {
      started: false,
      outcomeObserved: false,
      replayed: false,
      completed: false,
    },
  };
}

export function transactionIsolationMetrics(
  state: TransactionIsolationState,
): TransactionIsolationMetrics {
  assertTransactionIsolationState(state);
  const observations = state.transactions.flatMap((transaction) => transaction.reads);
  const dirtyReads = observations.filter((observation) => observation.anomaly === "dirty-read").length;
  const nonRepeatableReads = observations.filter((observation) => observation.anomaly === "non-repeatable-read").length;
  const phantomReads = observations.filter((observation) => observation.anomaly === "phantom").length;
  const constraintViolations = state.events.filter((event) => event.type === "constraint-violation").length;
  const writeSkew = state.presetId === "doctor-write-skew" && doctorCoverage(state) < 1 ? 1 : 0;
  const invariant = deriveInvariant(state, dirtyReads, nonRepeatableReads, phantomReads);
  return {
    tick: state.tick,
    isolation: state.isolation,
    protection: state.protection,
    committedVersion: state.committedVersion,
    snapshots: state.transactions.map((transaction) => ({
      transactionId: transaction.id,
      version: transaction.snapshotVersion,
    })),
    activeTransactions: state.transactions.filter((transaction) => transaction.status === "active" || transaction.status === "waiting").length,
    committedTransactions: state.transactions.filter((transaction) => transaction.status === "committed").length,
    abortedTransactions: state.transactions.filter((transaction) => transaction.status === "aborted").length,
    pendingVersions: state.versions.filter((version) => version.status === "uncommitted").length,
    committedVersions: state.versions.filter((version) => version.status === "committed").length,
    dirtyReads,
    nonRepeatableReads,
    phantomReads,
    writeSkew,
    constraintViolations,
    waits: state.waits.length,
    activeWaits: state.waits.filter((wait) => !wait.resolved).length,
    aborts: state.events.filter((event) => event.type === "transaction-aborted"
      || event.type === "transaction-abort"
      || event.type === "serialization-failure"
      || event.type === "constraint-violation").length,
    retries: state.retryCount,
    invariant,
    completed: state.progress.completed,
    latestEvent: state.events.at(-1) ?? null,
  };
}

export function transitionTransactionIsolation(
  input: TransactionIsolationState,
  action: TransactionIsolationAction,
): TransactionIsolationTransition {
  assertTransactionIsolationState(input);
  const state = cloneState(input);
  validateAction(action);

  if (action.type === "reset") {
    const reset = createTransactionIsolationState(state.presetId);
    return { state: reset, events: [], metrics: transactionIsolationMetrics(reset) };
  }

  if (action.type === "set-isolation") {
    const reset = createTransactionIsolationState(state.presetId);
    reset.isolation = action.isolation;
    emit(reset, "control-changed", "Isolation changed", `New transactions use ${isolationLabel(action.isolation)}.`, "info");
    return { state: reset, events: reset.events.slice(), metrics: transactionIsolationMetrics(reset) };
  }

  if (action.type === "set-protection") {
    const reset = createTransactionIsolationState(state.presetId);
    reset.protection = action.protection;
    emit(reset, "control-changed", "Protection changed", `The schedule now uses ${protectionLabel(action.protection)}.`, "info");
    return { state: reset, events: reset.events.slice(), metrics: transactionIsolationMetrics(reset) };
  }

  const context: TransitionContext = { state, events: [] };
  const previousEventCount = state.events.length;
  state.tick += 1;

  switch (action.type) {
    case "step":
      stepState(context);
      break;
    case "read":
    case "write":
    case "commit":
      runExplicitOperation(context, action.transactionId, action.type);
      break;
    case "abort":
      abortTransaction(context, action.transactionId, action.reason ?? "Manual abort requested.", "manual");
      break;
    case "replay":
      replayState(context);
      break;
    default:
      assertNever(action);
  }

  const nextState = context.state;
  updateProgress(nextState);
  const newEvents = context.events.length > 0 ? context.events : nextState.events.slice(previousEventCount);
  nextState.events = nextState.events.slice(-MAX_EVENTS);
  return {
    state: nextState,
    events: newEvents,
    metrics: transactionIsolationMetrics(nextState),
  };
}

function stepState(context: TransitionContext): void {
  const { state } = context;
  state.progress.started = true;
  const scheduleStart = state.scheduleCursor;

  for (let index = scheduleStart; index < state.schedule.length; index += 1) {
    const transactionId = state.schedule[index];
    const transaction = getTransaction(state, transactionId);
    state.scheduleCursor = index + 1;
    if (isTerminal(transaction.status)) continue;
    const result = attemptNextOperation(context, transaction);
    if (result.status === "waited") continue;
    return;
  }

  const fallback = state.transactions.find((transaction) => !isTerminal(transaction.status));
  if (fallback) {
    const result = attemptNextOperation(context, fallback);
    if (result.status === "waited") {
      emit(
        context.state,
        "scheduler-wait",
        "Scheduler is waiting",
        `${fallback.id} is waiting for ${fallback.waitingFor ?? "another transaction"}.`,
        "warning",
      );
    }
    return;
  }

  emit(state, "schedule-complete", "Schedule complete", "Both transaction lanes reached a terminal outcome.", "success");
}

function runExplicitOperation(
  context: TransitionContext,
  transactionId: TransactionId,
  requestedKind: "read" | "write" | "commit",
): void {
  const transaction = getTransaction(context.state, transactionId);
  if (isTerminal(transaction.status)) {
    emit(context.state, "operation-ignored", `${transactionId} is complete`, "Replay the scenario to run this lane again.", "warning");
    return;
  }
  const operation = transaction.operations[transaction.cursor];
  if (!operation || operation.kind !== requestedKind) {
    emit(
      context.state,
      "operation-ignored",
      `${transactionId} is waiting on its next operation`,
      operation ? `Next operation is ${operation.kind}; use Step or the matching control.` : "The lane has no operation left.",
      "warning",
    );
    return;
  }
  context.state.progress.started = true;
  attemptNextOperation(context, transaction);
}

function attemptNextOperation(context: TransitionContext, transaction: TransactionState): AttemptResult {
  const operation = transaction.operations[transaction.cursor];
  if (!operation || isTerminal(transaction.status)) return { status: "ignored" };
  if (transaction.status === "waiting") transaction.status = "active";

  switch (operation.kind) {
    case "read": {
      const result = executeRead(context, transaction, operation);
      if (result.status === "applied") transaction.cursor += 1;
      return result;
    }
    case "write": {
      const result = executeWrite(context, transaction, operation);
      if (result.status === "applied") transaction.cursor += 1;
      return result;
    }
    case "commit": {
      const result = executeCommit(context, transaction, operation);
      if (result.status === "applied" && transaction.status !== "aborted") transaction.cursor += 1;
      return result;
    }
    case "abort":
      abortTransaction(context, transaction.id, operation.description, operation.id);
      return { status: "applied" };
    default:
      return assertNever(operation.kind);
  }
}

function executeRead(
  context: TransitionContext,
  transaction: TransactionState,
  operation: TransactionOperation,
): AttemptResult {
  const { state } = context;
  if (!operation.target || !operation.readKind) {
    throw new TransactionIsolationValidationError(`Read operation ${operation.id} is missing a target or kind.`);
  }

  const resources = operation.readKind === "row"
    ? [{ kind: "row" as const, resource: rowResource(operation.target), mode: "read" as const }]
    : predicateReadResources(state, transaction, operation);
  const blocked = acquireResources(context, transaction, resources);
  if (blocked) return { status: "waited" };

  // A blocked statement obtains its snapshot when it actually runs, not when
  // it first requests a lock. This is what lets a row/predicate lock turn a
  // stale check into a fresh check after the owner commits.
  if (state.isolation === "repeatable-read" || state.isolation === "serializable") {
    transaction.snapshotVersion ??= state.committedVersion;
  }
  transaction.statementSnapshotVersion = state.committedVersion;

  const observation = operation.readKind === "row"
    ? readRowObservation(state, transaction, operation)
    : readPredicateObservation(state, transaction, operation);
  transaction.reads.push(observation);
  transaction.lastAction = `Read ${operation.target}`;
  emit(
    state,
    observation.anomaly === "none" ? "read" : observation.anomaly,
    `${transaction.id} read ${operation.target}`,
    readDetail(observation),
    observation.anomaly === "none" ? "info" : "failure",
  );
  return { status: "applied" };
}

function executeWrite(
  context: TransitionContext,
  transaction: TransactionState,
  operation: TransactionOperation,
): AttemptResult {
  const { state } = context;
  if (!operation.target || operation.value === undefined || !operation.writeMode) {
    throw new TransactionIsolationValidationError(`Write operation ${operation.id} is missing a target, value, or mode.`);
  }

  const resources = writeResources(state, transaction, operation);
  const blocked = acquireResources(context, transaction, resources);
  if (blocked) return { status: "waited" };

  if (state.protection === "unique-constraint" && isDuplicateUniqueWrite(state, transaction, operation)) {
    const writeRecord = createWriteRecord(operation, null, "rejected", "The unique constraint already owns this key.", state.tick);
    transaction.writes.push(writeRecord);
    abortTransaction(context, transaction.id, "Unique constraint rejected the duplicate key.", operation.id, "constraint-violation");
    return { status: "applied" };
  }

  if (operation.guard && !guardAllowsWrite(state, transaction, operation.guard, operation.target)) {
    transaction.writes.push(createWriteRecord(operation, null, "rejected", "The predicate guard no longer holds.", state.tick));
    transaction.lastAction = `Skipped ${operation.target}`;
    emit(
      state,
      "guard-failed",
      `${transaction.id} kept the invariant safe`,
      `The ${operation.guard} check failed after waiting; ${transaction.id} did not apply ${operation.target}.`,
      "success",
    );
    return { status: "applied" };
  }

  const versionNumber = state.nextVersion;
  state.nextVersion += 1;
  const version: IsolationVersion = {
    id: `v${versionNumber}-${operation.target}-${transaction.id}`,
    rowId: operation.target,
    transactionId: transaction.id,
    value: operation.value,
    version: versionNumber,
    status: "uncommitted",
    present: operation.writeMode !== "delete",
    tags: [...(operation.tags ?? rowTags(state, operation.target))],
    operationId: operation.id,
    createdTick: state.tick,
  };
  state.versions.push(version);
  transaction.writes.push(createWriteRecord(operation, version.id, "pending", null, state.tick));
  transaction.lastAction = `Wrote ${operation.target} (uncommitted)`;
  emit(
    state,
    "write",
    `${transaction.id} wrote ${operation.target}`,
    `${formatValue(operation.value)} is visible to ${transaction.id} only until commit (version ${versionNumber}).`,
    "warning",
  );
  return { status: "applied" };
}

function executeCommit(
  context: TransitionContext,
  transaction: TransactionState,
  operation: TransactionOperation,
): AttemptResult {
  const { state } = context;
  if (state.isolation === "serializable") {
    const conflict = findSerializableConflict(state, transaction);
    if (conflict) {
      abortTransaction(
        context,
        transaction.id,
        `Serialization failure: ${conflict.detail}`,
        operation.id,
        "serialization-failure",
      );
      return { status: "applied" };
    }
  }

  const ownVersions = state.versions.filter(
    (version) => version.transactionId === transaction.id && version.status === "uncommitted",
  );
  for (const version of ownVersions) {
    version.status = "committed";
    state.committedVersion = Math.max(state.committedVersion, version.version);
    const row = state.rows.find((candidate) => candidate.id === version.rowId);
    if (version.present) {
      if (row) {
        row.value = version.value;
        row.version = version.version;
        row.tags = [...version.tags];
      } else {
        state.rows.push({
          id: version.rowId,
          label: rowLabel(version.rowId),
          value: version.value,
          version: version.version,
          tags: [...version.tags],
        });
      }
    } else if (row) {
      state.rows.splice(state.rows.indexOf(row), 1);
    }
  }
  transaction.writes = transaction.writes.map((writeRecord) =>
    writeRecord.status === "pending" ? { ...writeRecord, status: "committed" } : writeRecord,
  );
  transaction.status = "committed";
  transaction.lastAction = "Committed";
  emit(
    state,
    "commit",
    `${transaction.id} committed`,
    ownVersions.length > 0
      ? `${ownVersions.length} version${ownVersions.length === 1 ? "" : "s"} became committed state.`
      : "No writes were pending; the transaction is now complete.",
    "success",
  );
  releaseLocks(state, transaction.id);
  resolveWaits(state, transaction.id);
  return { status: "applied" };
}

function abortTransaction(
  context: TransitionContext,
  transactionId: TransactionId,
  reason: string,
  operationId: string,
  eventType: "transaction-aborted" | "constraint-violation" | "serialization-failure" = "transaction-aborted",
): void {
  const { state } = context;
  const transaction = getTransaction(state, transactionId);
  if (isTerminal(transaction.status)) return;
  for (const version of state.versions) {
    if (version.transactionId === transactionId && version.status === "uncommitted") version.status = "aborted";
  }
  transaction.writes = transaction.writes.map((writeRecord) =>
    writeRecord.status === "pending" ? { ...writeRecord, status: "aborted", reason } : writeRecord,
  );
  transaction.status = "aborted";
  transaction.cursor = transaction.operations.length;
  transaction.waitingFor = null;
  transaction.lastAction = "Aborted";
  releaseLocks(state, transactionId);
  resolveWaits(state, transactionId);
  const title = eventType === "constraint-violation"
    ? `${transactionId} hit a unique constraint`
    : eventType === "serialization-failure"
      ? `${transactionId} aborted for serialization`
      : `${transactionId} aborted`;
  emit(state, eventType, title, reason, "failure");
  if (operationId === "manual") {
    emit(state, "manual-abort", "Manual abort applied", `${transactionId} was stopped before publishing its versions.`, "warning");
  }
}

function replayState(context: TransitionContext): void {
  const { state } = context;
  const retryCount = state.retryCount + 1;
  const replay = createTransactionIsolationState(state.presetId);
  replay.isolation = state.isolation;
  replay.protection = state.protection;
  replay.retryCount = retryCount;
  replay.progress.replayed = true;
  replay.progress.started = true;
  context.state = replay;
  context.events = [];
  emit(replay, "replay", "Logical transaction replayed", `Retry ${retryCount} starts the complete two-transaction schedule again.`, "info");
  context.events = replay.events.slice();
}

function acquireResources(
  context: TransitionContext,
  transaction: TransactionState,
  resources: Array<{ kind: LockResourceKind; resource: string; mode: "read" | "write" | "constraint" }>,
): boolean {
  const { state } = context;
  for (const resource of resources) {
    const existing = state.locks.find((lock) => lock.resource === resource.resource && lock.owner !== transaction.id);
    if (!existing) continue;
    const owner = getTransaction(state, existing.owner);
    if (isTerminal(owner.status)) {
      state.locks = state.locks.filter((lock) => lock.id !== existing.id);
      continue;
    }
    waitFor(context, transaction, owner.id, resource.resource, lockReason(resource.kind));
    return true;
  }
  for (const resource of resources) {
    if (state.locks.some((lock) => lock.owner === transaction.id && lock.resource === resource.resource)) continue;
    state.locks.push({
      id: `lock-${transaction.id}-${resource.kind}-${resource.resource}`,
      owner: transaction.id,
      kind: resource.kind,
      resource: resource.resource,
      mode: resource.mode,
      acquiredTick: state.tick,
    });
  }
  clearWaitFor(state, transaction.id);
  return false;
}

function waitFor(
  context: TransitionContext,
  transaction: TransactionState,
  blockedBy: TransactionId,
  resource: string,
  reason: string,
): void {
  const { state } = context;
  transaction.status = "waiting";
  transaction.waitingFor = resource;
  const existing = state.waits.find(
    (wait) => wait.transactionId === transaction.id && wait.resource === resource && !wait.resolved,
  );
  if (existing) {
    emit(state, "wait", `${transaction.id} still waits`, `${transaction.id} waits for ${blockedBy} to release ${resource}.`, "warning");
    return;
  }
  state.waits.push({
    id: `wait-${state.tick}-${transaction.id}-${resource}`,
    transactionId: transaction.id,
    blockedBy,
    resource,
    reason,
    startedTick: state.tick,
    resolved: false,
    resolvedTick: null,
  });
  emit(state, "wait", `${transaction.id} is waiting`, `${transaction.id} waits for ${blockedBy} to release ${resource}.`, "warning");
}

function resolveWaits(state: TransactionIsolationState, releasedBy: TransactionId): void {
  const releasedResources = new Set(
    state.waits
      .filter((wait) => wait.blockedBy === releasedBy && !wait.resolved)
      .map((wait) => wait.resource),
  );
  for (const wait of state.waits) {
    if (wait.blockedBy !== releasedBy || wait.resolved) continue;
    if (releasedResources.has(wait.resource)) {
      wait.resolved = true;
      wait.resolvedTick = state.tick;
      const transaction = getTransaction(state, wait.transactionId);
      if (transaction.status === "waiting") {
        transaction.status = "active";
        transaction.waitingFor = null;
      }
    }
  }
}

function clearWaitFor(state: TransactionIsolationState, transactionId: TransactionId): void {
  const transaction = getTransaction(state, transactionId);
  transaction.waitingFor = null;
  if (transaction.status === "waiting") transaction.status = "active";
}

function releaseLocks(state: TransactionIsolationState, transactionId: TransactionId): void {
  state.locks = state.locks.filter((lock) => lock.owner !== transactionId);
}

function readRowObservation(
  state: TransactionIsolationState,
  transaction: TransactionState,
  operation: TransactionOperation,
): TransactionReadObservation {
  const target = operation.target ?? "unknown";
  const visible = visibleRow(state, transaction, target);
  const prior = transaction.reads.find((observation) => observation.target === target && observation.readKind === "row");
  const value = visible.present ? visible.value : null;
  const anomaly = visible.visibility === "uncommitted" && visible.sourceTransactionId !== transaction.id
    ? "dirty-read"
    : prior && prior.value !== value
      ? "non-repeatable-read"
      : "none";
  return {
    operationId: operation.id,
    target,
    readKind: "row",
    value,
    rowIds: visible.present ? [target] : [],
    version: visible.version,
    visibility: visible.visibility,
    observedBy: transaction.id,
    sourceTransactionId: visible.sourceTransactionId,
    anomaly,
    tick: state.tick,
  };
}

function readPredicateObservation(
  state: TransactionIsolationState,
  transaction: TransactionState,
  operation: TransactionOperation,
): TransactionReadObservation {
  const predicate = operation.predicate ?? operation.target ?? "unknown";
  const visible = visiblePredicateRows(state, transaction, predicate);
  const rowIds = visible.filter((candidate) => candidate.present).map((candidate) => candidate.rowId).sort();
  const prior = transaction.reads.find((observation) => observation.predicate === predicate);
  const changed = prior && !sameIds(prior.rowIds, rowIds);
  const dirty = visible.some(
    (candidate) => candidate.visibility === "uncommitted" && candidate.sourceTransactionId !== transaction.id,
  );
  const anomaly = dirty ? "dirty-read" : changed ? "phantom" : "none";
  const source = visible.find((candidate) => candidate.present && candidate.sourceTransactionId)?.sourceTransactionId ?? null;
  const version = visible.length > 0
    ? Math.max(...visible.map((candidate) => candidate.version ?? 0)) || null
    : null;
  return {
    operationId: operation.id,
    target: operation.target ?? predicate,
    readKind: "predicate",
    predicate,
    value: rowIds.length,
    rowIds,
    version,
    visibility: dirty ? "uncommitted" : state.isolation === "repeatable-read" || state.isolation === "serializable" ? "snapshot" : "committed",
    observedBy: transaction.id,
    sourceTransactionId: source,
    anomaly,
    tick: state.tick,
  };
}

function visibleRow(
  state: TransactionIsolationState,
  transaction: TransactionState,
  rowId: string,
): VisibleRow {
  const candidates = state.versions
    .filter((version) => version.rowId === rowId && isVersionVisible(state, transaction, version))
    .sort((left, right) => right.version - left.version);
  const selected = candidates[0];
  if (!selected) {
    return {
      rowId,
      value: null,
      version: null,
      tags: [],
      present: false,
      visibility: "missing",
      sourceTransactionId: null,
    };
  }
  const snapshotVisibility = state.isolation === "repeatable-read" || state.isolation === "serializable";
  return {
    rowId,
    value: selected.value,
    version: selected.version,
    tags: [...selected.tags],
    present: selected.present,
    visibility: selected.status === "uncommitted" ? "uncommitted" : snapshotVisibility ? "snapshot" : "committed",
    sourceTransactionId: selected.transactionId,
  };
}

function visiblePredicateRows(
  state: TransactionIsolationState,
  transaction: TransactionState,
  predicate: string,
): VisibleRow[] {
  const rowIds = new Set<string>([
    ...state.rows.map((row) => row.id),
    ...state.versions.map((version) => version.rowId),
  ]);
  return [...rowIds]
    .map((rowId) => visibleRow(state, transaction, rowId))
    .filter((candidate) => matchesPredicate(state.presetId, predicate, candidate));
}

function isVersionVisible(
  state: TransactionIsolationState,
  transaction: TransactionState,
  version: IsolationVersion,
): boolean {
  if (version.status === "aborted") return false;
  if (version.transactionId === transaction.id && version.status === "uncommitted") return true;
  if (version.status !== "committed") return state.isolation === "read-uncommitted";
  if (state.isolation === "read-uncommitted" || state.isolation === "read-committed") return true;
  return version.version <= (transaction.snapshotVersion ?? state.committedVersion);
}

function predicateReadResources(
  state: TransactionIsolationState,
  transaction: TransactionState,
  operation: TransactionOperation,
): Array<{ kind: LockResourceKind; resource: string; mode: "read" }> {
  const predicate = operation.predicate ?? operation.target ?? "unknown";
  if (state.protection === "predicate-lock") {
    return [{ kind: "predicate", resource: predicateResource(predicate), mode: "read" }];
  }
  if (state.protection === "row-lock") {
    const rows = visiblePredicateRows(state, transaction, predicate).filter((candidate) => candidate.present);
    return rows.length > 0
      ? rows.map((candidate) => ({ kind: "row" as const, resource: rowResource(candidate.rowId), mode: "read" as const }))
      : [{ kind: "predicate", resource: predicateResource(predicate), mode: "read" }];
  }
  return [];
}

function writeResources(
  state: TransactionIsolationState,
  transaction: TransactionState,
  operation: TransactionOperation,
): Array<{ kind: LockResourceKind; resource: string; mode: "write" | "constraint" }> {
  const resources: Array<{ kind: LockResourceKind; resource: string; mode: "write" | "constraint" }> = [];
  if (state.protection === "row-lock") {
    resources.push({ kind: "row", resource: rowResource(operation.target ?? "unknown"), mode: "write" });
    const predicates = predicateIdsForTarget(state.presetId, operation.target ?? "unknown");
    if (predicates.some((predicate) => !visiblePredicateRows(state, transaction, predicate).some((candidate) => candidate.rowId === operation.target && candidate.present))) {
      for (const predicate of predicates) resources.push({ kind: "predicate", resource: predicateResource(predicate), mode: "write" });
    }
  }
  if (state.protection === "predicate-lock") {
    const predicates = predicateIdsForTarget(state.presetId, operation.target ?? "unknown");
    for (const predicate of predicates) resources.push({ kind: "predicate", resource: predicateResource(predicate), mode: "write" });
  }
  if (state.protection === "unique-constraint") {
    resources.push({ kind: "unique", resource: uniqueResource(operation.target ?? "unknown"), mode: "constraint" });
  }
  return resources;
}

function isDuplicateUniqueWrite(
  state: TransactionIsolationState,
  transaction: TransactionState,
  operation: TransactionOperation,
): boolean {
  if (operation.writeMode !== "insert") return false;
  const target = operation.target ?? "";
  return state.versions.some(
    (version) => version.rowId === target
      && version.transactionId !== transaction.id
      && version.status === "committed"
      && version.present,
  );
}

function guardAllowsWrite(
  state: TransactionIsolationState,
  transaction: TransactionState,
  guard: string,
  target?: string,
): boolean {
  if (guard === "doctor-coverage") {
    const count = visiblePredicateRows(state, transaction, "night-on-call").filter((candidate) => candidate.present).length;
    return count >= 2;
  }
  if (guard === "seat-free") {
    return target ? !visibleRow(state, transaction, target).present : false;
  }
  return true;
}

function findSerializableConflict(
  state: TransactionIsolationState,
  transaction: TransactionState,
): { detail: string } | null {
  const snapshot = transaction.snapshotVersion ?? state.committedVersion;
  const otherCommitted = state.versions.filter(
    (version) => version.status === "committed" && version.transactionId !== transaction.id && version.transactionId !== "seed" && version.version > snapshot,
  );
  for (const version of otherCommitted) {
    const rowRead = transaction.reads.some((read) => read.readKind === "row" && read.target === version.rowId);
    const predicateRead = transaction.reads.some(
      (read) => read.readKind === "predicate" && matchesPredicateVersion(
        state.presetId,
        read.predicate ?? read.target,
        version,
      ),
    );
    const wroteSameRow = transaction.writes.some((write) => write.target === version.rowId && write.status !== "rejected");
    if (rowRead || predicateRead || wroteSameRow) {
      return { detail: `${version.transactionId} committed version ${version.version} after ${transaction.id}'s snapshot.` };
    }
  }
  return null;
}

function deriveInvariant(
  state: TransactionIsolationState,
  dirtyReads: number,
  nonRepeatableReads: number,
  phantomReads: number,
): IsolationInvariant {
  const preset = getTransactionIsolationPreset(state.presetId);
  const terminal = state.transactions.every((transaction) => isTerminal(transaction.status));
  let holds = true;
  let detail = "Run both lanes to evaluate the invariant.";
  switch (state.presetId) {
    case "dirty-read":
      holds = dirtyReads === 0;
      detail = holds ? "No transaction has used an uncommitted balance." : "T2 used a value that T1 later rolled back.";
      break;
    case "non-repeatable-read":
      holds = nonRepeatableReads === 0;
      detail = holds ? "Repeated row reads returned the same value." : "The second statement saw a newer committed version.";
      break;
    case "phantom-insert":
      holds = phantomReads === 0;
      detail = holds ? "The repeated range returned the same row set." : "A committed insert appeared in the repeated predicate.";
      break;
    case "doctor-write-skew":
      holds = doctorCoverage(state) >= 1;
      detail = holds ? "At least one doctor remains on call." : "Both doctors committed off-call writes.";
      break;
    case "seat-uniqueness": {
      const reservations = state.versions.filter(
        (version) => version.rowId === "seat-42" && version.status === "committed" && version.present,
      ).length;
      holds = reservations <= 1;
      detail = holds ? "The seat has at most one committed reservation." : `${reservations} committed reservation versions claim seat 42.`;
      break;
    }
    default:
      return assertNever(state.presetId);
  }
  if (!terminal) {
    return { id: preset.invariant.id, name: preset.invariant.name, status: "pending", holds, detail };
  }
  return {
    id: preset.invariant.id,
    name: preset.invariant.name,
    status: holds ? "preserved" : "violated",
    holds,
    detail,
  };
}

function updateProgress(state: TransactionIsolationState): void {
  const outcomeObserved = state.transactions.every((transaction) => isTerminal(transaction.status));
  state.progress.outcomeObserved = outcomeObserved;
  state.progress.completed = outcomeObserved;
}

function matchesPredicate(
  presetId: TransactionIsolationState["presetId"],
  predicate: string,
  row: Pick<VisibleRow, "rowId" | "value" | "tags" | "present">,
): boolean {
  if (!row.present) return false;
  switch (predicate) {
    case "night-reservations":
      return row.tags.includes("night") && row.tags.includes("reservation");
    case "night-on-call":
      return row.tags.includes("night") && row.tags.includes("doctor") && row.value === true;
    case "seat-42-free":
      return row.rowId === "seat-42" && row.tags.includes("seat-42");
    default:
      return presetId === "seat-uniqueness" ? row.rowId === predicate : row.tags.includes(predicate);
  }
}

/**
 * A serialization dependency is about the predicate's range, not only about
 * the final value. A doctor row changed from true to false still belongs to
 * the `night-on-call` range and must conflict with a snapshot read of it.
 */
function matchesPredicateVersion(
  presetId: TransactionIsolationState["presetId"],
  predicate: string,
  version: IsolationVersion,
): boolean {
  if (!version.present) return false;
  if (predicate === "night-on-call") return version.tags.includes("night") && version.tags.includes("doctor");
  return matchesPredicate(presetId, predicate, {
    rowId: version.rowId,
    value: version.value,
    tags: version.tags,
    present: version.present,
  });
}

function predicateIdsForTarget(presetId: TransactionIsolationState["presetId"], target: string): string[] {
  switch (presetId) {
    case "phantom-insert":
      return target.startsWith("night-") ? ["night-reservations"] : [];
    case "doctor-write-skew":
      return target.startsWith("doctor-") ? ["night-on-call"] : [];
    case "seat-uniqueness":
      return target === "seat-42" ? ["seat-42-free"] : [];
    default:
      return [];
  }
}

function doctorCoverage(state: TransactionIsolationState): number {
  return state.rows.filter((row) => row.tags.includes("doctor") && row.tags.includes("night") && row.value === true).length;
}

function rowTags(state: TransactionIsolationState, rowId: string): string[] {
  return state.rows.find((row) => row.id === rowId)?.tags ?? [];
}

function rowLabel(rowId: string): string {
  return rowId === "seat-42" ? "Seat 42 reservation" : rowId;
}

function readDetail(observation: TransactionReadObservation): string {
  const value = observation.readKind === "predicate"
    ? `${observation.rowIds.length} matching row${observation.rowIds.length === 1 ? "" : "s"}`
    : `value ${formatValue(observation.value)}`;
  const version = observation.version === null ? "no visible version" : `version ${observation.version}`;
  const source = observation.sourceTransactionId ? ` from ${observation.sourceTransactionId}` : "";
  return `${value} (${observation.visibility}${source}, ${version}).`;
}

function createWriteRecord(
  operation: TransactionOperation,
  versionId: string | null,
  status: TransactionWriteRecord["status"],
  reason: string | null,
  tick: number,
): TransactionWriteRecord {
  return {
    operationId: operation.id,
    target: operation.target ?? "unknown",
    value: operation.value ?? null,
    writeMode: operation.writeMode ?? "update",
    versionId,
    status,
    reason,
    tick,
  };
}

function cloneOperation(operation: TransactionOperation): TransactionOperation {
  return { ...operation, tags: operation.tags ? [...operation.tags] : undefined };
}

function cloneState(state: TransactionIsolationState): TransactionIsolationState {
  return {
    ...state,
    schedule: [...state.schedule],
    rows: state.rows.map((row) => ({ ...row, tags: [...row.tags] })),
    transactions: state.transactions.map((transaction) => ({
      ...transaction,
      operations: transaction.operations.map(cloneOperation),
      reads: transaction.reads.map((read) => ({ ...read, rowIds: [...read.rowIds] })),
      writes: transaction.writes.map((write) => ({ ...write })),
    })),
    versions: state.versions.map((version) => ({ ...version, tags: [...version.tags] })),
    locks: state.locks.map((lock) => ({ ...lock })),
    waits: state.waits.map((wait) => ({ ...wait })),
    events: state.events.map((event) => ({ ...event })),
    progress: { ...state.progress },
  };
}

function validateAction(action: TransactionIsolationAction): void {
  if (!action || typeof action !== "object" || typeof action.type !== "string") {
    throw new TransactionIsolationValidationError("Transaction-isolation action must contain a type.");
  }
  if (action.type === "set-isolation" && !ISOLATION_LEVEL_SET.has(action.isolation)) {
    throw new TransactionIsolationValidationError(`Unknown isolation level: ${String(action.isolation)}.`);
  }
  if (action.type === "set-protection" && !PROTECTION_MODE_SET.has(action.protection)) {
    throw new TransactionIsolationValidationError(`Unknown protection mode: ${String(action.protection)}.`);
  }
  if ((action.type === "read" || action.type === "write" || action.type === "commit" || action.type === "abort")
    && !TRANSACTION_ID_SET.has(action.transactionId)) {
    throw new TransactionIsolationValidationError(`Unknown transaction lane: ${String(action.transactionId)}.`);
  }
}

function assertTransactionIsolationState(state: TransactionIsolationState): void {
  if (!state || state.schemaVersion !== 1) {
    throw new TransactionIsolationValidationError("Transaction-isolation state has an unsupported schema version.");
  }
  if (!TRANSACTION_ISOLATION_PRESET_IDS.includes(state.presetId)) {
    throw new TransactionIsolationValidationError(`Unknown transaction-isolation preset: ${String(state.presetId)}.`);
  }
  if (!ISOLATION_LEVEL_SET.has(state.isolation) || !PROTECTION_MODE_SET.has(state.protection)) {
    throw new TransactionIsolationValidationError("Transaction-isolation state has an invalid configuration.");
  }
  if (state.transactions.length !== 2) {
    throw new TransactionIsolationValidationError("Transaction-isolation state must contain exactly two lanes.");
  }
}

function emit(
  state: TransactionIsolationState,
  type: string,
  title: string,
  detail: string,
  tone: SimulationEventTone,
): void {
  state.events.push({
    id: `event-${state.tick}-${state.events.length + 1}`,
    tick: state.tick,
    type,
    title,
    detail,
    tone,
  });
}

function getTransaction(state: TransactionIsolationState, transactionId: TransactionId): TransactionState {
  const transaction = state.transactions.find((candidate) => candidate.id === transactionId);
  if (!transaction) throw new TransactionIsolationValidationError(`Unknown transaction lane: ${transactionId}.`);
  return transaction;
}

function isTerminal(status: TransactionStatus): boolean {
  return status === "committed" || status === "aborted";
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function rowResource(rowId: string): string {
  return `row:${rowId}`;
}

function predicateResource(predicate: string): string {
  return `predicate:${predicate}`;
}

function uniqueResource(rowId: string): string {
  return `unique:${rowId}`;
}

function lockReason(kind: LockResourceKind): string {
  switch (kind) {
    case "row":
      return "row lock";
    case "predicate":
      return "predicate lock";
    case "unique":
      return "unique constraint check";
    default:
      return assertNever(kind);
  }
}

export function isolationLabel(level: TransactionIsolationLevel): string {
  switch (level) {
    case "read-uncommitted":
      return "Read uncommitted";
    case "read-committed":
      return "Read committed";
    case "repeatable-read":
      return "Repeatable read / snapshot";
    case "serializable":
      return "Serializable";
    default:
      return assertNever(level);
  }
}

export function protectionLabel(mode: TransactionProtectionMode): string {
  switch (mode) {
    case "none":
      return "No explicit protection";
    case "row-lock":
      return "Row locks";
    case "predicate-lock":
      return "Predicate locks";
    case "unique-constraint":
      return "Unique constraint";
    default:
      return assertNever(mode);
  }
}

export function formatValue(value: IsolationValue): string {
  if (value === null) return "∅";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function assertNever(value: never): never {
  throw new TransactionIsolationValidationError(`Unexpected transaction-isolation value: ${String(value)}.`);
}
