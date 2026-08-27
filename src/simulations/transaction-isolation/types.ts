import type {
  SimulationEvent,
  SimulationMetric,
  SimulationPreset,
} from "@/simulations/types";

export const TRANSACTION_ISOLATION_LEVELS = [
  "read-uncommitted",
  "read-committed",
  "repeatable-read",
  "serializable",
] as const;

export type TransactionIsolationLevel = (typeof TRANSACTION_ISOLATION_LEVELS)[number];

export const TRANSACTION_PROTECTION_MODES = [
  "none",
  "row-lock",
  "predicate-lock",
  "unique-constraint",
] as const;

export type TransactionProtectionMode = (typeof TRANSACTION_PROTECTION_MODES)[number];

export const TRANSACTION_ISOLATION_PRESET_IDS = [
  "dirty-read",
  "non-repeatable-read",
  "phantom-insert",
  "doctor-write-skew",
  "seat-uniqueness",
] as const;

export type TransactionIsolationPresetId = (typeof TRANSACTION_ISOLATION_PRESET_IDS)[number];

export const TRANSACTION_IDS = ["T1", "T2"] as const;
export type TransactionId = (typeof TRANSACTION_IDS)[number];

export type IsolationValue = string | number | boolean | null;

export type TransactionOperationKind = "read" | "write" | "commit" | "abort";
export type TransactionReadKind = "row" | "predicate";
export type TransactionWriteMode = "update" | "insert" | "delete";
export type TransactionStatus = "active" | "waiting" | "committed" | "aborted";

export interface IsolationRow {
  id: string;
  label: string;
  value: IsolationValue;
  version: number;
  tags: string[];
}

export interface IsolationVersion {
  id: string;
  rowId: string;
  transactionId: TransactionId | "seed";
  value: IsolationValue;
  version: number;
  status: "uncommitted" | "committed" | "aborted";
  present: boolean;
  tags: string[];
  operationId: string;
  createdTick: number;
}

export interface TransactionOperation {
  id: string;
  kind: TransactionOperationKind;
  target?: string;
  readKind?: TransactionReadKind;
  predicate?: string;
  value?: IsolationValue;
  writeMode?: TransactionWriteMode;
  tags?: string[];
  guard?: string;
  description: string;
}

export interface TransactionReadObservation {
  operationId: string;
  target: string;
  readKind: TransactionReadKind;
  predicate?: string;
  value: IsolationValue;
  rowIds: string[];
  version: number | null;
  visibility: "committed" | "uncommitted" | "snapshot" | "missing";
  observedBy: TransactionId;
  sourceTransactionId: TransactionId | "seed" | null;
  anomaly: "none" | "dirty-read" | "non-repeatable-read" | "phantom";
  tick: number;
}

export interface TransactionWriteRecord {
  operationId: string;
  target: string;
  value: IsolationValue;
  writeMode: TransactionWriteMode;
  versionId: string | null;
  status: "pending" | "committed" | "aborted" | "rejected";
  reason: string | null;
  tick: number;
}

export interface TransactionState {
  id: TransactionId;
  label: string;
  status: TransactionStatus;
  operations: TransactionOperation[];
  cursor: number;
  snapshotVersion: number | null;
  statementSnapshotVersion: number | null;
  reads: TransactionReadObservation[];
  writes: TransactionWriteRecord[];
  waitingFor: string | null;
  lastAction: string;
}

export type LockResourceKind = "row" | "predicate" | "unique";

export interface TransactionLock {
  id: string;
  owner: TransactionId;
  kind: LockResourceKind;
  resource: string;
  mode: "read" | "write" | "constraint";
  acquiredTick: number;
}

export interface TransactionWait {
  id: string;
  transactionId: TransactionId;
  blockedBy: TransactionId;
  resource: string;
  reason: string;
  startedTick: number;
  resolved: boolean;
  resolvedTick: number | null;
}

export interface IsolationInvariant {
  id: string;
  name: string;
  status: "pending" | "preserved" | "violated";
  holds: boolean;
  detail: string;
}

export interface TransactionIsolationProgress {
  started: boolean;
  outcomeObserved: boolean;
  replayed: boolean;
  completed: boolean;
}

export interface TransactionIsolationState {
  schemaVersion: 1;
  presetId: TransactionIsolationPresetId;
  isolation: TransactionIsolationLevel;
  protection: TransactionProtectionMode;
  tick: number;
  committedVersion: number;
  nextVersion: number;
  schedule: TransactionId[];
  scheduleCursor: number;
  rows: IsolationRow[];
  transactions: TransactionState[];
  versions: IsolationVersion[];
  locks: TransactionLock[];
  waits: TransactionWait[];
  events: SimulationEvent[];
  retryCount: number;
  progress: TransactionIsolationProgress;
}

export type TransactionIsolationAction =
  | { type: "step" }
  | { type: "read"; transactionId: TransactionId }
  | { type: "write"; transactionId: TransactionId }
  | { type: "commit"; transactionId: TransactionId }
  | { type: "abort"; transactionId: TransactionId; reason?: string }
  | { type: "replay" }
  | { type: "set-isolation"; isolation: TransactionIsolationLevel }
  | { type: "set-protection"; protection: TransactionProtectionMode }
  | { type: "reset" };

export interface TransactionIsolationMetrics {
  tick: number;
  isolation: TransactionIsolationLevel;
  protection: TransactionProtectionMode;
  committedVersion: number;
  snapshots: Array<{ transactionId: TransactionId; version: number | null }>;
  activeTransactions: number;
  committedTransactions: number;
  abortedTransactions: number;
  pendingVersions: number;
  committedVersions: number;
  dirtyReads: number;
  nonRepeatableReads: number;
  phantomReads: number;
  writeSkew: number;
  constraintViolations: number;
  waits: number;
  activeWaits: number;
  aborts: number;
  retries: number;
  invariant: IsolationInvariant;
  completed: boolean;
  latestEvent: SimulationEvent | null;
}

export interface TransactionIsolationTransition {
  state: TransactionIsolationState;
  events: SimulationEvent[];
  metrics: TransactionIsolationMetrics;
}

export interface TransactionIsolationPresetDefinition
  extends SimulationPreset<TransactionIsolationPresetId> {
  defaultIsolation: TransactionIsolationLevel;
  defaultProtection: TransactionProtectionMode;
  rows: IsolationRow[];
  transactions: Array<Pick<TransactionState, "id" | "label" | "operations">>;
  schedule: TransactionId[];
  invariant: Pick<IsolationInvariant, "id" | "name">;
}

/** Human-readable labels are exported so controls and text alternatives use one vocabulary. */
export const TRANSACTION_ISOLATION_LEVEL_LABELS: Record<TransactionIsolationLevel, string> = {
  "read-uncommitted": "Read uncommitted",
  "read-committed": "Read committed",
  "repeatable-read": "Repeatable read / snapshot",
  serializable: "Serializable",
};

export const TRANSACTION_PROTECTION_LABELS: Record<TransactionProtectionMode, string> = {
  none: "No explicit protection",
  "row-lock": "Row locks",
  "predicate-lock": "Predicate locks",
  "unique-constraint": "Unique constraint",
};

export class TransactionIsolationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransactionIsolationValidationError";
  }
}

export type TransactionIsolationSimulationMetric = SimulationMetric;
