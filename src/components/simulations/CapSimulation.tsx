"use client";

import { useCallback, useMemo, useState } from "react";

import {
  CAP_PRESETS,
  capMetrics,
  capPolicyLabel,
  createCapState,
  getCapPreset,
  transitionCap,
  type CapAction,
  type CapMetrics,
  type CapOperation,
  type CapPolicy,
  type CapPresetId,
  type CapSide,
  type CapState,
  type CapValue,
} from "@/simulations/cap";
import type { SimulationEvent, SimulationMetric } from "@/simulations";

import { SimulationShell } from "./SimulationShell";
import type {
  SimulationCompletionFactory,
  SimulationRepository,
} from "./simulation-types";

export interface CapSimulationProps {
  lessonId?: string;
  repository?: SimulationRepository;
  completionFactory?: SimulationCompletionFactory;
}

export function CapSimulation({
  lessonId,
  repository,
  completionFactory,
}: CapSimulationProps) {
  const [presetId, setPresetId] = useState<CapPresetId>("inventory");
  const [state, setState] = useState<CapState>(() => createCapState("inventory"));
  const [error, setError] = useState<string | null>(null);
  const [selectedSide, setSelectedSide] = useState<CapSide>("left");
  const [profileDraft, setProfileDraft] = useState(() => String(getCapPreset("inventory").leftWrite));
  const metrics = useMemo(() => capMetrics(state), [state]);
  const preset = useMemo(() => getCapPreset(presetId), [presetId]);

  const apply = useCallback((action: CapAction) => {
    try {
      const transition = transitionCap(state, action);
      setState(transition.state);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The CAP action could not be applied.");
    }
  }, [state]);

  const step = useCallback(() => apply({ type: "step" }), [apply]);
  const reset = useCallback(() => {
    setState(createCapState(presetId));
    setProfileDraft(String(getCapPreset(presetId).leftWrite));
    setError(null);
  }, [presetId]);
  const selectPreset = useCallback((nextPresetId: string) => {
    if (!isCapPresetId(nextPresetId)) return;
    setPresetId(nextPresetId);
    setState(createCapState(nextPresetId));
    setProfileDraft(String(getCapPreset(nextPresetId).leftWrite));
    setError(null);
  }, []);

  return (
    <SimulationShell<CapState, CapAction>
      simulationId="cap"
      lessonId={lessonId}
      title="CAP partition lab"
      description="Split three replicas, issue side-specific reads and writes, then compare CP-like rejection, owner routing, and AP-like local progress."
      state={state}
      dispatch={apply}
      onStep={step}
      onReset={reset}
      onPresetChange={selectPreset}
      metrics={toSimulationMetrics(metrics)}
      events={state.events as readonly SimulationEvent[]}
      explanation={explanationFor(state, metrics)}
      summary={summaryFor(state, metrics)}
      presets={CAP_PRESETS}
      presetId={presetId}
      isComplete={state.progress.completed}
      externalError={error}
      repository={repository}
      completionFactory={completionFactory}
      initialStatus={error ?? "Choose a policy, partition the network, and issue reads or writes from both sides."}
      controls={({ dispatch, announce }) => (
        <fieldset className="simulation-controls simulation-controls--cap">
          <legend>Partition, policy, and client-operation controls</legend>

          <div className="simulation-control__selects">
            <label className="simulation-control">
              <span>Partition-time write policy</span>
              <select
                value={state.policy}
                onChange={(event) => {
                  const policy = event.target.value as CapPolicy;
                  dispatch({ type: "set-policy", policy });
                  announce(`${capPolicyLabel(policy)}. This applies while the partition is active.`);
                }}
              >
                <option value="reject-writes">Reject writes (CP-like)</option>
                <option value="route-to-owner">Route to one owner</option>
                <option value="accept-both">Accept both writes (AP-like)</option>
              </select>
            </label>
            <label className="simulation-control">
              <span>Client side</span>
              <select
                value={selectedSide}
                onChange={(event) => setSelectedSide(event.target.value as CapSide)}
              >
                <option value="left">Left side · Replica A</option>
                <option value="right">Right side · Replicas B + C</option>
              </select>
            </label>
          </div>

          {state.valueKind === "profile" ? (
            <label className="simulation-control" htmlFor="cap-profile-value">
              <span>Profile value for the selected side</span>
              <input
                id="cap-profile-value"
                value={profileDraft}
                onChange={(event) => setProfileDraft(event.target.value)}
                type="text"
                maxLength={48}
              />
            </label>
          ) : null}

          <div className="simulation-control__buttons" role="group" aria-label="Network controls">
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                dispatch({ type: "partition" });
                announce("Network partitioned: Replica A is isolated from Replicas B and C.");
              }}
              disabled={state.partitioned}
            >
              Partition network
            </button>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                dispatch({ type: "heal" });
                announce("Network healed. Inspect divergence, then repair the replicas.");
              }}
              disabled={!state.partitioned}
            >
              Heal network
            </button>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                dispatch({ type: "repair" });
                announce("Repair merged the acknowledged operations and converged the replicas.");
              }}
              disabled={state.partitioned}
            >
              Repair &amp; converge
            </button>
          </div>

          <div className="simulation-control__buttons" role="group" aria-label="Selected-side operations">
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                dispatch({ type: "read", side: selectedSide });
                announce(`Read issued from the ${selectedSide} side.`);
              }}
            >
              Read selected side
            </button>
            <button
              className="button button--primary"
              type="button"
              onClick={() => {
                dispatch(writeActionFor(state, selectedSide, profileDraft));
                announce(`Write issued from the ${selectedSide} side.`);
              }}
            >
              {preset.writeLabel}
            </button>
          </div>

          <div className="simulation-control__buttons" role="group" aria-label="Direct side operations">
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                dispatch({ type: "read", side: "left" });
                announce("Read issued from the left side.");
              }}
            >
              Read on left side
            </button>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                dispatch(writeActionFor(state, "left", profileDraft));
                announce("Write issued from the left side.");
              }}
            >
              Write on left side
            </button>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                dispatch({ type: "read", side: "right" });
                announce("Read issued from the right side.");
              }}
            >
              Read on right side
            </button>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                dispatch(writeActionFor(state, "right", profileDraft));
                announce("Write issued from the right side.");
              }}
            >
              Write on right side
            </button>
          </div>
        </fieldset>
      )}
    >
      <CapGraphic state={state} />
      <CapReplicaTable state={state} />
      <CapOperationTable state={state} />
    </SimulationShell>
  );
}

