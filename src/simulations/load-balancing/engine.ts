import type { SimulationEvent, SimulationEventTone } from "@/simulations/types";

import { getLoadBalancingPreset } from "./presets";
import {
  LOAD_BALANCING_POLICY_IDS,
  type LoadBalancingAction,
  type LoadBalancingConfig,
  type LoadBalancingHistoryPoint,
  type LoadBalancingMetrics,
  type LoadBalancingNode,
  type LoadBalancingNodeMetrics,
  type LoadBalancingNodeStatus,
  type LoadBalancingPolicy,
  type LoadBalancingPolicyComparison,
  type LoadBalancingPresetId,
  type LoadBalancingRemapping,
  type LoadBalancingRequestResult,
  type LoadBalancingState,
  type LoadBalancingTraceRequest,
  type LoadBalancingTransition,
  LoadBalancingValidationError,
} from "./types";

const MAX_EVENTS = 64;
const MAX_HISTORY = 24;
const MAX_RECENT_RESULTS = 24;
const MAX_LATENCY_SAMPLES = 512;
const DEFAULT_TRACE_LENGTH = 120;
const CONSISTENT_HASH_TOKENS_PER_NODE = 64;

const POLICY_LABELS: Record<LoadBalancingPolicy, string> = {
  "round-robin": "Round robin",
  "weighted-round-robin": "Weighted round robin",
  "least-connections": "Least connections",
  "least-outstanding": "Least outstanding",
  "latency-aware": "Latency aware",
  random: "Deterministic random",
  "key-hash": "Key hash",
};

interface RuntimeNode {
  id: string;
  weight: number;
  status: LoadBalancingNodeStatus;
  assignments: number;
  workMs: number;
  queueDepth: number;
  rejectedRequests: number;
  activeConnections: Set<string>;
  latencySamples: number[];
  reportedLatencyMs: number;
  pendingLatencyObservations: Array<{ availableTick: number; latencyMs: number }>;
  outstanding: number;
  tickWorkMs: number;
  utilization: number;
}

interface Evaluation {
  results: LoadBalancingRequestResult[];
  nodes: Map<string, RuntimeNode>;
  servedRequests: number;
  rejectedRequests: number;
  totalWorkMs: number;
  latencies: number[];
  queueDepth: number;
  maxUtilization: number;
  hotKeyRequests: number;
  hotKeyNodeId: string | null;
  hotKeyShare: number;
  connectionRemaps: number;
  keyOwners: Map<string, string>;
}

interface SelectionContext {
  roundRobinCursor: number;
  weightedCurrent: Map<string, number>;
  connectionOwners: Map<string, string>;
  hashRing: ConsistentHashToken[];
}

interface ConsistentHashToken {
  nodeId: string;
  position: number;
  tokenId: string;
}

interface TransitionContext {
  state: LoadBalancingState;
  events: SimulationEvent[];
}

/**
 * Fixed FNV-1a over UTF-8 code points.  Hashing is deliberately implemented
 * here rather than using a runtime/browser API so key placement is identical
 * in tests, SSR, and the browser.
 */
export function fixedHash32(value: string): number {
  let hash = 2_166_136_261;
  for (const symbol of value) {
    const codePoint = symbol.codePointAt(0) ?? 0;
    const bytes = codePoint <= 0x7f
      ? [codePoint]
      : codePoint <= 0x7ff
        ? [0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f)]
        : codePoint <= 0xffff
          ? [0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f)]
          : [0xf0 | (codePoint >> 18), 0x80 | ((codePoint >> 12) & 0x3f), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f)];
    for (const byte of bytes) {
      hash ^= byte;
      hash = Math.imul(hash, 16_777_619);
    }
  }
  return hash >>> 0;
}

function createRandom(seed: number): () => number {
  let value = (seed >>> 0) || 1;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4_294_967_296;
  };
}

function seededNumber(seed: number, index: number): number {
  const value = Math.imul((seed >>> 0) || 1, (index + 1) | 0) ^ 0x9e3779b9;
  return createRandom(value >>> 0)();
}

export function generateLoadBalancingTrace(
  seed: number,
  length = DEFAULT_TRACE_LENGTH,
  requestsPerStep = 12,
  presetId: LoadBalancingPresetId = "mixed-checkout-work",
): LoadBalancingTraceRequest[] {
  assertPositiveInteger(length, "Trace length");
  assertPositiveInteger(requestsPerStep, "Requests per step");
  const random = createRandom(seed);
  const trace: LoadBalancingTraceRequest[] = [];

  for (let index = 0; index < length; index += 1) {
    const kindRoll = random();
    const workRoll = random();
    const hotKeyRoll = random();
    const connectionNumber = presetId === "connection-skew"
      ? index % 6
      : index % 18;
    let kind: LoadBalancingTraceRequest["kind"] = "cart-read";
    let workMs = 12 + Math.floor(workRoll * 20);

    if (presetId === "celebrity-cache-key") {
      kind = "cache-read";
      workMs = 8 + Math.floor(workRoll * 24);
    } else if (presetId === "connection-skew") {
      if (kindRoll < 0.18) {
        kind = "payment-call";
        workMs = 380 + Math.floor(workRoll * 480);
      } else if (kindRoll < 0.45) {
        kind = "inventory-write";
        workMs = 75 + Math.floor(workRoll * 130);
      } else {
        kind = "cart-read";
        workMs = 16 + Math.floor(workRoll * 40);
      }
    } else if (kindRoll >= 0.83 && kindRoll < 0.95) {
      kind = "inventory-write";
      workMs = 80 + Math.floor(workRoll * 140);
    } else if (kindRoll >= 0.95) {
      kind = "payment-call";
      workMs = 640 + Math.floor(workRoll * 900);
    }

    trace.push({
      id: `request-${index + 1}`,
      tick: Math.floor(index / requestsPerStep),
      connectionId: `connection-${connectionNumber + 1}`,
      key: presetId === "celebrity-cache-key"
        ? `cache-key-${index % 28}`
        : `checkout-key-${index % 36}`,
      hotKeyRoll,
      workMs,
      kind,
    });
  }

  return trace;
}

