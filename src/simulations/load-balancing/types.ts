import type {
  SimulationEvent,
  SimulationPreset,
} from "@/simulations/types";

export const LOAD_BALANCING_POLICY_IDS = [
  "round-robin",
  "weighted-round-robin",
  "least-connections",
  "least-outstanding",
  "latency-aware",
  "random",
  "key-hash",
] as const;

export type LoadBalancingPolicy = (typeof LOAD_BALANCING_POLICY_IDS)[number];

export const LOAD_BALANCING_SELECTION_UNITS = ["request", "connection"] as const;
export type LoadBalancingSelectionUnit = (typeof LOAD_BALANCING_SELECTION_UNITS)[number];

export const LOAD_BALANCING_PRESET_IDS = [
  "mixed-checkout-work",
  "celebrity-cache-key",
  "connection-skew",
] as const;

export type LoadBalancingPresetId = (typeof LOAD_BALANCING_PRESET_IDS)[number];
export type LoadBalancingNodeStatus = "active" | "failed" | "removed";
export type LoadBalancingRequestKind = "cart-read" | "inventory-write" | "payment-call" | "cache-read";
export type LoadBalancingRequestStatus = "served" | "rejected";

export interface LoadBalancingConfig {
  policy: LoadBalancingPolicy;
  selectionUnit: LoadBalancingSelectionUnit;
  metricDelayTicks: number;
  hotKeyProbability: number;
  requestsPerStep: number;
  queueCapacity: number;
  nodeCapacityWorkMs: number;
  outstandingWorkUnitMs: number;
  baseLatencyMs: number;
  randomSeed: number;
}

export interface LoadBalancingNode {
  id: string;
  weight: number;
  status: LoadBalancingNodeStatus;
  assignments: number;
  workMs: number;
  queueDepth: number;
  utilization: number;
  rejectedRequests: number;
  activeConnections: number;
  p95LatencyMs: number;
}

/**
 * A request is the fixed, policy-independent workload.  `hotKeyRoll` lets
 * controls change hot-key probability without regenerating or randomising the
 * trace, which is important when comparing policies.
 */
export interface LoadBalancingTraceRequest {
  id: string;
  tick: number;
  connectionId: string;
  key: string;
  hotKeyRoll: number;
  workMs: number;
  kind: LoadBalancingRequestKind;
}

export interface LoadBalancingRequestResult {
  requestId: string;
  tick: number;
  connectionId: string;
  key: string;
  isHotKey: boolean;
  nodeId: string | null;
  status: LoadBalancingRequestStatus;
  workMs: number;
  latencyMs: number;
  reason: "none" | "queue-overflow" | "no-healthy-nodes";
}

export interface LoadBalancingNodeMetrics {
  nodeId: string;
  status: LoadBalancingNodeStatus;
  assignments: number;
  workMs: number;
  queueDepth: number;
  utilization: number;
  rejectedRequests: number;
  activeConnections: number;
  p95LatencyMs: number;
}

export interface LoadBalancingPolicyComparison {
  policy: LoadBalancingPolicy;
  label: string;
  servedRequests: number;
  rejectedRequests: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  maxUtilization: number;
  workSkew: number;
  remappedFraction: number;
}

export interface LoadBalancingHistoryPoint {
  tick: number;
  servedRequests: number;
  rejectedRequests: number;
  p95LatencyMs: number;
  queueDepth: number;
  maxUtilization: number;
}

export interface LoadBalancingRemapping {
  movedKeys: number;
  totalKeys: number;
  fraction: number;
}

export interface LoadBalancingProgress {
  traceCompleted: boolean;
  topologyChanged: boolean;
  comparisonObserved: boolean;
  completed: boolean;
}

export interface LoadBalancingMetrics {
  tick: number;
  traceCursor: number;
  traceLength: number;
  policy: LoadBalancingPolicy;
  selectionUnit: LoadBalancingSelectionUnit;
  servedRequests: number;
  rejectedRequests: number;
  rejectionRate: number;
  totalWorkMs: number;
  averageLatencyMs: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  latencyP99Ms: number;
  maxLatencyMs: number;
  queueDepth: number;
  maxUtilization: number;
  activeNodeCount: number;
  failedNodeCount: number;
  hotKeyRequests: number;
  hotKeyNodeId: string | null;
  hotKeyShare: number;
  remappedKeyCount: number;
  remappedKeyFraction: number;
  connectionRemaps: number;
  overloaded: boolean;
  nodeMetrics: LoadBalancingNodeMetrics[];
  comparisons: LoadBalancingPolicyComparison[];
  recentResults: LoadBalancingRequestResult[];
  history: LoadBalancingHistoryPoint[];
}

export type LoadBalancingAction =
  | { type: "step" }
  | { type: "set-policy"; policy: LoadBalancingPolicy }
  | { type: "set-selection-unit"; unit: LoadBalancingSelectionUnit }
  | { type: "set-hot-key-probability"; probability: number }
  | { type: "set-hot-key-rate"; rate: number }
  | { type: "set-metric-delay"; ticks: number }
  | { type: "set-node-weight"; nodeId: string; weight: number }
  | { type: "add-node"; weight?: number }
  | { type: "remove-node"; nodeId: string }
  | { type: "fail-node"; nodeId: string }
  | { type: "recover-node"; nodeId: string }
  | { type: "reset" };

export interface LoadBalancingState {
  schemaVersion: 1;
  presetId: LoadBalancingPresetId;
  tick: number;
  traceCursor: number;
  config: LoadBalancingConfig;
  nodes: LoadBalancingNode[];
  trace: LoadBalancingTraceRequest[];
  results: LoadBalancingRequestResult[];
  history: LoadBalancingHistoryPoint[];
  nextNodeNumber: number;
  eventSequence: number;
  remapping: LoadBalancingRemapping;
  progress: LoadBalancingProgress;
  events: SimulationEvent[];
}

export interface LoadBalancingTransition {
  state: LoadBalancingState;
  events: SimulationEvent[];
  metrics: LoadBalancingMetrics;
}

export interface LoadBalancingPresetDefinition extends SimulationPreset<LoadBalancingPresetId> {
  config: LoadBalancingConfig;
  nodes: Array<Pick<LoadBalancingNode, "id" | "weight">>;
  traceLength: number;
}

export class LoadBalancingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoadBalancingValidationError";
  }
}