function CapGraphic({ state }: { state: CapState }) {
  const titleId = "cap-graphic-title";
  const descId = "cap-graphic-description";
  const replicas = [
    { replica: state.replicas[0], x: 145, y: 150 },
    { replica: state.replicas[1], x: 540, y: 95 },
    { replica: state.replicas[2], x: 540, y: 205 },
  ];
  return (
    <figure className="simulation-graphic simulation-graphic--cap">
      <svg viewBox="0 0 760 310" role="img" aria-labelledby={`${titleId} ${descId}`}>
        <title id={titleId}>Three-replica CAP partition diagram</title>
        <desc id={descId}>
          Replica A is on the left side and Replicas B and C are on the right side. The central network link is
          {state.partitioned ? " partitioned" : " healed"}. Each replica value and version is also listed in the table below.
        </desc>
        <text className="simulation-svg__caption" x="145" y="35" textAnchor="middle">LEFT SIDE</text>
        <text className="simulation-svg__caption" x="540" y="35" textAnchor="middle">RIGHT SIDE</text>
        <line className="simulation-svg__edge" x1="215" y1="150" x2="465" y2="150" strokeDasharray={state.partitioned ? "8 6" : undefined} />
        <text className={`simulation-svg__meta${state.partitioned ? " simulation-svg__meta--partitioned" : ""}`} x="340" y="136" textAnchor="middle">
          {state.partitioned ? "║ PARTITION ║" : "↔ messages flowing"}
        </text>
        {state.partitioned ? (
          <text className="simulation-svg__caption" x="340" y="177" textAnchor="middle">messages delayed</text>
        ) : null}
        {replicas.map(({ replica, x, y }) => (
          <g key={replica.id} className="simulation-svg__node simulation-svg__node--active">
            <rect x={x - 78} y={y - 35} width="156" height="70" rx="8" />
            <text className="simulation-svg__label" x={x} y={y - 8} textAnchor="middle">{replica.id}</text>
            <text className="simulation-svg__meta" x={x} y={y + 12} textAnchor="middle">{formatValue(replica.value, state.valueKind)}</text>
            <text className="simulation-svg__meta" x={x} y={y + 28} textAnchor="middle">v{replica.version} · {replica.side} side</text>
          </g>
        ))}
        <text className="simulation-svg__caption" x="380" y="280" textAnchor="middle">
          {state.partitioned
            ? `${capPolicyShortLabel(state.policy)} · local reads available`
            : "Network healed · repair is explicit when values diverged"}
        </text>
      </svg>
      <figcaption>
        {state.partitioned
          ? "The vertical split is the event CAP reasons about. A response can be available on a side even when it is stale or a write is rejected."
          : "Values, versions, and side ownership remain readable without relying on color or animation."}
      </figcaption>
    </figure>
  );
}