export function createLoadBalancingState(
  presetId: LoadBalancingPresetId,
): LoadBalancingState {
  const preset = getLoadBalancingPreset(presetId);
  const trace = generateLoadBalancingTrace(
    preset.config.randomSeed,
    preset.traceLength,
    preset.config.requestsPerStep,
    preset.id,
  );
  const state: LoadBalancingState = {
    schemaVersion: 1,
    presetId: preset.id,
    tick: 0,
    traceCursor: 0,
    config: { ...preset.config },
    nodes: preset.nodes.map((node) => createNode(node.id, node.weight)),
    trace,
    results: [],
    history: [],
    nextNodeNumber: nextNodeNumber(preset.nodes.map((node) => node.id)),
    eventSequence: 0,
    remapping: {
      movedKeys: 0,
      totalKeys: uniqueEffectiveKeys(trace, preset.config).length,
      fraction: 0,
    },
    progress: {
      traceCompleted: false,
      topologyChanged: false,
      comparisonObserved: false,
      completed: false,
    },
    events: [],
  };
  return state;
}

function createNode(id: string, weight: number): LoadBalancingNode {
  return {
    id,
    weight,
    status: "active",
    assignments: 0,
    workMs: 0,
    queueDepth: 0,
    utilization: 0,
    rejectedRequests: 0,
    activeConnections: 0,
    p95LatencyMs: 0,
  };
}

