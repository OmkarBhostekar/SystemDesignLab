"use client";

import { useCallback, useMemo, useState } from "react";

import {
  CONSISTENT_HASHING_PRESETS,
  HASH_SPACE_SIZE,
  createConsistentHashingState,
  toConsistentHashingSimulationMetrics,
  transitionConsistentHashing,
  type ConsistentHashMetrics,
  type ConsistentHashNode,
  type ConsistentHashingAction,
  type ConsistentHashingPresetId,
  type ConsistentHashingState,
  type HashStrategy,
  type MigrationPolicy,
} from "@/simulations/consistent-hashing";
import type { SimulationEvent } from "@/simulations";

import { SimulationShell } from "./SimulationShell";
import type {
  SimulationCompletionFactory,
  SimulationRepository,
} from "./simulation-types";

const RING_CENTER = 380;
const RING_RADIUS = 150;
const RENDERED_KEY_SAMPLE = 48;

export interface ConsistentHashingSimulationProps {
  lessonId?: string;
  repository?: SimulationRepository;
  completionFactory?: SimulationCompletionFactory;
}

export function ConsistentHashingSimulation({
  lessonId,
  repository,
  completionFactory,
}: ConsistentHashingSimulationProps) {
  const [presetId, setPresetId] = useState<ConsistentHashingPresetId>("vnode-ring");
  const [state, setState] = useState<ConsistentHashingState>(() => createConsistentHashingState("vnode-ring"));
  const [error, setError] = useState<string | null>(null);
  const metrics = useMemo(() => state.metrics, [state.metrics]);

  const apply = useCallback((action: ConsistentHashingAction) => {
    try {
      setState(transitionConsistentHashing(state, action));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The hash-ring action could not be applied.");
    }
  }, [state]);

  const step = useCallback(() => apply({ type: "step" }), [apply]);
  const reset = useCallback(() => {
    setState(createConsistentHashingState(presetId));
    setError(null);
  }, [presetId]);
  const selectPreset = useCallback((nextPresetId: string) => {
    if (!isConsistentHashingPresetId(nextPresetId)) return;
    setPresetId(nextPresetId);
    setState(createConsistentHashingState(nextPresetId));
    setError(null);
  }, []);

  const simulationMetrics = toConsistentHashingSimulationMetrics(metrics);
  const events = state.events as readonly SimulationEvent[];

  return (
    <SimulationShell<ConsistentHashingState, ConsistentHashingAction>
      simulationId="consistent-hash-ring"
      lessonId={lessonId}
      title="Consistent hash-ring explorer"
      description="Compare modulo-N placement with a ring, then add a node, pause rollout, and inspect the movement plan."
      state={state}
      dispatch={apply}
      onStep={step}
      onReset={reset}
      onPresetChange={selectPreset}
      metrics={simulationMetrics}
      events={events}
      explanation={explanationFor(state, metrics)}
      summary={summaryFor(state, metrics)}
      presets={CONSISTENT_HASHING_PRESETS}
      presetId={presetId}
      isComplete={state.completion.completed}
      externalError={error}
      repository={repository}
      completionFactory={completionFactory}
      initialStatus={error ?? "Use Step to advance migration, or change membership and inspect the proposed ring."}
      controls={({ dispatch, announce }) => (
        <fieldset className="simulation-controls simulation-controls--hashing">
          <legend>Placement, membership, and migration controls</legend>
          <div className="simulation-control__selects">
            <label className="simulation-control">
              <span>Placement strategy</span>
              <select
                value={state.strategy}
                onChange={(event) => {
                  const strategy = event.target.value as HashStrategy;
                  dispatch({ type: "set-strategy", strategy });
                  announce(strategy === "ring" ? "Keys now choose a clockwise ring successor." : "Keys now use modulo-N placement.");
                }}
              >
                <option value="modulo">Modulo N</option>
                <option value="ring">Consistent ring</option>
              </select>
            </label>
            <label className="simulation-control">
              <span>Migration policy</span>
              <select
                value={state.migrationPolicy}
                onChange={(event) => {
                  const policy = event.target.value as MigrationPolicy;
                  dispatch({ type: "set-migration-policy", policy });
                  announce(policy === "durable-migration" ? "Durable migration requires copy and verification before cutover." : "Lazy refill defers moved-key reads to the origin.");
                }}
              >
                <option value="lazy-refill">Lazy refill</option>
                <option value="durable-migration">Durable migration</option>
              </select>
            </label>
          </div>
          <label className="simulation-control simulation-control--checkbox">
            <input
              type="checkbox"
              checked={state.vnodesEnabled}
              onChange={() => {
                dispatch({ type: "toggle-vnodes" });
                announce(state.vnodesEnabled ? "Virtual nodes disabled; one token remains per physical node." : "Virtual nodes enabled; ownership is split into smaller intervals.");
              }}
            />
            <span>Use virtual nodes</span>
          </label>
          <label className="simulation-control simulation-control--range" htmlFor="consistent-hashing-vnodes">
            <span>Virtual nodes per server</span>
            <output htmlFor="consistent-hashing-vnodes">{state.vnodeCount}</output>
            <input
              id="consistent-hashing-vnodes"
              type="range"
              min={1}
              max={64}
              step={1}
              value={state.vnodeCount}
              disabled={!state.vnodesEnabled}
              aria-valuetext={`${state.vnodeCount} virtual nodes per server`}
              onChange={(event) => {
                const count = Number(event.target.value);
                dispatch({ type: "set-vnode-count", count });
                announce(`Virtual-node count set to ${count}.`);
              }}
            />
          </label>
          <label className="simulation-control simulation-control--range" htmlFor="consistent-hashing-keys">
            <span>Keys in model</span>
            <output htmlFor="consistent-hashing-keys">{state.keyCount.toLocaleString("en-US")}</output>
            <input
              id="consistent-hashing-keys"
              type="range"
              min={10}
              max={1_000}
              step={10}
              value={Math.min(state.keyCount, 1_000)}
              aria-valuetext={`${state.keyCount.toLocaleString("en-US")} deterministic keys`}
              onChange={(event) => {
                const count = Number(event.target.value);
                dispatch({ type: "set-key-count", count });
                announce(`The model now aggregates ${count} keys.`);
              }}
            />
          </label>
          <label className="simulation-control simulation-control--range" htmlFor="consistent-hashing-hot-key">
            <span>Hot-key traffic</span>
            <output htmlFor="consistent-hashing-hot-key">{Math.round(state.hotKeyRate * 100)}%</output>
            <input
              id="consistent-hashing-hot-key"
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(state.hotKeyRate * 100)}
              aria-valuetext={`${Math.round(state.hotKeyRate * 100)} percent of traffic targets key zero`}
              onChange={(event) => {
                const rate = Number(event.target.value) / 100;
                dispatch({ type: "set-hot-key-rate", rate });
                announce(`Hot-key traffic set to ${Math.round(rate * 100)} percent.`);
              }}
            />
          </label>
          <div className="simulation-control__buttons" role="group" aria-label="Hash-ring membership actions">
            <button className="button button--secondary" type="button" onClick={() => {
              dispatch({ type: "add-server" });
              announce("Added a server to the proposed ring. Rollout is not committed yet.");
            }}>
              Add server
            </button>
            <label className="simulation-control">
              <span>Server to remove</span>
              <select
                value={state.currentNodeIds.at(-1) ?? ""}
                onChange={(event) => {
                  if (!event.target.value) return;
                  dispatch({ type: "remove-server", nodeId: event.target.value });
                  announce(`${event.target.value} is pending removal from the ring.`);
                }}
                disabled={state.currentNodeIds.length <= 1 || Boolean(state.pendingNodeIds)}
              >
                {state.currentNodeIds.map((nodeId) => <option key={nodeId} value={nodeId}>{nodeId}</option>)}
              </select>
            </label>
            <button className="button button--secondary" type="button" onClick={() => {
              const target = state.servers.find((server) => server.status === "active");
              if (!target) return;
              dispatch({ type: "fail-server", nodeId: target.id });
              announce(`${target.id} failed; inspect fallback ownership and migration.`);
            }} disabled={!state.servers.some((server) => server.status === "active")}>
              Fail owner
            </button>
            <button className="button button--secondary" type="button" onClick={() => {
              const target = state.servers.find((server) => server.status === "failed");
              if (!target) return;
              dispatch({ type: "recover-server", nodeId: target.id });
              announce(`${target.id} recovered; the committed ring still controls placement.`);
            }} disabled={!state.servers.some((server) => server.status === "failed")}>
              Recover owner
            </button>
            <button className="button button--secondary" type="button" onClick={() => {
              dispatch({ type: state.rolloutStatus === "paused" ? "resume-rollout" : "pause-rollout" });
              announce(state.rolloutStatus === "paused" ? "Ring rollout resumed." : "Ring rollout paused at the current version.");
            }} disabled={!state.pendingNodeIds}>
              {state.rolloutStatus === "paused" ? "Resume rollout" : "Pause rollout"}
            </button>
            <button className="button button--secondary" type="button" onClick={() => {
              dispatch({ type: "cutover" });
              announce("Ring cutover committed the proposed ownership map.");
            }} disabled={!state.pendingNodeIds || state.rolloutStatus === "paused" || (state.migrationPolicy === "durable-migration" && !state.migration.every((item) => item.status === "verified"))}>
              Cut over ring
            </button>
          </div>
        </fieldset>
      )}
    >
      <ConsistentHashingGraphic state={state} />
      <ConsistentHashingTable state={state} />
    </SimulationShell>
  );
}

