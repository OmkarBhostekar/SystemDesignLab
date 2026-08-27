"use client";

import { useCallback, useState } from "react";

import {
  LOAD_BALANCING_POLICY_IDS,
  LOAD_BALANCING_PRESETS,
  createLoadBalancingState,
  getLoadBalancingPolicyLabel,
  loadBalancingMetrics,
  transitionLoadBalancing,
  type LoadBalancingAction,
  type LoadBalancingMetrics,
  type LoadBalancingNode,
  type LoadBalancingPolicy,
  type LoadBalancingPresetId,
  type LoadBalancingSelectionUnit,
  type LoadBalancingState,
} from "@/simulations/load-balancing";
import type { SimulationEvent, SimulationMetric } from "@/simulations";

import { SimulationShell } from "./SimulationShell";
import type {
  SimulationCompletionFactory,
  SimulationRepository,
} from "./simulation-types";

export interface LoadBalancingSimulationProps {
  lessonId?: string;
  repository?: SimulationRepository;
  completionFactory?: SimulationCompletionFactory;
}

export function LoadBalancingSimulation({
  lessonId,
  repository,
  completionFactory,
}: LoadBalancingSimulationProps) {
  const [presetId, setPresetId] = useState<LoadBalancingPresetId>("mixed-checkout-work");
  const [state, setState] = useState<LoadBalancingState>(() => createLoadBalancingState("mixed-checkout-work"));
  const [weightNodeId, setWeightNodeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const metrics = loadBalancingMetrics(state);

  const apply = useCallback((action: LoadBalancingAction) => {
    try {
      const transition = transitionLoadBalancing(state, action);
      setState(transition.state);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The load-balancing action could not be applied.");
    }
  }, [state]);

  const step = useCallback(() => apply({ type: "step" }), [apply]);
  const reset = useCallback(() => {
    setState(createLoadBalancingState(presetId));
    setWeightNodeId("");
    setError(null);
  }, [presetId]);
  const selectPreset = useCallback((nextPresetId: string) => {
    if (!isLoadBalancingPresetId(nextPresetId)) return;
    setPresetId(nextPresetId);
    setState(createLoadBalancingState(nextPresetId));
    setWeightNodeId("");
    setError(null);
  }, []);

  const simulationMetrics = toSimulationMetrics(metrics);
  const targetNodeId = state.nodes.some((node) => node.id === weightNodeId)
    ? weightNodeId
    : state.nodes[0]?.id ?? "";

  return (
    <SimulationShell<LoadBalancingState, LoadBalancingAction>
      simulationId="load-balancing-algorithms"
      lessonId={lessonId}
      title="Route the same workload seven ways"
      description="Replay one deterministic trace against different balancing signals, then change capacity, health, locality, and telemetry lag."
      state={state}
      dispatch={apply}
      onStep={step}
      onReset={reset}
      onPresetChange={selectPreset}
      metrics={simulationMetrics}
      events={state.events as readonly SimulationEvent[]}
      explanation={explanationFor(state, metrics)}
      summary={summaryFor(state, metrics)}
      presets={LOAD_BALANCING_PRESETS}
      presetId={presetId}
      isComplete={state.progress.completed}
      externalError={error}
      repository={repository}
      completionFactory={completionFactory}
      initialStatus={error ?? "Use Step to replay a batch of the fixed request trace."}
      controls={({ dispatch, announce }) => (
        <fieldset className="simulation-controls simulation-controls--load-balancing">
          <legend>Routing policy, workload, and topology controls</legend>
          <div className="simulation-control__selects">
            <label className="simulation-control">
              <span>Balancing policy</span>
              <select
                value={state.config.policy}
                onChange={(event) => {
                  const policy = event.target.value as LoadBalancingPolicy;
                  dispatch({ type: "set-policy", policy });
                  announce(`${getLoadBalancingPolicyLabel(policy)} selected. The same trace remains loaded.`);
                }}
              >
                {LOAD_BALANCING_POLICY_IDS.map((policy) => (
                  <option key={policy} value={policy}>{getLoadBalancingPolicyLabel(policy)}</option>
                ))}
              </select>
            </label>
            <label className="simulation-control">
              <span>Selection unit</span>
              <select
                value={state.config.selectionUnit}
                onChange={(event) => {
                  const unit = event.target.value as LoadBalancingSelectionUnit;
                  dispatch({ type: "set-selection-unit", unit });
                  announce(`The balancer now selects per ${unit}.`);
                }}
              >
                <option value="request">HTTP request</option>
                <option value="connection">Connection</option>
              </select>
            </label>
            <label className="simulation-control">
              <span>Metric delay</span>
              <select
                value={String(state.config.metricDelayTicks)}
                onChange={(event) => {
                  const ticks = Number(event.target.value);
                  dispatch({ type: "set-metric-delay", ticks });
                  announce(`Load signals are delayed by ${ticks} tick${ticks === 1 ? "" : "s"}.`);
                }}
              >
                {[0, 1, 2, 3].map((ticks) => <option key={ticks} value={ticks}>{ticks} tick{ticks === 1 ? "" : "s"}</option>)}
              </select>
            </label>
          </div>
          <label className="simulation-control simulation-control--range" htmlFor="load-balancing-hot-key">
            <span>Hot-key probability</span>
            <output htmlFor="load-balancing-hot-key">{Math.round(state.config.hotKeyProbability * 100)}%</output>
            <input
              id="load-balancing-hot-key"
              type="range"
              min={0}
              max={80}
              step={5}
              value={Math.round(state.config.hotKeyProbability * 100)}
              aria-valuetext={`${Math.round(state.config.hotKeyProbability * 100)} percent of requests use the celebrity key`}
              onChange={(event) => {
                const probability = Number(event.target.value) / 100;
                dispatch({ type: "set-hot-key-probability", probability });
                announce(`Hot-key probability is now ${Math.round(probability * 100)}%.`);
              }}
            />
          </label>
          <div className="simulation-control__selects">
            <label className="simulation-control">
              <span>Node capacity weight</span>
              <select value={targetNodeId} onChange={(event) => setWeightNodeId(event.target.value)}>
                {state.nodes.map((node) => <option key={node.id} value={node.id}>{node.id}</option>)}
              </select>
            </label>
            <label className="simulation-control simulation-control--range" htmlFor="load-balancing-weight">
              <span>Weight</span>
              <output htmlFor="load-balancing-weight">{state.nodes.find((node) => node.id === targetNodeId)?.weight ?? 0}×</output>
              <input
                id="load-balancing-weight"
                type="range"
                min={1}
                max={4}
                step={1}
                value={state.nodes.find((node) => node.id === targetNodeId)?.weight ?? 1}
                disabled={!targetNodeId || state.nodes.find((node) => node.id === targetNodeId)?.status === "removed"}
                onChange={(event) => {
                  const weight = Number(event.target.value);
                  if (!targetNodeId) return;
                  dispatch({ type: "set-node-weight", nodeId: targetNodeId, weight });
                  announce(`${targetNodeId} weight is now ${weight}.`);
                }}
              />
            </label>
          </div>
          <div className="simulation-control__buttons" role="group" aria-label="Load-balancer topology actions">
            <button className="button button--secondary" type="button" onClick={() => {
              dispatch({ type: "add-node" });
              announce("Added an active node; inspect hash remapping and new assignments.");
            }}>
              Add node
            </button>
            <button className="button button--secondary" type="button" onClick={() => {
              if (!targetNodeId) return;
              dispatch({ type: "remove-node", nodeId: targetNodeId });
              announce(`${targetNodeId} removed from the eligible set.`);
            }} disabled={!targetNodeId || state.nodes.find((node) => node.id === targetNodeId)?.status === "removed"}>
              Remove selected
            </button>
            <button className="button button--secondary" type="button" onClick={() => {
              const target = state.nodes.find((node) => node.status === "active");
              if (!target) return;
              dispatch({ type: "fail-node", nodeId: target.id });
              announce(`${target.id} failed; future requests skip it.`);
            }} disabled={!state.nodes.some((node) => node.status === "active")}>
              Fail node
            </button>
            <button className="button button--secondary" type="button" onClick={() => {
              const target = state.nodes.find((node) => node.status === "failed");
              if (!target) return;
              dispatch({ type: "recover-node", nodeId: target.id });
              announce(`${target.id} recovered and is eligible again.`);
            }} disabled={!state.nodes.some((node) => node.status === "failed")}>
              Recover node
            </button>
          </div>
        </fieldset>
      )}
    >
      <LoadBalancingGraphic state={state} metrics={metrics} />
      <LoadBalancingTable nodes={state.nodes} metrics={metrics} />
      <LoadBalancingComparisonTable metrics={metrics} />
    </SimulationShell>
  );
}

function LoadBalancingGraphic({ state, metrics }: { state: LoadBalancingState; metrics: LoadBalancingMetrics }) {
  const titleId = "load-balancing-graphic-title";
  const width = 760;
  const columns = Math.min(4, Math.max(1, state.nodes.length));
  const rows = Math.ceil(Math.max(1, state.nodes.length) / columns);
  const gap = 12;
  const nodeWidth = (width - 48 - gap * (columns - 1)) / columns;
  const nodeHeight = 76;
  const firstNodeY = 130;
  const height = firstNodeY + rows * (nodeHeight + 30) + 42;

  return (
    <figure className="simulation-graphic simulation-graphic--load-balancing">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={titleId}>
        <title id={titleId}>Load-balancing policy routing the request trace</title>
        <desc>
          The selected {getLoadBalancingPolicyLabel(metrics.policy)} policy selects per {metrics.selectionUnit} and routes
          {" "}{metrics.traceCursor} of {metrics.traceLength} requests. The table below contains the exact node metrics.
        </desc>
        <rect className="simulation-svg__load-balancer" x="286" y="20" width="188" height="48" rx="8" />
        <text className="simulation-svg__label" x="380" y="43" textAnchor="middle">Load balancer</text>
        <text className="simulation-svg__meta" x="380" y="59" textAnchor="middle">{getLoadBalancingPolicyLabel(metrics.policy)} · {metrics.selectionUnit}</text>
        {state.nodes.map((node, index) => {
          const column = index % columns;
          const row = Math.floor(index / columns);
          const x = 24 + column * (nodeWidth + gap);
          const y = firstNodeY + row * (nodeHeight + 30);
          const centerX = x + nodeWidth / 2;
          const nodeMetrics = metrics.nodeMetrics.find((candidate) => candidate.nodeId === node.id);
          const utilizationWidth = Math.min(nodeWidth - 18, Math.max(0, (nodeMetrics?.utilization ?? 0) * (nodeWidth - 18)));
          return (
            <g key={node.id} className={`simulation-svg__node simulation-svg__node--${node.status}`}>
              <line className="simulation-svg__edge" x1="380" y1="68" x2={centerX} y2={y} />
              <rect x={x} y={y} width={nodeWidth} height={nodeHeight} rx="8" />
              <text className="simulation-svg__label" x={centerX} y={y + 21} textAnchor="middle">{node.id}</text>
              <text className="simulation-svg__meta" x={centerX} y={y + 39} textAnchor="middle">{statusLabel(node.status)} · {nodeMetrics?.assignments ?? 0} req</text>
              <rect x={x + 9} y={y + 51} width={nodeWidth - 18} height="8" rx="4" className="simulation-svg__load-balancer" />
              <rect x={x + 9} y={y + 51} width={utilizationWidth} height="8" rx="4" className="simulation-svg__edge" />
              <text className="simulation-svg__meta" x={centerX} y={y + 71} textAnchor="middle">{Math.round((nodeMetrics?.utilization ?? 0) * 100)}% util · q{nodeMetrics?.queueDepth ?? 0}</text>
            </g>
          );
        })}
        <text className="simulation-svg__caption" x="380" y={height - 13} textAnchor="middle">
          {metrics.servedRequests} served · {metrics.rejectedRequests} rejected · {metrics.latencyP95Ms} ms p95
        </text>
      </svg>
      <figcaption>Node status, assignment count, queue, and utilization are repeated in the accessible table below.</figcaption>
    </figure>
  );
}

function LoadBalancingTable({ nodes, metrics }: { nodes: readonly LoadBalancingNode[]; metrics: LoadBalancingMetrics }) {
  return (
    <div className="simulation-table-wrap">
      <table className="simulation-table">
        <caption>Per-node assignments and work for the selected policy</caption>
        <thead>
          <tr><th scope="col">Node</th><th scope="col">Status</th><th scope="col">Weight</th><th scope="col">Assignments</th><th scope="col">Work</th><th scope="col">Queue</th><th scope="col">Utilization</th><th scope="col">p95</th></tr>
        </thead>
        <tbody>
          {nodes.map((node) => {
            const current = metrics.nodeMetrics.find((candidate) => candidate.nodeId === node.id);
            return (
              <tr key={node.id}>
                <th scope="row">{node.id}</th>
                <td>{statusLabel(node.status)}</td>
                <td>{node.weight}×</td>
                <td>{current?.assignments ?? 0}</td>
                <td>{formatWork(current?.workMs ?? 0)}</td>
                <td>{current?.queueDepth ?? 0}</td>
                <td>{Math.round((current?.utilization ?? 0) * 100)}%</td>
                <td>{current?.p95LatencyMs ?? 0} ms</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr><th scope="row" colSpan={3}>Hot key</th><td colSpan={5}>{metrics.hotKeyNodeId ? `${metrics.hotKeyNodeId} owns ${Math.round(metrics.hotKeyShare * 100)}% of ${metrics.hotKeyRequests} hot-key requests` : "No hot-key requests yet"}</td></tr>
        </tfoot>
      </table>
    </div>
  );
}

function LoadBalancingComparisonTable({ metrics }: { metrics: LoadBalancingMetrics }) {
  return (
    <div className="simulation-table-wrap">
      <table className="simulation-table">
        <caption>Same-trace policy comparison</caption>
        <thead><tr><th scope="col">Policy</th><th scope="col">Served</th><th scope="col">Rejected</th><th scope="col">p95</th><th scope="col">Max utilization</th><th scope="col">Work skew</th></tr></thead>
        <tbody>
          {metrics.comparisons.map((comparison) => (
            <tr key={comparison.policy}>
              <th scope="row">{comparison.label}{comparison.policy === metrics.policy ? " (selected)" : ""}</th>
              <td>{comparison.servedRequests}</td>
              <td>{comparison.rejectedRequests}</td>
              <td>{comparison.p95LatencyMs} ms</td>
              <td>{Math.round(comparison.maxUtilization * 100)}%</td>
              <td>{comparison.workSkew.toFixed(2)}×</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="simulation-table__note">Every row uses the same request trace and current healthy-node set; changing a policy does not change the workload.</p>
    </div>
  );
}

function toSimulationMetrics(metrics: LoadBalancingMetrics): SimulationMetric[] {
  return [
    metric("policy", "Policy", getLoadBalancingPolicyLabel(metrics.policy), `Selecting per ${metrics.selectionUnit}.`),
    metric("progress", "Trace progress", `${metrics.traceCursor}/${metrics.traceLength}`, "Requests replayed from the fixed trace."),
    metric("p95", "p95 latency", `${metrics.latencyP95Ms} ms`, `p50 ${metrics.latencyP50Ms} ms · p99 ${metrics.latencyP99Ms} ms.`, metrics.latencyP95Ms > 500 ? "warning" : "info"),
    metric("rejected", "Rejected", String(metrics.rejectedRequests), "Queue overflow or no healthy node.", metrics.rejectedRequests > 0 ? "failure" : "success"),
    metric("utilization", "Max utilization", `${Math.round(metrics.maxUtilization * 100)}%`, "Aggregate work divided by weighted capacity.", metrics.maxUtilization > 1 ? "warning" : "info"),
    metric("work", "Work processed", formatWork(metrics.totalWorkMs), "Cost-weighted work, not just request count."),
    metric("remapping", "Hash remapping", `${Math.round(metrics.remappedKeyFraction * 100)}%`, metrics.remappedKeyCount > 0 ? `${metrics.remappedKeyCount} modeled keys moved after topology change.` : "No topology remap observed yet."),
    metric("hot-key", "Hot-key owner", metrics.hotKeyNodeId ?? "—", metrics.hotKeyRequests > 0 ? `${Math.round(metrics.hotKeyShare * 100)}% of hot-key traffic.` : "No hot-key traffic yet.", metrics.hotKeyShare >= 0.5 ? "warning" : "info"),
  ];
}

function metric(id: string, label: string, value: string, detail: string, tone: SimulationMetric["tone"] = "info"): SimulationMetric {
  return { id, label, value, detail, tone };
}

function summaryFor(state: LoadBalancingState, metrics: LoadBalancingMetrics): string {
  return `${getLoadBalancingPolicyLabel(metrics.policy)} assigned ${metrics.servedRequests} requests from the shared trace; ${metrics.rejectedRequests > 0 ? `${metrics.rejectedRequests} were rejected` : "no requests were rejected"}, and the hottest node is ${metrics.hotKeyNodeId ?? "not yet observed"}.`;
}

function explanationFor(state: LoadBalancingState, metrics: LoadBalancingMetrics): string {
  if (metrics.activeNodeCount === 0) return "Health eligibility comes before policy selection: with no healthy node, every new request is rejected.";
  if (metrics.rejectedRequests > 0) return "The selected signal cannot create capacity. A long or concentrated workload fills a node's bounded queue, making rejection and tail latency visible.";
  if (metrics.remappedKeyCount > 0) return "Topology changes move hash owners even when the request trace is unchanged. Locality reduces coordination, but it does not remove hot-key skew.";
  if (metrics.policy === "round-robin") return "Round robin balances assignment position, not request cost. Compare its work skew and p95 with the same trace under least outstanding or latency-aware routing.";
  if (metrics.policy === "weighted-round-robin") return "Weighted rotation represents known capacity differences. The weights are configuration, so stale values can still overload a smaller node.";
  if (metrics.policy === "least-connections") return "Least connections tracks open connection IDs. Long-lived idle sockets can make it disagree with request-level work.";
  if (metrics.policy === "least-outstanding") return "Least outstanding reacts to in-flight work and queue depth, but its view can be delayed and may chase transient minima.";
  if (metrics.policy === "latency-aware") return "Latency-aware routing uses a delayed signal. Feedback helps when cost differs, but lag and a shared downstream bottleneck can cause oscillation.";
  if (metrics.policy === "random") return "Deterministic random selection avoids global coordination; power-of-two or load feedback would reduce the chance of repeatedly choosing a busy node.";
  return "Hashing preserves key locality by sending the same key to one owner. A celebrity key can still overload that owner, and node changes remap keys.";
}

function statusLabel(status: LoadBalancingNode["status"]): string {
  return status === "active" ? "Active" : status === "failed" ? "Failed" : "Removed";
}

function formatWork(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M ms`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k ms`;
  return `${Math.round(value)} ms`;
}

function isLoadBalancingPresetId(value: string): value is LoadBalancingPresetId {
  return LOAD_BALANCING_PRESETS.some((preset) => preset.id === value);
}