function nextNodeNumber(ids: readonly string[]): number {
  let highest = 0;
  for (const id of ids) {
    const match = id.match(/(\d+)$/);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return highest + 1;
}

export function getLoadBalancingPolicyLabel(policy: LoadBalancingPolicy): string {
  return POLICY_LABELS[policy];
}

export function loadBalancingMetrics(state: LoadBalancingState): LoadBalancingMetrics {
  assertLoadBalancingState(state);
  const selected = evaluatePolicy(state.trace, state.config, state.nodes, state.traceCursor);
  const comparisons = LOAD_BALANCING_POLICY_IDS.map((policy) => {
    const evaluation = evaluatePolicy(
      state.trace,
      { ...state.config, policy },
      state.nodes,
      state.traceCursor,
    );
    return comparisonFor(policy, evaluation, state.remapping);
  });
  return metricsFor(state, selected, comparisons);
}

/**
 * Replay the exact same request trace using every policy.  The returned array
 * is stable and serializable, making it useful for tests and for the UI's
 * comparison table.
 */
export function compareLoadBalancingPolicies(
  trace: readonly LoadBalancingTraceRequest[],
  config: LoadBalancingConfig,
  nodes: readonly LoadBalancingNode[],
  requestLimit = trace.length,
): LoadBalancingPolicyComparison[] {
  return LOAD_BALANCING_POLICY_IDS.map((policy) => comparisonFor(
    policy,
    evaluatePolicy(trace, { ...config, policy }, nodes, requestLimit),
    { movedKeys: 0, totalKeys: 0, fraction: 0 },
  ));
}

/**
 * Public trace evaluator for focused tests and future lesson renderers.  It
 * intentionally returns only plain data; internal Set instances never escape.
 */
export function evaluateLoadBalancingTrace(
  trace: readonly LoadBalancingTraceRequest[],
  config: LoadBalancingConfig,
  nodes: readonly LoadBalancingNode[],
  requestLimit = trace.length,
): {
  results: LoadBalancingRequestResult[];
  nodeMetrics: LoadBalancingNodeMetrics[];
  servedRequests: number;
  rejectedRequests: number;
  latencyP95Ms: number;
  latencyP99Ms: number;
  maxUtilization: number;
  remappedFraction: number;
} {
  const evaluation = evaluatePolicy(trace, config, nodes, requestLimit);
  return {
    results: evaluation.results,
    nodeMetrics: nodeMetricsFor(evaluation, nodes, config, requestLimit),
    servedRequests: evaluation.servedRequests,
    rejectedRequests: evaluation.rejectedRequests,
    latencyP95Ms: percentile(evaluation.latencies, 0.95),
    latencyP99Ms: percentile(evaluation.latencies, 0.99),
    maxUtilization: evaluation.maxUtilization,
    remappedFraction: 0,
  };
}

export function transitionLoadBalancing(
  input: LoadBalancingState,
  action: LoadBalancingAction,
): LoadBalancingTransition {
  assertLoadBalancingState(input);
  const state = cloneState(input);
  if (!action || typeof action !== "object" || typeof action.type !== "string") {
    throw new LoadBalancingValidationError("Load-balancing action must contain a type.");
  }
  if (action.type === "reset") {
    const reset = createLoadBalancingState(state.presetId);
    return { state: reset, events: [], metrics: loadBalancingMetrics(reset) };
  }

  const context: TransitionContext = { state, events: [] };
  const topologyAction = action.type === "add-node"
    || action.type === "remove-node"
    || action.type === "fail-node"
    || action.type === "recover-node";
  const beforeActiveIds = activeNodeIds(state.nodes);

  switch (action.type) {
    case "step":
      stepState(context);
      break;
    case "set-policy":
      assertPolicy(action.policy);
      state.config.policy = action.policy;
      emit(context, "control-changed", "Policy changed", `Using ${POLICY_LABELS[action.policy]}.`, "info");
      break;
    case "set-selection-unit":
      assertSelectionUnit(action.unit);
      state.config.selectionUnit = action.unit;
      emit(context, "control-changed", "Selection unit changed", `The balancer now selects per ${action.unit}.`, "info");
      break;
    case "set-hot-key-probability":
      assertFraction(action.probability, "Hot-key probability");
      state.config.hotKeyProbability = action.probability;
      emit(context, "control-changed", "Hot-key probability changed", `Hot-key traffic is now ${Math.round(action.probability * 100)}%.`, "info");
      break;
    case "set-hot-key-rate":
      assertFraction(action.rate, "Hot-key probability");
      state.config.hotKeyProbability = action.rate;
      emit(context, "control-changed", "Hot-key probability changed", `Hot-key traffic is now ${Math.round(action.rate * 100)}%.`, "info");
      break;
    case "set-metric-delay":
      assertRangeInteger(action.ticks, 0, 5, "Metric delay");
      state.config.metricDelayTicks = action.ticks;
      emit(context, "control-changed", "Metric delay changed", `Load signals are delayed by ${action.ticks} tick${action.ticks === 1 ? "" : "s"}.`, "info");
      break;
    case "set-node-weight":
      setNodeWeight(state, action.nodeId, action.weight);
      emit(context, "control-changed", "Node capacity changed", `${action.nodeId} now has weight ${action.weight}.`, "info");
      break;
    case "add-node":
      addNode(context, action.weight);
      break;
    case "remove-node":
      removeNode(context, action.nodeId);
      break;
    case "fail-node":
      setNodeStatus(context, action.nodeId, "failed");
      break;
    case "recover-node":
      setNodeStatus(context, action.nodeId, "active");
      break;
    default:
      assertNever(action);
  }

  if (topologyAction) {
    const afterActiveIds = activeNodeIds(state.nodes);
    state.remapping = calculateKeyRemapping(state.trace, state.config, beforeActiveIds, afterActiveIds);
    state.progress.topologyChanged = true;
    if (state.remapping.movedKeys > 0) {
      emit(
        context,
        "key-remapped",
        "Key ownership changed",
        `${state.remapping.movedKeys} of ${state.remapping.totalKeys} modeled keys move under a hash ring change.`,
        "warning",
      );
    }
  }

  applyDerivedState(state);
  updateProgress(state);
  state.events.push(...context.events);
  state.events = state.events.slice(-MAX_EVENTS);
  const metrics = loadBalancingMetrics(state);
  return { state, events: context.events, metrics };
}

function stepState(context: TransitionContext): void {
  const { state } = context;
  if (state.traceCursor >= state.trace.length) {
    emit(context, "trace-complete", "Trace complete", "The full request trace has already been replayed.", "success");
    return;
  }

  const beforeCursor = state.traceCursor;
  state.traceCursor = Math.min(
    state.trace.length,
    state.traceCursor + state.config.requestsPerStep,
  );
  state.tick += 1;
  const evaluation = evaluatePolicy(state.trace, state.config, state.nodes, state.traceCursor);
  const point = historyPoint(state.tick, evaluation, state.nodes, state.config);
  state.history = [...state.history, point].slice(-MAX_HISTORY);

  emit(
    context,
    "trace-step",
    `Requests ${beforeCursor + 1}–${state.traceCursor} replayed`,
    `${evaluation.servedRequests} served and ${evaluation.rejectedRequests} rejected so far under ${POLICY_LABELS[state.config.policy]}.`,
    evaluation.rejectedRequests > 0 ? "warning" : "info",
  );
  if (evaluation.rejectedRequests > 0) {
    emit(
      context,
      "requests-rejected",
      "Requests rejected",
      `${evaluation.rejectedRequests} requests exceeded node capacity or queue space.`,
      "failure",
    );
  }
  if (evaluation.hotKeyRequests > 0 && evaluation.hotKeyShare >= 0.5) {
    emit(
      context,
      "hot-key-concentrated",
      "Hot key concentrated",
      `${Math.round(evaluation.hotKeyShare * 100)}% of hot-key requests use ${evaluation.hotKeyNodeId ?? "one node"}.`,
      "warning",
    );
  }
  if (state.traceCursor >= state.trace.length) {
    emit(context, "trace-complete", "Trace complete", "The same workload can now be compared across all policies.", "success");
  }
}

function setNodeWeight(state: LoadBalancingState, nodeId: string, weight: number): void {
  assertRangeInteger(weight, 1, 4, "Node weight");
  const node = state.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) throw new LoadBalancingValidationError(`Unknown node ID: ${nodeId}.`);
  if (node.status === "removed") throw new LoadBalancingValidationError(`Removed node ${nodeId} cannot receive a new weight.`);
  node.weight = weight;
}