function ConsistentHashingGraphic({ state }: { state: ConsistentHashingState }) {
  const titleId = "consistent-hashing-graphic-title";
  const tokens = state.tokens.slice(0, 256);
  const keys = state.assignments.slice(0, RENDERED_KEY_SAMPLE);
  return (
    <figure className="simulation-graphic simulation-graphic--ring">
      <svg viewBox="0 0 760 390" role="img" aria-labelledby={titleId}>
        <title id={titleId}>Consistent hash ring</title>
        <desc>
          Tokens are placed around a deterministic ring. Keys choose the next clockwise token; ownership is also
          listed in the text table below so this diagram does not require color or motion.
        </desc>
        <circle className="simulation-svg__ring" cx={RING_CENTER} cy={190} r={RING_RADIUS} />
        <text className="simulation-svg__caption" x={RING_CENTER} y={30} textAnchor="middle">
          {state.strategy === "ring" ? "Clockwise successor ownership" : "Modulo-N bucket ownership"}
        </text>
        {tokens.map((token) => {
          const point = ringPoint(token.position);
          return <circle className="simulation-svg__token" key={token.tokenId} cx={point.x} cy={point.y} r="3" />;
        })}
        {keys.map((assignment) => {
          const point = ringPoint(assignment.hash);
          return (
            <g key={assignment.keyId} className="simulation-svg__key">
              <line x1={RING_CENTER} y1={190} x2={point.x} y2={point.y} />
              <circle cx={point.x} cy={point.y} r="4" />
            </g>
          );
        })}
        <text className="simulation-svg__label" x={RING_CENTER} y={185} textAnchor="middle">{state.currentRingVersion}</text>
        <text className="simulation-svg__meta" x={RING_CENTER} y={204} textAnchor="middle">ring version</text>
        <text className="simulation-svg__caption" x={RING_CENTER} y={365} textAnchor="middle">
          Showing {Math.min(RENDERED_KEY_SAMPLE, state.assignments.length)} sampled keys of {state.assignments.length.toLocaleString("en-US")}; tables carry the full summary.
        </text>
      </svg>
      <figcaption>Tokens and sampled keys are visual aids; ownership, movement, and migration remain readable below.</figcaption>
    </figure>
  );
}

