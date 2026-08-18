"use client";

import { useCallback, useMemo, useState } from "react";

import {
  HORIZONTAL_SCALING_PRESETS,
  createHorizontalScalingState,
  horizontalScalingMetrics,
  transitionHorizontalScaling,
  type HorizontalScalingAction,
  type HorizontalScalingMetrics,
  type HorizontalScalingLoadBalancer,
  type HorizontalScalingPresetId,
  type HorizontalScalingReplica,
  type HorizontalScalingState,
} from "@/simulations/horizontal-scaling";
import type { SimulationEvent, SimulationMetric } from "@/simulations";

import { SimulationShell } from "./SimulationShell";
import type {
  SimulationCompletionFactory,
  SimulationRepository,
} from "./simulation-types";

export interface HorizontalScalingSimulationProps {
  lessonId?: string;
  repository?: SimulationRepository;
  completionFactory?: SimulationCompletionFactory;
}

export function HorizontalScalingSimulation({
  lessonId,
  repository,
  completionFactory,
}: HorizontalScalingSimulationProps) {
  const [presetId, setPresetId] = useState<HorizontalScalingPresetId>("stateless-scale-out");
  const [state, setState] = useState<HorizontalScalingState>(() => createHorizontalScalingState("stateless-scale-out"));
  const [error, setError] = useState<string | null>(null);
  const metrics = useMemo(() => horizontalScalingMetrics(state), [state]);

  const apply = useCallback((action: HorizontalScalingAction) => {
    try {
      const transition = transitionHorizontalScaling(state, action);
      setState(transition.state);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The scaling action could not be applied.");
    }
  }, [state]);

  const step = useCallback(() => apply({ type: "step" }), [apply]);
  const reset = useCallback(() => {
    setState(createHorizontalScalingState(presetId));
    setError(null);
  }, [presetId]);
  const selectPreset = useCallback((nextPresetId: string) => {
    if (!isHorizontalScalingPresetId(nextPresetId)) return;
    setPresetId(nextPresetId);
    setState(createHorizontalScalingState(nextPresetId));
    setError(null);
  }, []);

  const simulationMetrics = toSimulationMetrics(metrics);
  const simulationEvents = state.events as readonly SimulationEvent[];

  return (
    <SimulationShell<HorizontalScalingState, HorizontalScalingAction>
      simulationId="horizontal-scaling"
      lessonId={lessonId}
      title="Scale up or scale out?"
      description="Change traffic, add replicas, and inject a failure to see why horizontal capacity is never just more CPU."
      state={state}
      dispatch={apply}
      onStep={step}
      onReset={reset}
      onPresetChange={selectPreset}
      metrics={simulationMetrics}
      events={simulationEvents}
      explanation={explanationFor(metrics)}
      summary={summaryFor(metrics)}
      presets={HORIZONTAL_SCALING_PRESETS}
      presetId={presetId}
      isComplete={state.progress.completed}
      externalError={error}
      repository={repository}
      completionFactory={completionFactory}
      initialStatus={error ?? "Use Step to advance the workload, or Play to let the model run."}
      controls={({ dispatch, announce }) => (
        <fieldset className="simulation-controls simulation-controls--scaling">
          <legend>Traffic, capacity, and failure controls</legend>
          <label className="simulation-control simulation-control--range" htmlFor="horizontal-scaling-demand">
            <span>Demand</span>
            <output htmlFor="horizontal-scaling-demand">{formatQps(state.config.demandQps)}</output>
            <input
              id="horizontal-scaling-demand"
              type="range"
              min={0}
              max={20_000}
              step={100}
              value={state.config.demandQps}
              aria-valuetext={`${formatQps(state.config.demandQps)} demand`}
              onChange={(event) => {
                const qps = Number(event.target.value);
                dispatch({ type: "set-demand", qps });
                announce(`Demand set to ${formatQps(qps)}.`);
              }}
            />
          </label>
          <div className="simulation-control__selects">
            <label className="simulation-control">
              <span>Load balancer</span>
              <select
                value={state.config.loadBalancer}
                onChange={(event) => {
                  const policy = event.target.value as HorizontalScalingLoadBalancer;
                  dispatch({ type: "set-load-balancer", policy });
                  announce(`Load balancer changed to ${event.target.value}.`);
                }}
              >
                <option value="round-robin">Round robin</option>
                <option value="least-loaded">Least loaded</option>
              </select>
            </label>
            <label className="simulation-control">
              <span>Session state</span>
              <select
                value={state.config.sessionMode}
                onChange={(event) => {
                  const mode = event.target.value as "local" | "shared";
                  dispatch({ type: "set-session-mode", mode });
                  announce(`Session state is now ${mode}.`);
                }}
              >
                <option value="shared">Shared session store</option>
                <option value="local">Local session state</option>
              </select>
            </label>
          </div>
          <label className="simulation-control simulation-control--range" htmlFor="horizontal-scaling-hot-key">
            <span>Hot-key traffic</span>
            <output htmlFor="horizontal-scaling-hot-key">{Math.round(state.config.hotKeyFraction * 100)}%</output>
            <input
              id="horizontal-scaling-hot-key"
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(state.config.hotKeyFraction * 100)}
              aria-valuetext={`${Math.round(state.config.hotKeyFraction * 100)} percent hot-key traffic`}
              onChange={(event) => {
                const fraction = Number(event.target.value) / 100;
                dispatch({ type: "set-hot-key", fraction });
                announce(`Hot-key traffic is now ${Math.round(fraction * 100)} percent.`);
              }}
            />
          </label>
          <div className="simulation-control__buttons" role="group" aria-label="Fleet and failure actions">
            <button className="button button--secondary" type="button" onClick={() => {
              dispatch({ type: "add-replica" });
              announce("Added a warming replica; Step advances its warm-up.");
            }} disabled={state.replicas.length >= state.config.maxReplicas}>
              Add replica
            </button>
            <button className="button button--secondary" type="button" onClick={() => {
              dispatch({ type: "upgrade-server", cores: 8, memoryGb: 16 });
              announce("Started a vertical server upgrade; replacement temporarily removes capacity.");
            }} disabled={!state.replicas.some((replica) => replica.status === "active")}>
              Upgrade server
            </button>
            <button className="button button--secondary" type="button" onClick={() => {
              const target = state.replicas.at(-1);
              if (!target) return;
              dispatch({ type: "remove-replica", replicaId: target.id });
              announce(`${target.id} removed from the fleet.`);
            }} disabled={state.replicas.length <= 1}>
              Remove replica
            </button>
            <button className="button button--secondary" type="button" onClick={() => {
              const target = state.replicas.find((replica) => replica.status === "active");
              if (!target) return;
              dispatch({ type: "fail-replica", replicaId: target.id });
              announce(`${target.id} failed; observe capacity after one node loss.`);
            }} disabled={!state.replicas.some((replica) => replica.status === "active")}>
              Fail replica
            </button>
            <button className="button button--secondary" type="button" onClick={() => {
              const target = state.replicas.find((replica) => replica.status === "failed");
              if (!target) return;
              dispatch({ type: "recover-replica", replicaId: target.id });
              announce(`${target.id} is warming back into service.`);
            }} disabled={!state.replicas.some((replica) => replica.status === "failed")}>
              Recover replica
            </button>
            <button className="button button--secondary" type="button" onClick={() => {
              dispatch({ type: state.database.status === "healthy" ? "fail-database" : "recover-database" });
              announce(state.database.status === "healthy" ? "Database failure injected." : "Database recovered.");
            }}>
              {state.database.status === "healthy" ? "Fail database" : "Recover database"}
            </button>
          </div>
        </fieldset>
      )}
    >
      <HorizontalScalingGraphic state={state} metrics={metrics} />
      <HorizontalScalingTable replicas={state.replicas} metrics={metrics} />
    </SimulationShell>
  );
}