function addNode(context: TransitionContext, requestedWeight: number | undefined): void {
  const { state } = context;
  const weight = requestedWeight === undefined ? 1 : requestedWeight;
  assertRangeInteger(weight, 1, 4, "Node weight");
  const id = `node-${state.nextNodeNumber}`;
  state.nextNodeNumber += 1;
  state.nodes.push(createNode(id, weight));
  emit(context, "node-added", `${id} added`, `${id} is active and eligible for new work.`, "success");
}

function removeNode(context: TransitionContext, nodeId: string): void {
  const node = findNode(context.state, nodeId);
  if (node.status === "removed") throw new LoadBalancingValidationError(`Node ${nodeId} is already removed.`);
  node.status = "removed";
  emit(context, "node-removed", `${nodeId} removed`, `${nodeId} is no longer eligible for new assignments.`, "warning");
}

function setNodeStatus(
  context: TransitionContext,
  nodeId: string,
  status: Extract<LoadBalancingNodeStatus, "active" | "failed">,
): void {
  const node = findNode(context.state, nodeId);
  if (node.status === "removed") throw new LoadBalancingValidationError(`Removed node ${nodeId} cannot be recovered.`);
  node.status = status;
  emit(
    context,
    status === "failed" ? "node-failed" : "node-recovered",
    status === "failed" ? `${nodeId} failed` : `${nodeId} recovered`,
    status === "failed" ? `${nodeId} is removed from the eligible set.` : `${nodeId} is eligible for new assignments again.`,
    status === "failed" ? "failure" : "success",
  );
}

function findNode(state: LoadBalancingState, nodeId: string): LoadBalancingNode {
  const node = state.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) throw new LoadBalancingValidationError(`Unknown node ID: ${nodeId}.`);
  return node;
}

function applyDerivedState(state: LoadBalancingState): void {
  const evaluation = evaluatePolicy(state.trace, state.config, state.nodes, state.traceCursor);
  state.results = evaluation.results;
  const derived = nodeMetricsFor(evaluation, state.nodes, state.config, state.traceCursor);
  state.nodes = state.nodes.map((node) => {
    const next = derived.find((candidate) => candidate.nodeId === node.id);
    return next
      ? {
          ...node,
          assignments: next.assignments,
          workMs: next.workMs,
          queueDepth: next.queueDepth,
          utilization: next.utilization,
          rejectedRequests: next.rejectedRequests,
          activeConnections: next.activeConnections,
          p95LatencyMs: next.p95LatencyMs,
        }
      : node;
  });
}

function updateProgress(state: LoadBalancingState): void {
  const evaluation = evaluatePolicy(state.trace, state.config, state.nodes, state.traceCursor);
  const comparisons = LOAD_BALANCING_POLICY_IDS.map((policy) => evaluatePolicy(
    state.trace,
    { ...state.config, policy },
    state.nodes,
    state.traceCursor,
  ));
  const hasDifference = comparisons.some((candidate) => candidate.servedRequests !== evaluation.servedRequests
    || Math.abs(percentile(candidate.latencies, 0.95) - percentile(evaluation.latencies, 0.95)) > 0.01
    || Math.abs(candidate.maxUtilization - evaluation.maxUtilization) > 0.01);
  state.progress.traceCompleted = state.traceCursor >= state.trace.length;
  state.progress.comparisonObserved = state.progress.comparisonObserved || hasDifference;
  state.progress.completed = state.progress.traceCompleted && state.progress.comparisonObserved;
}

function emit(
  context: TransitionContext,
  type: string,
  title: string,
  detail: string,
  tone: SimulationEventTone,
): void {
  const { state } = context;
  state.eventSequence += 1;
  context.events.push({
    id: `load-balancing-event-${state.eventSequence}`,
    tick: state.tick,
    type,
    title,
    detail,
    tone,
  });
}

function metricsFor(
  state: LoadBalancingState,
  evaluation: Evaluation,
  comparisons: LoadBalancingPolicyComparison[],
): LoadBalancingMetrics {
  const latencies = evaluation.latencies;
  const totalRequests = evaluation.servedRequests + evaluation.rejectedRequests;
  const nodeMetrics = nodeMetricsFor(evaluation, state.nodes, state.config, state.traceCursor);
  return {
    tick: state.tick,
    traceCursor: state.traceCursor,
    traceLength: state.trace.length,
    policy: state.config.policy,
    selectionUnit: state.config.selectionUnit,
    servedRequests: evaluation.servedRequests,
    rejectedRequests: evaluation.rejectedRequests,
    rejectionRate: totalRequests === 0 ? 0 : evaluation.rejectedRequests / totalRequests,
    totalWorkMs: evaluation.totalWorkMs,
    averageLatencyMs: mean(latencies),
    latencyP50Ms: percentile(latencies, 0.5),
    latencyP95Ms: percentile(latencies, 0.95),
    latencyP99Ms: percentile(latencies, 0.99),
    maxLatencyMs: latencies.length > 0 ? Math.max(...latencies) : 0,
    queueDepth: evaluation.queueDepth,
    maxUtilization: evaluation.maxUtilization,
    activeNodeCount: state.nodes.filter((node) => node.status === "active").length,
    failedNodeCount: state.nodes.filter((node) => node.status === "failed").length,
    hotKeyRequests: evaluation.hotKeyRequests,
    hotKeyNodeId: evaluation.hotKeyNodeId,
    hotKeyShare: evaluation.hotKeyShare,
    remappedKeyCount: state.remapping.movedKeys,
    remappedKeyFraction: state.remapping.fraction,
    connectionRemaps: evaluation.connectionRemaps,
    overloaded: evaluation.rejectedRequests > 0 || evaluation.queueDepth > 0,
    nodeMetrics,
    comparisons,
    recentResults: evaluation.results.slice(-MAX_RECENT_RESULTS),
    history: state.history,
  };
}