function ConsistentHashingTable({ state }: { state: ConsistentHashingState }) {
  const ownership = state.metrics.ownershipByNode;
  return (
    <div className="simulation-table-wrap">
      <table className="simulation-table">
        <caption>Physical ownership and node status</caption>
        <thead><tr><th scope="col">Node</th><th scope="col">Status</th><th scope="col">Primary keys</th><th scope="col">Share</th></tr></thead>
        <tbody>
          {state.servers.map((server) => {
            const count = ownership[server.id] ?? 0;
            const share = state.assignments.length > 0 ? (count / state.assignments.length) * 100 : 0;
            return (
              <tr key={server.id}>
                <th scope="row">{server.id}</th>
                <td>{statusLabel(server)}</td>
                <td>{count.toLocaleString("en-US")}</td>
                <td>{share.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot><tr><th scope="row" colSpan={3}>Pending migration</th><td>{state.metrics.pendingRemappedKeys.toLocaleString("en-US")} keys</td></tr></tfoot>
      </table>
      <p className="simulation-table__note">The ring has {state.tokens.length.toLocaleString("en-US")} tokens, {state.replicationFactor} replica factor, and rollout status “{state.rolloutStatus}”.</p>
    </div>
  );
}

function ringPoint(position: number): { x: number; y: number } {
  const angle = (position / HASH_SPACE_SIZE) * Math.PI * 2 - Math.PI / 2;
  return { x: RING_CENTER + Math.cos(angle) * RING_RADIUS, y: 190 + Math.sin(angle) * RING_RADIUS };
}

function statusLabel(server: ConsistentHashNode): string {
  return server.status === "active" ? "Active" : server.status === "failed" ? "Failed" : "Removed";
}

function explanationFor(state: ConsistentHashingState, metrics: ConsistentHashMetrics): string {
  if (state.strategy === "modulo") return "Modulo-N is simple and fast while membership is fixed, but changing the divisor changes most bucket assignments.";
  if (state.pendingNodeIds) return state.migrationPolicy === "durable-migration"
    ? "The new ring localizes movement, but durable data still needs copy, verification, and a safe cutover."
    : "A ring limits movement to local intervals; lazy refill still sends moved cache keys back to the origin.";
  if (metrics.hotNodeQps > metrics.totalTrafficQps / Math.max(1, metrics.activeNodeCount)) return "Virtual nodes smooth ownership variance, but one hot key can still concentrate traffic on one physical owner.";
  return "Consistent hashing limits membership-change remapping. Vnodes improve statistical balance; neither guarantees equal QPS or strong consistency.";
}

function summaryFor(state: ConsistentHashingState, metrics: ConsistentHashMetrics): string {
  const strategy = state.strategy === "ring" ? "ring" : "modulo-N";
  return `${strategy} placement maps ${metrics.keyCount.toLocaleString("en-US")} keys across ${metrics.activeNodeCount} active nodes; ${(metrics.remappedFraction * 100).toFixed(1)}% are remapped from the previous committed map and the hottest node serves ${metrics.hotNodeQps.toFixed(1)} QPS.`;
}

function isConsistentHashingPresetId(value: string): value is ConsistentHashingPresetId {
  return CONSISTENT_HASHING_PRESETS.some((preset) => preset.id === value);
}
