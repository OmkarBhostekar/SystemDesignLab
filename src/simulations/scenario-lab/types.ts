import type { SimulationEvent, SimulationMetric, SimulationPreset } from "../types";

export const SCENARIO_LAB_IDS = [
  "retry-jitter",
  "token-bucket",
  "circuit-breaker",
  "read-write-quorums",
  "replication",
  "partitioning-sharding",
  "message-queue-fundamentals",
  "delivery-semantics",
  "consensus-raft",
  "distributed-locks",
  "request-lifecycle",
  "dns",
  "health-checks-failover",
  "database-indexes",
  "btree-lsm",
  "cache-invalidation",
  "hot-keys",
  "partitions-consumer-groups",
  "dead-letter-queues",
  "distributed-tracing",
  "tcp-udp",
  "http-evolution",
  "realtime-transports",
  "service-discovery",
  "acid-transactions",
  "connection-pools",
  "cache-aside",
  "message-ordering",
  "timeouts",
  "sli-slo-sla",
] as const;

export type ScenarioLabId = (typeof SCENARIO_LAB_IDS)[number];
export type ScenarioNodeTone = "neutral" | "active" | "success" | "warning" | "failure";

export interface ScenarioLabNode {
  id: string;
  label: string;
  detail: string;
  kind: "client" | "service" | "store" | "queue" | "coordinator";
}

export interface ScenarioLabLink {
  from: string;
  to: string;
  label: string;
  tone?: ScenarioNodeTone;
}

export interface ScenarioLabFrame {
  title: string;
  explanation: string;
  nodeTones: Readonly<Record<string, ScenarioNodeTone>>;
  links: readonly ScenarioLabLink[];
  metrics: readonly SimulationMetric[];
  event: Omit<SimulationEvent, "id" | "tick">;
}

export interface ScenarioLabPreset extends SimulationPreset<string> {
  frames: readonly ScenarioLabFrame[];
}

export interface ScenarioLabDefinition {
  id: ScenarioLabId;
  title: string;
  description: string;
  nodes: readonly ScenarioLabNode[];
  presets: readonly ScenarioLabPreset[];
}

export interface ScenarioLabState {
  labId: ScenarioLabId;
  presetId: string;
  frameIndex: number;
  events: readonly SimulationEvent[];
  completed: boolean;
}

export type ScenarioLabAction = { type: "step" } | { type: "reset" };

export interface ScenarioLabTransition {
  state: ScenarioLabState;
  event: SimulationEvent;
}
