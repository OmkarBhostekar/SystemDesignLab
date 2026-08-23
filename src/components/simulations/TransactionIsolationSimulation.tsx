"use client";

import { useCallback, useMemo, useState, type Dispatch } from "react";

import {
  TRANSACTION_ISOLATION_LEVEL_LABELS,
  TRANSACTION_ISOLATION_LEVELS,
  TRANSACTION_ISOLATION_PRESETS,
  TRANSACTION_PROTECTION_LABELS,
  TRANSACTION_PROTECTION_MODES,
  createTransactionIsolationState,
  formatValue,
  isolationLabel,
  protectionLabel,
  transactionIsolationMetrics,
  transitionTransactionIsolation,
  type IsolationValue,
  type TransactionIsolationAction,
  type TransactionIsolationMetrics,
  type TransactionIsolationPresetId,
  type TransactionIsolationState,
  type TransactionProtectionMode,
  type TransactionState,
} from "@/simulations/transaction-isolation";
import type { SimulationEvent, SimulationMetric } from "@/simulations/types";

import { SimulationShell } from "./SimulationShell";
import type {
  SimulationCompletionFactory,
  SimulationRepository,
} from "./simulation-types";

export interface TransactionIsolationSimulationProps {
  lessonId?: string;
  repository?: SimulationRepository;
  completionFactory?: SimulationCompletionFactory;
}