function comparisonFor(
  policy: LoadBalancingPolicy,
  evaluation: Evaluation,
  remapping: LoadBalancingRemapping,
): LoadBalancingPolicyComparison {
  const activeRuntimes = [...evaluation.nodes.values()].filter((node) => node.status === "active");
  const workValues = activeRuntimes.map((node) => node.workMs).filter((value) => value > 0);
  const workSkew = workValues.length === 0 ? 0 : Math.max(...workValues) / mean(workValues);
  return {
    policy,
    label: POLICY_LABELS[policy],
    servedRequests: evaluation.servedRequests,
    rejectedRequests: evaluation.rejectedRequests,
    p95LatencyMs: percentile(evaluation.latencies, 0.95),
    p99LatencyMs: percentile(evaluation.latencies, 0.99),
    maxUtilization: evaluation.maxUtilization,
    workSkew,
    remappedFraction: remapping.fraction,
  };
}

function evaluatePolicy(
  trace: readonly LoadBalancingTraceRequest[],
  config: LoadBalancingConfig,
  nodes: readonly LoadBalancingNode[],
  requestLimit: number,
): Evaluation {
  assertConfig(config);
  const limit = Math.max(0, Math.min(trace.length, Math.floor(requestLimit)));
  const runtimes = new Map<string, RuntimeNode>();
  const sortedNodes = [...nodes].sort(compareNodes);
  for (const node of sortedNodes) {
    runtimes.set(node.id, {
      id: node.id,
      weight: node.weight,
      status: node.status,
      assignments: 0,
      workMs: 0,
      queueDepth: 0,
      rejectedRequests: 0,
      activeConnections: new Set<string>(),
      latencySamples: [],
      reportedLatencyMs: config.baseLatencyMs,
      pendingLatencyObservations: [],
      outstanding: 0,
      tickWorkMs: 0,
      utilization: 0,
    });
  }

  const results: LoadBalancingRequestResult[] = [];
  const latencies: number[] = [];
  const selection: SelectionContext = {
    roundRobinCursor: 0,
    weightedCurrent: new Map(sortedNodes.map((node) => [node.id, 0])),
    connectionOwners: new Map(),
    hashRing: buildConsistentHashRing(sortedNodes.filter((node) => node.status === "active").map((node) => node.id)),
  };
  const keyOwners = new Map<string, string>();
  const hotKeyAssignments = new Map<string, number>();
  let servedRequests = 0;
  let rejectedRequests = 0;
  let totalWorkMs = 0;
  let connectionRemaps = 0;
  let currentTick = -1;

  for (let index = 0; index < limit; index += 1) {
    const request = trace[index];
    if (request.tick !== currentTick) {
      advanceRuntimeTick(runtimes, request.tick - currentTick, config);
      currentTick = request.tick;
    }
    releaseLatencyObservations(runtimes, currentTick, config.baseLatencyMs);
    const isHotKey = request.hotKeyRoll < config.hotKeyProbability;
    const key = isHotKey ? "celebrity-key" : request.key;
    const eligible = sortedNodes
      .filter((node) => node.status === "active")
      .map((node) => runtimes.get(node.id)!)
      .filter(Boolean);
    let selected: RuntimeNode | null = null;
    if (eligible.length > 0 && config.selectionUnit === "connection") {
      const pinnedId = selection.connectionOwners.get(request.connectionId);
      const pinned = pinnedId ? runtimes.get(pinnedId) : undefined;
      if (pinned?.status === "active") {
        selected = pinned;
      } else {
        if (pinnedId) connectionRemaps += 1;
        selected = chooseNode(config.policy, eligible, runtimes, selection, request, key, index, config);
        if (selected) selection.connectionOwners.set(request.connectionId, selected.id);
      }
    } else if (eligible.length > 0) {
      selected = chooseNode(config.policy, eligible, runtimes, selection, request, key, index, config);
    }

    if (!selected) {
      rejectedRequests += 1;
      results.push({
        requestId: request.id,
        tick: request.tick,
        connectionId: request.connectionId,
        key,
        isHotKey,
        nodeId: null,
        status: "rejected",
        workMs: request.workMs,
        latencyMs: 0,
        reason: "no-healthy-nodes",
      });
      continue;
    }

    const capacity = config.nodeCapacityWorkMs * selected.weight;
    const projectedWork = selected.tickWorkMs + request.workMs;
    const projectedQueue = Math.max(
      0,
      Math.ceil((projectedWork - capacity) / Math.max(1, config.outstandingWorkUnitMs)),
    );
    if (projectedQueue > config.queueCapacity) {
      rejectedRequests += 1;
      selected.rejectedRequests += 1;
      selected.queueDepth = config.queueCapacity;
      results.push({
        requestId: request.id,
        tick: request.tick,
        connectionId: request.connectionId,
        key,
        isHotKey,
        nodeId: selected.id,
        status: "rejected",
        workMs: request.workMs,
        latencyMs: 0,
        reason: "queue-overflow",
      });
      continue;
    }

    const latencyMs = modeledLatency(config, request.workMs, projectedQueue, projectedWork / capacity);
    selected.assignments += 1;
    selected.workMs += request.workMs;
    selected.tickWorkMs = projectedWork;
    selected.queueDepth = projectedQueue;
    selected.outstanding += Math.max(0.25, request.workMs / Math.max(1, config.outstandingWorkUnitMs));
    selected.activeConnections.add(request.connectionId);
    selected.latencySamples = [...selected.latencySamples, latencyMs].slice(-MAX_LATENCY_SAMPLES);
    selected.pendingLatencyObservations.push({
      availableTick: request.tick + config.metricDelayTicks,
      latencyMs,
    });
    selected.utilization = utilizationFor(selected, config, Math.max(1, currentTick + 1));
    servedRequests += 1;
    totalWorkMs += request.workMs;
    latencies.push(latencyMs);
    keyOwners.set(key, selected.id);
    if (isHotKey) hotKeyAssignments.set(selected.id, (hotKeyAssignments.get(selected.id) ?? 0) + 1);
    results.push({
      requestId: request.id,
      tick: request.tick,
      connectionId: request.connectionId,
      key,
      isHotKey,
      nodeId: selected.id,
      status: "served",
      workMs: request.workMs,
      latencyMs,
      reason: "none",
    });
  }

  const hotKeyRequests = [...hotKeyAssignments.values()].reduce((sum, count) => sum + count, 0);
  const hotKeyNodeId = hotKeyRequests === 0
    ? null
    : [...hotKeyAssignments.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? null;
  const hotKeyNodeCount = hotKeyNodeId ? hotKeyAssignments.get(hotKeyNodeId) ?? 0 : 0;
  const queueDepth = [...runtimes.values()]
    .filter((node) => node.status === "active")
    .reduce((sum, node) => sum + node.queueDepth, 0);
  const activeUtilizations = [...runtimes.values()]
    .filter((node) => node.status === "active")
    .map((node) => node.utilization);

  return {
    results,
    nodes: runtimes,
    servedRequests,
    rejectedRequests,
    totalWorkMs,
    latencies,
    queueDepth,
    maxUtilization: activeUtilizations.length > 0 ? Math.max(...activeUtilizations) : 0,
    hotKeyRequests,
    hotKeyNodeId,
    hotKeyShare: hotKeyRequests === 0 ? 0 : hotKeyNodeCount / hotKeyRequests,
    connectionRemaps,
    keyOwners,
  };
}

function chooseNode(
  policy: LoadBalancingPolicy,
  eligible: RuntimeNode[],
  runtimes: Map<string, RuntimeNode>,
  selection: SelectionContext,
  request: LoadBalancingTraceRequest,
  key: string,
  index: number,
  config: LoadBalancingConfig,
): RuntimeNode {
  if (policy === "round-robin") {
    const selected = eligible[selection.roundRobinCursor % eligible.length];
    selection.roundRobinCursor = (selection.roundRobinCursor + 1) % eligible.length;
    return selected;
  }
  if (policy === "weighted-round-robin") {
    let totalWeight = 0;
    for (const node of eligible) {
      const current = (selection.weightedCurrent.get(node.id) ?? 0) + node.weight;
      selection.weightedCurrent.set(node.id, current);
      totalWeight += node.weight;
    }
    const selected = [...eligible].sort((left, right) => {
      const difference = (selection.weightedCurrent.get(right.id) ?? 0) - (selection.weightedCurrent.get(left.id) ?? 0);
      return difference || left.id.localeCompare(right.id);
    })[0];
    selection.weightedCurrent.set(selected.id, (selection.weightedCurrent.get(selected.id) ?? 0) - totalWeight);
    return selected;
  }
  if (policy === "least-connections") {
    return [...eligible].sort((left, right) =>
      left.activeConnections.size - right.activeConnections.size
      || left.outstanding - right.outstanding
      || left.id.localeCompare(right.id))[0];
  }
  if (policy === "least-outstanding") {
    return [...eligible].sort((left, right) =>
      (left.outstanding + left.queueDepth) - (right.outstanding + right.queueDepth)
      || left.activeConnections.size - right.activeConnections.size
      || left.id.localeCompare(right.id))[0];
  }
  if (policy === "latency-aware") {
    return [...eligible].sort((left, right) => {
      const leftScore = ((left.reportedLatencyMs || config.baseLatencyMs) * (1 + left.outstanding * 0.12)) / left.weight;
      const rightScore = ((right.reportedLatencyMs || config.baseLatencyMs) * (1 + right.outstanding * 0.12)) / right.weight;
      return leftScore - rightScore || left.id.localeCompare(right.id);
    })[0];
  }
  if (policy === "random") {
    const randomIndex = Math.floor(seededNumber(config.randomSeed ^ fixedHash32(request.id), index) * eligible.length);
    return eligible[Math.min(eligible.length - 1, randomIndex)];
  }
  const ownerId = ownerForConsistentHash(key, selection.hashRing);
  return (ownerId ? runtimes.get(ownerId) : undefined) ?? eligible[0];
}

function advanceRuntimeTick(
  runtimes: Map<string, RuntimeNode>,
  ticksElapsed: number,
  config: LoadBalancingConfig,
): void {
  const elapsed = Math.max(1, ticksElapsed);
  for (const runtime of runtimes.values()) {
    const capacityUnits = config.nodeCapacityWorkMs * runtime.weight / Math.max(1, config.outstandingWorkUnitMs);
    runtime.outstanding = Math.max(0, runtime.outstanding - capacityUnits * elapsed);
    runtime.queueDepth = Math.max(0, runtime.queueDepth - Math.ceil(capacityUnits * elapsed / 2));
    runtime.tickWorkMs = 0;
  }
}

function releaseLatencyObservations(
  runtimes: Map<string, RuntimeNode>,
  currentTick: number,
  baseLatencyMs: number,
): void {
  for (const runtime of runtimes.values()) {
    const ready = runtime.pendingLatencyObservations.filter((observation) => observation.availableTick <= currentTick);
    runtime.pendingLatencyObservations = runtime.pendingLatencyObservations.filter(
      (observation) => observation.availableTick > currentTick,
    );
    for (const observation of ready) {
      runtime.reportedLatencyMs = runtime.reportedLatencyMs === baseLatencyMs
        ? observation.latencyMs
        : (runtime.reportedLatencyMs + observation.latencyMs) / 2;
    }
  }
}

function modeledLatency(
  config: LoadBalancingConfig,
  workMs: number,
  queueDepth: number,
  utilization: number,
): number {
  return Math.round(
    config.baseLatencyMs
    + workMs
    + queueDepth * 16
    + Math.max(0, utilization - 1) * 120,
  );
}

function nodeMetricsFor(
  evaluation: Evaluation,
  nodes: readonly LoadBalancingNode[],
  config: LoadBalancingConfig,
  requestLimit: number,
): LoadBalancingNodeMetrics[] {
  const observedTicks = Math.max(1, observedTickCount(requestLimit, nodes, config));
  return [...nodes].sort(compareNodes).map((node) => {
    const runtime = evaluation.nodes.get(node.id);
    if (!runtime) {
      return {
        nodeId: node.id,
        status: node.status,
        assignments: 0,
        workMs: 0,
        queueDepth: 0,
        utilization: 0,
        rejectedRequests: 0,
        activeConnections: 0,
        p95LatencyMs: 0,
      };
    }
    return {
      nodeId: node.id,
      status: node.status,
      assignments: runtime.assignments,
      workMs: runtime.workMs,
      queueDepth: runtime.queueDepth,
      utilization: runtime.workMs / Math.max(1, config.nodeCapacityWorkMs * runtime.weight * observedTicks),
      rejectedRequests: runtime.rejectedRequests,
      activeConnections: runtime.activeConnections.size,
      p95LatencyMs: percentile(runtime.latencySamples, 0.95),
    };
  });
}

function observedTickCount(
  requestLimit: number,
  nodes: readonly LoadBalancingNode[],
  config: LoadBalancingConfig,
): number {
  // The node argument is intentionally part of this helper's signature so
  // future capacity modes can use topology metadata without changing callers.
  void nodes;
  return Math.max(1, Math.ceil(Math.max(0, requestLimit) / Math.max(1, config.requestsPerStep)));
}

function utilizationFor(
  runtime: RuntimeNode,
  config: LoadBalancingConfig,
  observedTicks: number,
): number {
  return runtime.workMs / Math.max(1, config.nodeCapacityWorkMs * runtime.weight * observedTicks);
}

function historyPoint(
  tick: number,
  evaluation: Evaluation,
  nodes: readonly LoadBalancingNode[],
  config: LoadBalancingConfig,
): LoadBalancingHistoryPoint {
  const activeNodes = nodes.filter((node) => node.status === "active");
  return {
    tick,
    servedRequests: evaluation.servedRequests,
    rejectedRequests: evaluation.rejectedRequests,
    p95LatencyMs: percentile(evaluation.latencies, 0.95),
    queueDepth: evaluation.queueDepth,
    maxUtilization: activeNodes.length === 0
      ? 0
      : Math.max(...nodeMetricsFor(evaluation, nodes, config, tick).filter((node) => node.status === "active").map((node) => node.utilization)),
  };
}

export function buildLoadBalancingHashRing(
  nodeIds: readonly string[],
): Array<{ nodeId: string; position: number; tokenId: string }> {
  return buildConsistentHashRing(nodeIds).map((token) => ({ ...token }));
}

export function getLoadBalancingHashOwner(
  key: string,
  nodeIds: readonly string[],
): string | null {
  return ownerForConsistentHash(key, buildConsistentHashRing(nodeIds));
}

function buildConsistentHashRing(nodeIds: readonly string[]): ConsistentHashToken[] {
  const tokens: ConsistentHashToken[] = [];
  for (const nodeId of [...new Set(nodeIds)].sort()) {
    for (let index = 0; index < CONSISTENT_HASH_TOKENS_PER_NODE; index += 1) {
      const tokenId = `${nodeId}:token-${index}`;
      tokens.push({
        nodeId,
        position: mixedHash32(`load-balancing-ring:${tokenId}`),
        tokenId,
      });
    }
  }
  return tokens.sort((left, right) => left.position - right.position || left.tokenId.localeCompare(right.tokenId));
}

function ownerForConsistentHash(
  key: string,
  tokens: readonly ConsistentHashToken[],
): string | null {
  if (tokens.length === 0) return null;
  const position = mixedHash32(`load-balancing-key:${key}`);
  let low = 0;
  let high = tokens.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (tokens[middle].position < position) low = middle + 1;
    else high = middle;
  }
  return tokens[low === tokens.length ? 0 : low].nodeId;
}