function HorizontalScalingGraphic({ state, metrics }: { state: HorizontalScalingState; metrics: HorizontalScalingMetrics }) {
  const titleId = "horizontal-scaling-graphic-title";
  const width = 760;
  const gap = state.replicas.length > 1 ? 8 : 0;
  const nodeWidth = Math.min(130, Math.max(72, (width - 48 - gap * Math.max(0, state.replicas.length - 1)) / Math.max(1, state.replicas.length)));
  const fleetWidth = state.replicas.length * nodeWidth + Math.max(0, state.replicas.length - 1) * gap;
  const startX = (width - fleetWidth) / 2;
  return (
    <figure className="simulation-graphic simulation-graphic--scaling">
      <svg viewBox="0 0 760 260" role="img" aria-labelledby={titleId}>
        <title id={titleId}>Horizontal scaling request fleet</title>
        <desc>
          Demand enters a load balancer and is distributed across {metrics.activeReplicaCount} active replicas. A
          text table below lists every replica status and assigned traffic.
        </desc>
        <rect className="simulation-svg__load-balancer" x="294" y="16" width="172" height="44" rx="8" />
        <text className="simulation-svg__label" x="380" y="44" textAnchor="middle">Load balancer</text>
        {state.replicas.map((replica, index) => {
          const x = startX + index * (nodeWidth + gap);
          const centerX = x + nodeWidth / 2;
          const status = statusLabel(replica.status);
          return (
            <g key={replica.id} className={`simulation-svg__node simulation-svg__node--${replica.status}`}>
              <line className="simulation-svg__edge" x1="380" y1="60" x2={centerX} y2="146" />
              <rect x={x} y="146" width={nodeWidth} height="70" rx="8" />
              <text className="simulation-svg__label" x={centerX} y="170" textAnchor="middle">{replica.id}</text>
              <text className="simulation-svg__meta" x={centerX} y="191" textAnchor="middle">{status}</text>
              <text className="simulation-svg__meta" x={centerX} y="209" textAnchor="middle">{formatQps(replica.assignedQps)}</text>
            </g>
          );
        })}
        <text className="simulation-svg__caption" x="380" y="247" textAnchor="middle">
          {formatQps(metrics.demandQps)} demand · {formatQps(metrics.effectiveCapacityQps)} effective capacity
        </text>
      </svg>
      <figcaption>Health and capacity are written in the status table so the diagram is not color-dependent.</figcaption>
    </figure>
  );
}