function CapReplicaTable({ state }: { state: CapState }) {
  return (
    <div className="simulation-table-wrap">
      <table className="simulation-table">
        <caption>Replica state and partition visibility</caption>
        <thead>
          <tr><th scope="col">Replica</th><th scope="col">Side</th><th scope="col">Value</th><th scope="col">Version</th><th scope="col">Last operation</th></tr>
        </thead>
        <tbody>
          {state.replicas.map((replica) => (
            <tr key={replica.id}>
              <th scope="row">{replica.id}</th>
              <td>{replica.side}</td>
              <td>{formatValue(replica.value, state.valueKind)}</td>
              <td>{replica.version}</td>
              <td>{replica.lastOperationId ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CapOperationTable({ state }: { state: CapState }) {
  const operations = state.operations.slice(-8).reverse();
  return (
    <div className="simulation-table-wrap">
      <table className="simulation-table">
        <caption>Recent acknowledged operations and responses</caption>
        <thead>
          <tr><th scope="col">Operation</th><th scope="col">Side</th><th scope="col">Action</th><th scope="col">Response</th><th scope="col">Value</th><th scope="col">Detail</th></tr>
        </thead>
        <tbody>
          {operations.length > 0 ? operations.map((operation) => (
            <tr key={operation.id}>
              <th scope="row">{operation.id}</th>
              <td>{operation.side}</td>
              <td>{operation.kind}</td>
              <td>{responseLabel(operation)}</td>
              <td>{operation.observedValue === null ? "—" : formatValue(operation.observedValue, state.valueKind)}</td>
              <td>{operation.detail}</td>
            </tr>
          )) : (
            <tr><td colSpan={6}>No reads or writes yet. Partition the network to compare policies.</td></tr>
          )}
        </tbody>
      </table>
      <p className="simulation-table__note">Showing the last {operations.length} of {state.operations.length} operations. Acknowledged means the request received a response that the model accepted; availability and consistency are tracked separately.</p>
    </div>
  );
}

function toSimulationMetrics(metrics: CapMetrics): SimulationMetric[] {
  return [
    metric("partition", "Network", metrics.partitioned ? "Partitioned" : "Healed", "CAP's trade-off is evaluated while messages are partitioned.", metrics.partitioned ? "warning" : "success"),
    metric("policy", "Partition policy", capPolicyLabel(metrics.policy), "The operation policy is not a permanent CP/AP label."),
    metric("acknowledged", "Acknowledged writes", String(metrics.acknowledgedWrites), `${metrics.rejectedWrites} write${metrics.rejectedWrites === 1 ? "" : "s"} rejected.`, metrics.rejectedWrites > 0 ? "warning" : "success"),
    metric("availability", "User-visible availability", percentage(metrics.userVisibleAvailability), "Responses to modelled reads and writes, not uptime.", metrics.userVisibleAvailability < 1 ? "warning" : "success"),
    metric("stale", "Stale reads", String(metrics.staleReads), "Local reads that lag an acknowledged write on the other side.", metrics.staleReads > 0 ? "warning" : "success"),
    metric("violations", "Linearizability violations", String(metrics.linearizabilityViolations), "Split writes or stale reads that cannot fit one real-time order.", metrics.linearizabilityViolations > 0 ? "failure" : "success"),
    metric("conflicts", "Conflicts", String(metrics.conflictCount), "Incompatible concurrent writes waiting for application repair.", metrics.conflictCount > 0 ? "failure" : "success"),
    metric("repair", "Repair / convergence", metrics.converged ? "Converged" : `${metrics.repairPending} replica${metrics.repairPending === 1 ? "" : "s"} pending`, "Heal restores communication; repair restores one value.", metrics.converged ? "success" : "warning"),
  ];
}

function explanationFor(state: CapState, metrics: CapMetrics): string {
  if (!state.partitioned && metrics.converged) {
    return "The network is healthy and all replicas agree. CP/AP describes what this operation does during the partition; it is not a permanent label for every normal-operation path.";
  }
  if (!state.partitioned && state.pendingRepair) {
    return "Communication has returned, but availability alone does not repair divergent data. Merge the acknowledged operations, then verify convergence.";
  }
  if (state.policy === "reject-writes") {
    return "This CP-like policy fails closed during the partition: reads can answer locally, but writes reject when coordination is unavailable so linearizable state is not split.";
  }
  if (state.policy === "route-to-owner") {
    return `This owner-routed policy preserves one write order at ${state.ownerReplicaId}. The side that cannot reach the owner sacrifices write availability during the partition.`;
  }
  if (metrics.conflictCount > 0) {
    return "This AP-like policy kept both sides responsive, but incompatible values were acknowledged. Repair needs an application-specific merge; availability did not make the conflict disappear.";
  }
  return "This AP-like policy keeps local writes available on both sides while messages are delayed. Reads may become stale, and the final merge must be safe for this data type.";
}

function summaryFor(state: CapState, metrics: CapMetrics): string {
  const left = formatValue(metrics.leftValue, state.valueKind);
  const right = formatValue(metrics.rightValue, state.valueKind);
  return `${state.partitioned ? "Partitioned" : "Healed"}: left side shows ${left}; right side shows ${right}. ${metrics.acknowledgedWrites} write${metrics.acknowledgedWrites === 1 ? " is" : "s are"} acknowledged, ${metrics.linearizabilityViolations} linearizability violation${metrics.linearizabilityViolations === 1 ? "" : "s"}, and ${metrics.converged ? "the replicas converge" : "repair is still required"}.`;
}

function writeActionFor(state: CapState, side: CapSide, profileDraft: string): CapAction {
  const preset = getCapPreset(state.presetId);
  if (state.valueKind === "profile") {
    const sideDefault = String(side === "left" ? preset.leftWrite : preset.rightWrite);
    const leftDefault = String(preset.leftWrite);
    const value = profileDraft.trim().length === 0 || profileDraft === leftDefault ? sideDefault : profileDraft;
    return { type: "write", side, value };
  }
  return { type: "write", side, delta: state.valueKind === "counter" ? 1 : -1 };
}

function responseLabel(operation: CapOperation): string {
  if (operation.status === "stale") return "Available · stale";
  if (operation.acknowledged) return operation.available ? "Acknowledged" : "Acknowledged · unavailable";
  return operation.available ? "Rejected · response" : "Rejected · unavailable";
}

function capPolicyShortLabel(policy: CapPolicy): string {
  return policy === "reject-writes" ? "CP-like" : policy === "accept-both" ? "AP-like" : "owner-routed";
}

function formatValue(value: CapValue, kind: CapState["valueKind"]): string {
  if (kind === "inventory") return `${value} ticket${value === 1 ? "" : "s"}`;
  if (kind === "counter") return `${value} like${value === 1 ? "" : "s"}`;
  return `“${String(value)}”`;
}

function percentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function metric(
  id: string,
  label: string,
  value: string,
  detail: string,
  tone: SimulationMetric["tone"] = "info",
): SimulationMetric {
  return { id, label, value, detail, tone };
}

function isCapPresetId(value: string): value is CapPresetId {
  return CAP_PRESETS.some((preset) => preset.id === value);
}