function mixedHash32(value: string): number {
  let hash = fixedHash32(value);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function calculateKeyRemapping(
  trace: readonly LoadBalancingTraceRequest[],
  config: LoadBalancingConfig,
  beforeActiveIds: readonly string[],
  afterActiveIds: readonly string[],
): LoadBalancingRemapping {
  const keys = uniqueEffectiveKeys(trace, config);
  if (keys.length === 0 || beforeActiveIds.length === 0 || afterActiveIds.length === 0) {
    return { movedKeys: 0, totalKeys: keys.length, fraction: 0 };
  }
  const before = [...beforeActiveIds].sort();
  const after = [...afterActiveIds].sort();
  const beforeRing = buildConsistentHashRing(before);
  const afterRing = buildConsistentHashRing(after);
  let movedKeys = 0;
  for (const key of keys) {
    const beforeOwner = ownerForConsistentHash(key, beforeRing);
    const afterOwner = ownerForConsistentHash(key, afterRing);
    if (beforeOwner !== afterOwner) movedKeys += 1;
  }
  return {
    movedKeys,
    totalKeys: keys.length,
    fraction: movedKeys / keys.length,
  };
}

function uniqueEffectiveKeys(
  trace: readonly LoadBalancingTraceRequest[],
  config: LoadBalancingConfig,
): string[] {
  return [...new Set(trace.map((request) => request.hotKeyRoll < config.hotKeyProbability ? "celebrity-key" : request.key))].sort();
}

function activeNodeIds(nodes: readonly LoadBalancingNode[]): string[] {
  return nodes.filter((node) => node.status === "active").map((node) => node.id).sort();
}

function cloneState(state: LoadBalancingState): LoadBalancingState {
  return {
    ...state,
    config: { ...state.config },
    nodes: state.nodes.map((node) => ({ ...node })),
    trace: state.trace.map((request) => ({ ...request })),
    results: state.results.map((result) => ({ ...result })),
    history: state.history.map((point) => ({ ...point })),
    remapping: { ...state.remapping },
    progress: { ...state.progress },
    events: state.events.map((event) => ({ ...event })),
  };
}

function compareNodes(left: { id: string }, right: { id: string }): number {
  return left.id.localeCompare(right.id);
}

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return Math.round(sorted[index]);
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function assertLoadBalancingState(state: LoadBalancingState): void {
  if (!state || state.schemaVersion !== 1 || !Array.isArray(state.nodes) || !Array.isArray(state.trace)) {
    throw new LoadBalancingValidationError("Invalid load-balancing state.");
  }
  if (!Number.isInteger(state.traceCursor) || state.traceCursor < 0 || state.traceCursor > state.trace.length) {
    throw new LoadBalancingValidationError("Trace cursor is outside the trace bounds.");
  }
  assertConfig(state.config);
}

function assertConfig(config: LoadBalancingConfig): void {
  assertPolicy(config.policy);
  assertSelectionUnit(config.selectionUnit);
  assertRangeInteger(config.metricDelayTicks, 0, 5, "Metric delay");
  assertFraction(config.hotKeyProbability, "Hot-key probability");
  assertPositiveInteger(config.requestsPerStep, "Requests per step");
  assertPositiveInteger(config.queueCapacity, "Queue capacity");
  assertPositiveInteger(config.nodeCapacityWorkMs, "Node capacity");
  assertPositiveInteger(config.outstandingWorkUnitMs, "Outstanding work unit");
  assertPositiveInteger(config.baseLatencyMs, "Base latency");
}

function assertPolicy(value: LoadBalancingPolicy): void {
  if (!LOAD_BALANCING_POLICY_IDS.includes(value)) {
    throw new LoadBalancingValidationError(`Unknown load-balancing policy: ${String(value)}.`);
  }
}

function assertSelectionUnit(value: LoadBalancingConfig["selectionUnit"]): void {
  if (value !== "request" && value !== "connection") {
    throw new LoadBalancingValidationError(`Unknown selection unit: ${String(value)}.`);
  }
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new LoadBalancingValidationError(`${label} must be a positive integer.`);
  }
}

function assertRangeInteger(value: number, minimum: number, maximum: number, label: string): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new LoadBalancingValidationError(`${label} must be an integer from ${minimum} to ${maximum}.`);
  }
}

function assertFraction(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new LoadBalancingValidationError(`${label} must be between 0 and 1.`);
  }
}

function assertNever(value: never): never {
  throw new LoadBalancingValidationError(`Unsupported load-balancing action: ${JSON.stringify(value)}.`);
}