function HorizontalScalingTable({ replicas, metrics }: { replicas: readonly HorizontalScalingReplica[]; metrics: HorizontalScalingMetrics }) {
  return (
    <div className="simulation-table-wrap">
      <table className="simulation-table">
        <caption>Replica state and assigned traffic</caption>
        <thead><tr><th scope="col">Replica</th><th scope="col">Status</th><th scope="col">Cores</th><th scope="col">Assigned QPS</th></tr></thead>
        <tbody>
          {replicas.map((replica) => (
            <tr key={replica.id}>
              <th scope="row">{replica.id}</th>
              <td>{statusLabel(replica.status)}</td>
              <td>{replica.cores}</td>
              <td>{formatQps(replica.assignedQps)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><th scope="row" colSpan={3}>Capacity after one node failure</th><td>{formatQps(metrics.capacityAfterOneNodeFailureQps)}</td></tr></tfoot>
      </table>
    </div>
  );
}

function toSimulationMetrics(metrics: HorizontalScalingMetrics): SimulationMetric[] {
  return [
    metric("demand", "Demand", formatQps(metrics.demandQps), "Requests entering the system."),
    metric("effective-capacity", "Effective capacity", formatQps(metrics.effectiveCapacityQps), "The lower of app and database capacity.", metrics.overloaded ? "failure" : "success"),
    metric("p95", "Modeled p95", `${metrics.modeledP95LatencyMs} ms`, "Queueing and saturation add tail latency.", metrics.modeledP95LatencyMs > 250 ? "warning" : "info"),
    metric("queue", "Queue depth", formatQps(metrics.queueDepth), "Bounded backlog; overflow is rejected.", metrics.queueDepth > 0 ? "warning" : "success"),
    metric("rejected", "Rejected", formatQps(metrics.rejectedQps), "Work beyond capacity and queue space.", metrics.rejectedQps > 0 ? "failure" : "success"),
    metric("database", "Database utilization", ratioText(metrics.databaseUtilization), "Replicas cannot remove this shared bottleneck.", metrics.dependencySaturated ? "warning" : "info"),
    metric("failure-headroom", "After one node fails", formatQps(metrics.capacityAfterOneNodeFailureQps), "Remaining capacity after the largest active replica is lost.", metrics.capacityAfterOneNodeFailureQps < metrics.demandQps ? "warning" : "success"),
  ];
}

function metric(id: string, label: string, value: string, detail: string, tone: SimulationMetric["tone"] = "info"): SimulationMetric {
  return { id, label, value, detail, tone };
}

function summaryFor(metrics: HorizontalScalingMetrics): string {
  return `${formatQps(metrics.demandQps)} demand is served by ${metrics.activeReplicaCount} active replica${metrics.activeReplicaCount === 1 ? "" : "s"}; effective capacity is ${formatQps(metrics.effectiveCapacityQps)} and ${metrics.rejectedQps > 0 ? `${formatQps(metrics.rejectedQps)} is rejected` : "no work is rejected"}.`;
}

function explanationFor(metrics: HorizontalScalingMetrics): string {
  if (metrics.dependencySaturated) return "The shared database is the binding resource. Adding application replicas increases fleet capacity without increasing the dependency's finite write/read budget.";
  if (metrics.overloaded) return "Demand has outrun effective capacity. A bounded queue protects the system, while p95 latency and rejected work make the overload visible.";
  if (metrics.activeReplicaCount > 1) return "Scale-out adds independent request-serving capacity, but warm-up, routing, sessions, and failure headroom become explicit operational work.";
  return "Scale-up keeps state and coordination local, but one server remains the capacity ceiling and failure domain.";
}

function statusLabel(status: HorizontalScalingReplica["status"]): string {
  return status === "active" ? "Active" : status === "warming" ? "Warming" : status === "replacing" ? "Replacing" : "Failed";
}

function ratioText(value: number): string {
  return Number.isFinite(value) ? `${Math.round(value * 100)}%` : "∞";
}

function formatQps(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M QPS`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k QPS`;
  return `${Math.round(value)} QPS`;
}

function isHorizontalScalingPresetId(value: string): value is HorizontalScalingPresetId {
  return HORIZONTAL_SCALING_PRESETS.some((preset) => preset.id === value);
}