export function TransactionIsolationSimulation({
  lessonId,
  repository,
  completionFactory,
}: TransactionIsolationSimulationProps) {
  const [presetId, setPresetId] = useState<TransactionIsolationPresetId>("dirty-read");
  const [state, setState] = useState<TransactionIsolationState>(() => createTransactionIsolationState("dirty-read"));
  const [error, setError] = useState<string | null>(null);
  const metrics = useMemo(() => transactionIsolationMetrics(state), [state]);

  const apply = useCallback((action: TransactionIsolationAction) => {
    try {
      const transition = transitionTransactionIsolation(state, action);
      setState(transition.state);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The transaction-isolation action could not be applied.");
    }
  }, [state]);

  const step = useCallback(() => apply({ type: "step" }), [apply]);
  const reset = useCallback(() => {
    setState(createTransactionIsolationState(presetId));
    setError(null);
  }, [presetId]);
  const selectPreset = useCallback((nextPresetId: string) => {
    if (!isTransactionIsolationPresetId(nextPresetId)) return;
    setPresetId(nextPresetId);
    setState(createTransactionIsolationState(nextPresetId));
    setError(null);
  }, []);

  return (
    <SimulationShell<TransactionIsolationState, TransactionIsolationAction>
      simulationId="transaction-isolation"
      lessonId={lessonId}
      title="Schedule two transactions"
      description="Step through reads, writes, commits, and aborts to see which snapshots and coordination primitives protect a named invariant."
      state={state}
      dispatch={apply}
      onStep={step}
      onReset={reset}
      onPresetChange={selectPreset}
      metrics={toSimulationMetrics(metrics)}
      events={state.events as readonly SimulationEvent[]}
      explanation={explanationFor(state, metrics)}
      summary={summaryFor(state, metrics)}
      presets={TRANSACTION_ISOLATION_PRESETS}
      presetId={presetId}
      isComplete={state.progress.completed}
      externalError={error}
      repository={repository}
      completionFactory={completionFactory}
      initialStatus={error ?? "Use Step to run the authored schedule, or operate either transaction lane directly."}
      controls={({ dispatch, announce }) => (
        <fieldset className="simulation-controls simulation-controls--transaction-isolation">
          <legend>Isolation and coordination controls</legend>
          <div className="simulation-control__selects">
            <label className="simulation-control">
              <span>Isolation level</span>
              <select
                aria-label="Isolation level"
                value={state.isolation}
                onChange={(event) => {
                  const isolation = event.target.value as TransactionIsolationState["isolation"];
                  dispatch({ type: "set-isolation", isolation });
                  announce(`${isolationLabel(isolation)} selected. The authored schedule was reset.`);
                }}
              >
                {TRANSACTION_ISOLATION_LEVELS.map((level) => (
                  <option key={level} value={level}>{TRANSACTION_ISOLATION_LEVEL_LABELS[level]}</option>
                ))}
              </select>
            </label>
            <label className="simulation-control">
              <span>Conflict protection</span>
              <select
                aria-label="Conflict protection"
                value={state.protection}
                onChange={(event) => {
                  const protection = event.target.value as TransactionProtectionMode;
                  dispatch({ type: "set-protection", protection });
                  announce(`${protectionLabel(protection)} selected. The authored schedule was reset.`);
                }}
              >
                {TRANSACTION_PROTECTION_MODES.map((mode) => (
                  <option key={mode} value={mode}>{TRANSACTION_PROTECTION_LABELS[mode]}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="simulation-control__buttons" role="group" aria-label="Replay controls">
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                dispatch({ type: "replay" });
                announce("The complete logical transaction was replayed; retry count increased.");
              }}
            >
              Replay after abort
            </button>
          </div>

          <div className="simulation-transaction-controls">
            {state.transactions.map((transaction) => (
              <TransactionLaneControls
                key={transaction.id}
                transaction={transaction}
                dispatch={dispatch}
                announce={announce}
              />
            ))}
          </div>
        </fieldset>
      )}
    >
      <TransactionIsolationGraphic state={state} metrics={metrics} />
      <TransactionRowsTable state={state} />
      <TransactionLanesTable state={state} />
      <TransactionVersionsTable state={state} />
    </SimulationShell>
  );
}

function TransactionLaneControls({
  transaction,
  dispatch,
  announce,
}: {
  transaction: TransactionState;
  dispatch: Dispatch<TransactionIsolationAction>;
  announce: (message: string) => void;
}) {
  const next = transaction.operations[transaction.cursor];
  const run = (type: "read" | "write" | "commit") => {
    dispatch({ type, transactionId: transaction.id });
    announce(`${transaction.id} requested ${type}.`);
  };
  return (
    <div className="simulation-transaction-controls__lane">
      <div>
        <strong>{transaction.id} · {transaction.label}</strong>
        <span>
          {transaction.status} · {next ? `next: ${next.kind}` : "no operation left"}
          {transaction.snapshotVersion === null ? " · snapshot —" : ` · snapshot v${transaction.snapshotVersion}`}
        </span>
      </div>
      <div className="simulation-control__buttons" role="group" aria-label={`${transaction.id} operations`}>
        <button className="button button--secondary" type="button" onClick={() => run("read")}>Read {transaction.id}</button>
        <button className="button button--secondary" type="button" onClick={() => run("write")}>Write {transaction.id}</button>
        <button className="button button--secondary" type="button" onClick={() => run("commit")}>Commit {transaction.id}</button>
        <button
          className="button button--secondary"
          type="button"
          onClick={() => {
            dispatch({ type: "abort", transactionId: transaction.id, reason: "Manual abort requested by the learner." });
            announce(`${transaction.id} aborted; uncommitted versions were discarded.`);
          }}
        >
          Abort {transaction.id}
        </button>
      </div>
    </div>
  );
}

function TransactionIsolationGraphic({
  state,
  metrics,
}: {
  state: TransactionIsolationState;
  metrics: TransactionIsolationMetrics;
}) {
  const titleId = "transaction-isolation-graphic-title";
  const descriptionId = "transaction-isolation-graphic-description";
  const laneY = { T1: 92, T2: 188 } as const;
  return (
    <figure className="simulation-graphic simulation-graphic--transaction-isolation">
      <svg viewBox="0 0 820 330" role="img" aria-labelledby={titleId}>
        <title id={titleId}>Transaction isolation scheduler</title>
        <desc id={descriptionId}>
          Two transaction lanes step through a shared table. Each lane lists its operation cursor, status, and snapshot version. The right side lists the latest committed rows and lock or wait state; the tables below repeat this information as text.
        </desc>
        <text className="simulation-svg__caption" x="18" y="24">TWO-LANE SCHEDULE</text>
        <text className="simulation-svg__meta" x="802" y="24" textAnchor="end">
          {isolationLabel(state.isolation)} · {protectionLabel(state.protection)}
        </text>
        <line className="simulation-svg__edge" x1="32" y1="138" x2="786" y2="138" />
        {state.transactions.map((transaction) => (
          <g key={transaction.id}>
            <text className="simulation-svg__label" x="25" y={laneY[transaction.id] - 14}>{transaction.id}</text>
            <text className="simulation-svg__meta" x="25" y={laneY[transaction.id] + 6}>{transaction.status}</text>
            {transaction.operations.map((operation, index) => {
              const x = 84 + index * 108;
              const completed = index < transaction.cursor;
              const current = index === transaction.cursor && !isTerminalTransaction(transaction.status);
              return (
                <g key={operation.id}>
                  <rect
                    className={`simulation-svg__node${current ? " simulation-svg__node--active" : ""}`}
                    x={x}
                    y={laneY[transaction.id] - 32}
                    width="92"
                    height="56"
                    rx="7"
                    opacity={completed ? 0.55 : 1}
                  />
                  <text className="simulation-svg__label" x={x + 46} y={laneY[transaction.id] - 8} textAnchor="middle">{operation.kind}</text>
                  <text className="simulation-svg__meta" x={x + 46} y={laneY[transaction.id] + 11} textAnchor="middle">
                    {operation.target ?? "transaction"}
                  </text>
                </g>
              );
            })}
            <text className="simulation-svg__meta" x="84" y={laneY[transaction.id] + 47}>
              {transaction.snapshotVersion === null ? "snapshot —" : `snapshot v${transaction.snapshotVersion}`}
              {transaction.waitingFor ? ` · waits ${transaction.waitingFor}` : ""}
            </text>
          </g>
        ))}
        <rect className="simulation-svg__node simulation-svg__node--active" x="560" y="238" width="226" height="66" rx="8" />
        <text className="simulation-svg__label" x="573" y="260">SHARED TABLE</text>
        <text className="simulation-svg__meta" x="573" y="279">committed v{metrics.committedVersion}</text>
        <text className="simulation-svg__meta" x="573" y="295">
          {state.locks.length} lock{state.locks.length === 1 ? "" : "s"} · {metrics.activeWaits} active wait{metrics.activeWaits === 1 ? "" : "s"}
        </text>
        <text className="simulation-svg__caption" x="32" y="284">
          {metrics.invariant.status === "violated" ? "INVARIANT VIOLATED" : metrics.invariant.status === "preserved" ? "INVARIANT PRESERVED" : "run the schedule to evaluate the invariant"}
        </text>
      </svg>
      <figcaption>
        The lane cards show the next operation and snapshot; committed and uncommitted versions, locks, waits, and exact invariant status are listed in the text tables below.
      </figcaption>
    </figure>
  );
}

function TransactionRowsTable({ state }: { state: TransactionIsolationState }) {
  return (
    <div className="simulation-table-wrap">
      <table className="simulation-table">
        <caption>Shared table state and committed versions</caption>
        <thead>
          <tr><th scope="col">Row</th><th scope="col">Value</th><th scope="col">Version</th><th scope="col">Tags</th></tr>
        </thead>
        <tbody>
          {state.rows.length > 0 ? state.rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.label}</th>
              <td>{formatValue(row.value)}</td>
              <td>v{row.version}</td>
              <td>{row.tags.join(", ") || "—"}</td>
            </tr>
          )) : (
            <tr><td colSpan={4}>No committed rows yet; both seat checks see an empty key.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TransactionLanesTable({ state }: { state: TransactionIsolationState }) {
  return (
    <div className="simulation-table-wrap">
      <table className="simulation-table">
        <caption>Transaction lanes, snapshots, and observations</caption>
        <thead>
          <tr><th scope="col">Lane</th><th scope="col">Status</th><th scope="col">Next operation</th><th scope="col">Snapshot</th><th scope="col">Last observation</th></tr>
        </thead>
        <tbody>
          {state.transactions.map((transaction) => {
            const observation = transaction.reads.at(-1);
            const operation = transaction.operations[transaction.cursor];
            return (
              <tr key={transaction.id}>
                <th scope="row">{transaction.id} · {transaction.label}</th>
                <td>{transaction.status}{transaction.waitingFor ? ` · waits ${transaction.waitingFor}` : ""}</td>
                <td>{operation ? `${operation.kind}${operation.target ? ` · ${operation.target}` : ""}` : "complete"}</td>
                <td>{transaction.snapshotVersion === null ? "statement snapshots" : `v${transaction.snapshotVersion}`}</td>
                <td>{observation ? `${formatValue(observation.value)} · ${observation.visibility}${observation.anomaly === "none" ? "" : ` · ${observation.anomaly}`}` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TransactionVersionsTable({ state }: { state: TransactionIsolationState }) {
  const rows = [
    ...state.versions.map((version) => ({
      id: version.id,
      kind: "version",
      resource: version.rowId,
      owner: version.transactionId,
      status: version.status,
      detail: `${formatValue(version.value)} · v${version.version}`,
    })),
    ...state.locks.map((lock) => ({
      id: lock.id,
      kind: `${lock.kind} lock`,
      resource: lock.resource,
      owner: lock.owner,
      status: lock.mode,
      detail: `acquired at tick ${lock.acquiredTick}`,
    })),
    ...state.waits.filter((wait) => !wait.resolved).map((wait) => ({
      id: wait.id,
      kind: "wait",
      resource: wait.resource,
      owner: wait.transactionId,
      status: `blocked by ${wait.blockedBy}`,
      detail: wait.reason,
    })),
  ];
  return (
    <div className="simulation-table-wrap">
      <table className="simulation-table">
        <caption>Versions, locks, and active waits</caption>
        <thead>
          <tr><th scope="col">Kind</th><th scope="col">Resource</th><th scope="col">Owner</th><th scope="col">State</th><th scope="col">Detail</th></tr>
        </thead>
        <tbody>
          {rows.length > 0 ? rows.slice(-24).map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.kind}</th><td>{row.resource}</td><td>{row.owner}</td><td>{row.status}</td><td>{row.detail}</td>
            </tr>
          )) : <tr><td colSpan={5}>No versions, locks, or waits yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function toSimulationMetrics(metrics: TransactionIsolationMetrics): SimulationMetric[] {
  return [
    {
      id: "isolation",
      label: "Isolation",
      value: isolationLabel(metrics.isolation),
      detail: `Protection: ${protectionLabel(metrics.protection)}.`,
    },
    {
      id: "snapshots",
      label: "Snapshots",
      value: metrics.snapshots.map((snapshot) => `${snapshot.transactionId} ${snapshot.version === null ? "—" : `v${snapshot.version}`}`).join(" · "),
      detail: "Repeatable read and serializable pin a transaction snapshot; read committed takes a statement snapshot.",
    },
    {
      id: "versions",
      label: "Versions",
      value: `${metrics.committedVersions} committed · ${metrics.pendingVersions} pending`,
      detail: `Shared table is at committed version ${metrics.committedVersion}.`,
    },
    {
      id: "anomalies",
      label: "Anomalies",
      value: `${metrics.dirtyReads} dirty · ${metrics.nonRepeatableReads} non-repeatable · ${metrics.phantomReads} phantom · ${metrics.writeSkew} skew`,
      detail: "The counts come from observed reads and the final multi-row invariant.",
      tone: metrics.dirtyReads + metrics.nonRepeatableReads + metrics.phantomReads + metrics.writeSkew > 0 ? "failure" : "info",
    },
    {
      id: "coordination",
      label: "Waits / aborts",
      value: `${metrics.waits} waits · ${metrics.aborts} aborts`,
      detail: `${metrics.activeWaits} active wait${metrics.activeWaits === 1 ? "" : "s"}; aborts include constraint and serialization failures.`,
      tone: metrics.activeWaits > 0 || metrics.aborts > 0 ? "warning" : "info",
    },
    {
      id: "retries",
      label: "Retries",
      value: String(metrics.retries),
      detail: "Replay retries the complete logical transaction, not just the failed statement.",
    },
    {
      id: "invariant",
      label: "Invariant",
      value: metrics.invariant.status === "pending" ? "Pending" : metrics.invariant.status === "preserved" ? "Preserved" : "Violated",
      detail: `${metrics.invariant.name}: ${metrics.invariant.detail}`,
      tone: metrics.invariant.status === "violated" ? "failure" : metrics.invariant.status === "preserved" ? "success" : "info",
    },
  ];
}

function explanationFor(state: TransactionIsolationState, metrics: TransactionIsolationMetrics): string {
  const event = metrics.latestEvent;
  if (event) return `${event.title}: ${event.detail}`;
  return `The ${state.presetId.replaceAll("-", " ")} preset is ready. ${metrics.invariant.name} is evaluated after both lanes finish.`;
}

function summaryFor(state: TransactionIsolationState, metrics: TransactionIsolationMetrics): string {
  const guarantee = state.protection === "none"
    ? `the ${isolationLabel(state.isolation)} engine rule`
    : `${protectionLabel(state.protection)} plus ${isolationLabel(state.isolation)}`;
  return `${metrics.invariant.name}. Current result: ${metrics.invariant.status}. The observed guarantee comes from ${guarantee}; waits and aborts are part of the correctness cost.`;
}

function isTransactionIsolationPresetId(value: string): value is TransactionIsolationPresetId {
  return TRANSACTION_ISOLATION_PRESETS.some((preset) => preset.id === value);
}

function isTerminalTransaction(status: TransactionState["status"]): boolean {
  return status === "committed" || status === "aborted";
}

// Keep this local alias for the narrow value formatter used by tests and text alternatives.
export function formatIsolationValue(value: IsolationValue): string {
  return formatValue(value);
}
