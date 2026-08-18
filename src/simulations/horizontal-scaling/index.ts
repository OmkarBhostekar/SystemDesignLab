import type {
  SimulationEvent,
  SimulationEventTone,
  SimulationPreset,
} from "@/simulations/types";

export const HORIZONTAL_SCALING_PRESET_IDS = [
  "small-internal-tool",
  "stateless-scale-out",
  "shared-dependency-bottleneck",
] as const;

export type HorizontalScalingPresetId = (typeof HORIZONTAL_SCALING_PRESET_IDS)[number];

export type HorizontalScalingReplicaStatus =
  | "active"
  | "warming"
  | "failed"
  | "replacing";

export type HorizontalScalingLoadBalancer = "round-robin" | "least-loaded";
export type HorizontalScalingSessionMode = "local" | "shared";

export interface HorizontalScalingConfig {
  demandQps: number;
  appCapacityPerCoreQps: number;
  databaseRequired: boolean;
  databaseCapacityQps: number;
  baseLatencyMs: number;
  queueCapacity: number;
  warmupTicks: number;
  replacementTicks: number;
  defaultReplicaCores: number;
  defaultReplicaMemoryGb: number;
  maxReplicas: number;
  loadBalancer: HorizontalScalingLoadBalancer;
  sessionMode: HorizontalScalingSessionMode;
  stickySessions: boolean;
  hotKeyFraction: number;
  sessionKeyCount: number;
}

export interface HorizontalScalingReplica {
  id: string;
  cores: number;
  memoryGb: number;
  status: HorizontalScalingReplicaStatus;
  warmupTicksRemaining: number;
  replacementTicksRemaining: number;
  targetCores?: number;
  targetMemoryGb?: number;
  assignedQps: number;
}

export interface HorizontalScalingDatabase {
  status: "healthy" | "failed";
  capacityQps: number;
}

export interface HorizontalScalingProgress {
  overloadObserved: boolean;
  overloadObservedTick: number | null;
  capacityActionTick: number | null;
  resultObservedTick: number | null;
  completed: boolean;
}

export interface HorizontalScalingMetrics {
  tick: number;
  demandQps: number;
  admittedQps: number;
  processedQps: number;
  backlogQps: number;
  queuedQps: number;
  rejectedQps: number;
  queueDepth: number;
  appCapacityQps: number;
  databaseCapacityQps: number;
  effectiveCapacityQps: number;
  appUtilization: number;
  databaseUtilization: number;
  modeledP95LatencyMs: number;
  activeReplicaCount: number;
  warmingReplicaCount: number;
  failedReplicaCount: number;
  capacityAfterOneNodeFailureQps: number;
  sessionMissesQps: number;
  hotKeyQps: number;
  hotKeyOwnerId: string | null;
  hotKeyRejectedQps: number;
  overloaded: boolean;
  dependencySaturated: boolean;
  replicaAssignedQps: Array<{ replicaId: string; qps: number }>;
}

export type HorizontalScalingAction =
  | { type: "step" }
  | { type: "set-demand"; qps: number }
  | { type: "set-load-balancer"; policy: HorizontalScalingLoadBalancer }
  | { type: "set-session-mode"; mode: HorizontalScalingSessionMode }
  | { type: "set-sticky-sessions"; sticky: boolean }
  | { type: "set-hot-key"; fraction: number }
  | { type: "add-replica"; cores?: number; memoryGb?: number }
  | { type: "remove-replica"; replicaId: string }
  | {
      type: "upgrade-server" | "scale-up";
      replicaId?: string;
      cores: number;
      memoryGb: number;
      replacementTicks?: number;
    }
  | { type: "fail-replica"; replicaId: string }
  | { type: "recover-replica"; replicaId: string }
  | { type: "fail-database" }
  | { type: "recover-database" }
  | { type: "reset" };

export interface HorizontalScalingState {
  schemaVersion: 1;
  presetId: HorizontalScalingPresetId;
  tick: number;
  config: HorizontalScalingConfig;
  replicas: HorizontalScalingReplica[];
  database: HorizontalScalingDatabase;
  queueDepth: number;
  nextReplicaNumber: number;
  progress: HorizontalScalingProgress;
  events: SimulationEvent[];
}

export interface HorizontalScalingTransition {
  state: HorizontalScalingState;
  events: SimulationEvent[];
  metrics: HorizontalScalingMetrics;
}

export interface HorizontalScalingPresetDefinition
  extends SimulationPreset<HorizontalScalingPresetId> {
  config: HorizontalScalingConfig;
  replicas: Array<Pick<HorizontalScalingReplica, "id" | "cores" | "memoryGb">>;
}

export class HorizontalScalingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HorizontalScalingValidationError";
  }
}

const BASE_CONFIG: HorizontalScalingConfig = {
  demandQps: 100,
  appCapacityPerCoreQps: 500,
  databaseRequired: true,
  databaseCapacityQps: 5_000,
  baseLatencyMs: 25,
  queueCapacity: 1_000,
  warmupTicks: 2,
  replacementTicks: 2,
  defaultReplicaCores: 2,
  defaultReplicaMemoryGb: 4,
  maxReplicas: 8,
  loadBalancer: "round-robin",
  sessionMode: "shared",
  stickySessions: false,
  hotKeyFraction: 0,
  sessionKeyCount: 16,
};

export const HORIZONTAL_SCALING_PRESETS: readonly HorizontalScalingPresetDefinition[] = [
  {
    id: "small-internal-tool",
    label: "Small internal tool",
    description: "A low-volume service where a larger single host is still simple and sufficient.",
    config: {
      ...BASE_CONFIG,
      demandQps: 300,
      databaseCapacityQps: 1_000,
      defaultReplicaCores: 2,
      defaultReplicaMemoryGb: 4,
      maxReplicas: 4,
      sessionMode: "local",
      stickySessions: true,
      warmupTicks: 1,
      replacementTicks: 2,
    },
    replicas: [{ id: "replica-1", cores: 2, memoryGb: 4 }],
  },
  {
    id: "stateless-scale-out",
    label: "Stateless API scale-out",
    description: "A stateless API where warm replicas add capacity behind a load balancer.",
    config: {
      ...BASE_CONFIG,
      demandQps: 2_400,
      databaseCapacityQps: 8_000,
      defaultReplicaCores: 2,
      defaultReplicaMemoryGb: 4,
      maxReplicas: 8,
      sessionMode: "shared",
      warmupTicks: 2,
      replacementTicks: 2,
    },
    replicas: [{ id: "replica-1", cores: 2, memoryGb: 4 }],
  },
  {
    id: "shared-dependency-bottleneck",
    label: "Shared dependency bottleneck",
    description: "More application replicas cannot remove a saturated shared database limit.",
    config: {
      ...BASE_CONFIG,
      demandQps: 1_800,
      databaseCapacityQps: 700,
      defaultReplicaCores: 2,
      defaultReplicaMemoryGb: 4,
      maxReplicas: 8,
      sessionMode: "local",
      stickySessions: false,
      hotKeyFraction: 0.35,
      warmupTicks: 2,
      replacementTicks: 2,
    },
    replicas: [{ id: "replica-1", cores: 2, memoryGb: 4 }],
  },
] as const;

export const horizontalScalingPresets = HORIZONTAL_SCALING_PRESETS;

const PRESETS_BY_ID = new Map(
  HORIZONTAL_SCALING_PRESETS.map((preset) => [preset.id, preset]),
);

const EVENT_TONE_BY_TYPE: Record<string, SimulationEventTone> = {
  "control-changed": "info",
  "replica-added": "info",
  "replica-removed": "info",
  "replica-warming": "info",
  "replica-ready": "success",
  "server-upgrade-started": "warning",
  "server-upgrade-completed": "success",
  "replica-failed": "failure",
  "replica-recovered": "success",
  "database-failed": "failure",
  "database-recovered": "success",
  "queue-grew": "warning",
  "requests-rejected": "failure",
  "dependency-saturated": "warning",
  "session-miss": "warning",
  "hot-key-saturated": "warning",
  "overload-observed": "warning",
  "capacity-result-observed": "success",
};

type MutableTransitionContext = {
  state: HorizontalScalingState;
  events: SimulationEvent[];
  eventSequence: number;
};

export function getHorizontalScalingPreset(
  presetId: HorizontalScalingPresetId,
): HorizontalScalingPresetDefinition {
  const preset = PRESETS_BY_ID.get(presetId);
  if (!preset) {
    throw new HorizontalScalingValidationError(`Unknown horizontal scaling preset: ${String(presetId)}.`);
  }
  return clonePreset(preset);
}

export function createHorizontalScalingState(
  presetId: HorizontalScalingPresetId,
): HorizontalScalingState {
  const preset = getHorizontalScalingPreset(presetId);
  const state: HorizontalScalingState = {
    schemaVersion: 1,
    presetId: preset.id,
    tick: 0,
    config: cloneConfig(preset.config),
    replicas: preset.replicas.map((replica) => ({
      ...replica,
      status: "active",
      warmupTicksRemaining: 0,
      replacementTicksRemaining: 0,
      assignedQps: 0,
    })),
    database: {
      status: "healthy",
      capacityQps: preset.config.databaseCapacityQps,
    },
    queueDepth: 0,
    nextReplicaNumber: nextReplicaNumber(preset.replicas),
    progress: {
      overloadObserved: false,
      overloadObservedTick: null,
      capacityActionTick: null,
      resultObservedTick: null,
      completed: false,
    },
    events: [],
  };
  return state;
}

export function horizontalScalingMetrics(
  state: HorizontalScalingState,
): HorizontalScalingMetrics {
  assertHorizontalScalingState(state);

  const activeReplicas = state.replicas
    .filter((replica) => replica.status === "active")
    .sort(compareReplicas);
  const warmingReplicaCount = state.replicas.filter((replica) => replica.status === "warming").length;
  const failedReplicaCount = state.replicas.filter((replica) => replica.status === "failed").length;
  const appCapacityQps = activeReplicas.reduce(
    (total, replica) => total + replicaCapacityQps(replica, state.config),
    0,
  );
  const hotKeyQps = Math.round(state.config.demandQps * state.config.hotKeyFraction);
  const normalQps = Math.max(0, state.config.demandQps - hotKeyQps);
  const hotKeyOwner = activeReplicas[0] ?? null;
  const hotKeyOwnerCapacity = hotKeyOwner
    ? replicaCapacityQps(hotKeyOwner, state.config)
    : 0;
  const hotKeyRejectedQps = Math.max(0, hotKeyQps - hotKeyOwnerCapacity);
  // Aggregate application capacity remains the sum of healthy replicas. A hot
  // key does not make idle capacity disappear; it makes a particular owner
  // unable to serve that key, which is reported separately as hotKeyRejectedQps.
  // This keeps capacity metrics meaningful even at low demand while making the
  // hotspot visible in the owner-specific metrics and event timeline.
  const appServiceCapacityQps = appCapacityQps;
  const databaseCapacityQps = state.config.databaseRequired && state.database.status === "healthy"
    ? state.database.capacityQps
    : state.config.databaseRequired
      ? 0
      : appCapacityQps;
  const effectiveCapacityQps = Math.min(appServiceCapacityQps, databaseCapacityQps);
  const backlogQps = state.queueDepth + state.config.demandQps;
  const processedQps = Math.min(backlogQps, effectiveCapacityQps);
  const remainingAfterService = Math.max(0, backlogQps - processedQps);
  const queuedQps = Math.min(state.config.queueCapacity, remainingAfterService);
  const rejectedQps = Math.max(0, remainingAfterService - state.config.queueCapacity);
  const appUtilization = ratio(state.config.demandQps, appCapacityQps);
  const databaseUtilization = state.config.databaseRequired
    ? ratio(state.config.demandQps, databaseCapacityQps)
    : 0;
  const overloaded = state.config.demandQps > effectiveCapacityQps || state.queueDepth > 0;
  const sessionMissesQps = estimateSessionMisses(state, activeReplicas.length);
  const capacityAfterOneNodeFailureQps = calculateCapacityAfterOneNodeFailure(
    activeReplicas,
    state.config,
    state.database,
  );
  const replicaAssignedQps = assignQps(state, activeReplicas, normalQps, hotKeyQps).map(
    ({ replica, qps }) => ({ replicaId: replica.id, qps }),
  );

  return {
    tick: state.tick,
    demandQps: state.config.demandQps,
    admittedQps: processedQps,
    processedQps,
    backlogQps,
    queuedQps,
    rejectedQps,
    queueDepth: state.queueDepth,
    appCapacityQps,
    databaseCapacityQps,
    effectiveCapacityQps,
    appUtilization,
    databaseUtilization,
    modeledP95LatencyMs: modeledP95Latency(state.config, state.queueDepth, effectiveCapacityQps, overloaded),
    activeReplicaCount: activeReplicas.length,
    warmingReplicaCount,
    failedReplicaCount,
    capacityAfterOneNodeFailureQps,
    sessionMissesQps,
    hotKeyQps,
    hotKeyOwnerId: hotKeyOwner?.id ?? null,
    hotKeyRejectedQps,
    overloaded,
    dependencySaturated:
      state.config.databaseRequired &&
      (state.database.status === "failed" || state.config.demandQps > state.database.capacityQps),
    replicaAssignedQps,
  };
}

export function transitionHorizontalScaling(
  input: HorizontalScalingState,
  action: HorizontalScalingAction,
): HorizontalScalingTransition {
  assertHorizontalScalingState(input);
  const state = cloneState(input);
  if (!action || typeof action !== "object" || typeof action.type !== "string") {
    throw new HorizontalScalingValidationError("Horizontal scaling action must contain a type.");
  }

  if (action.type === "reset") {
    const reset = createHorizontalScalingState(state.presetId);
    return { state: reset, events: [], metrics: horizontalScalingMetrics(reset) };
  }

  const context: MutableTransitionContext = {
    state,
    events: [],
    eventSequence: state.events.length,
  };

  switch (action.type) {
    case "step":
      stepState(context);
      break;
    case "set-demand":
      assertNonNegativeInteger(action.qps, "Demand QPS");
      context.state.config.demandQps = action.qps;
      emit(context, "control-changed", "Demand changed", `Demand is now ${action.qps} QPS.`);
      break;
    case "set-load-balancer":
      assertLoadBalancer(action.policy);
      context.state.config.loadBalancer = action.policy;
      emit(context, "control-changed", "Load-balancing policy changed", `Using ${action.policy}.`);
      break;
    case "set-session-mode":
      assertSessionMode(action.mode);
      context.state.config.sessionMode = action.mode;
      emit(context, "control-changed", "Session mode changed", `Sessions are ${action.mode}.`);
      break;
    case "set-sticky-sessions":
      assertBoolean(action.sticky, "Sticky sessions");
      context.state.config.stickySessions = action.sticky;
      emit(
        context,
        "control-changed",
        "Session routing changed",
        action.sticky ? "Sticky routing is enabled." : "Sticky routing is disabled.",
      );
      break;
    case "set-hot-key":
      assertFraction(action.fraction, "Hot-key fraction");
      context.state.config.hotKeyFraction = action.fraction;
      emit(context, "control-changed", "Hot-key skew changed", `Hot-key traffic is ${action.fraction * 100}%.`);
      break;
    case "add-replica":
      addReplica(context, action.cores, action.memoryGb);
      break;
    case "remove-replica":
      removeReplica(context, action.replicaId);
      break;
    case "upgrade-server":
    case "scale-up":
      upgradeServer(context, action);
      break;
    case "fail-replica":
      failReplica(context, action.replicaId);
      break;
    case "recover-replica":
      recoverReplica(context, action.replicaId);
      break;
    case "fail-database":
      failDatabase(context);
      break;
    case "recover-database":
      recoverDatabase(context);
      break;
    default:
      assertNever(action);
  }

  updateCompletion(context.state, action.type);
  context.state.events.push(...context.events);
  const metrics = horizontalScalingMetrics(context.state);
  return { state: context.state, events: context.events, metrics };
}

function stepState(context: MutableTransitionContext): void {
  context.state.tick += 1;
  advanceReplicaLifecycle(context);

  const previousQueueDepth = context.state.queueDepth;
  context.state.queueDepth = horizontalScalingMetrics(context.state).queuedQps;
  const nextMetrics = horizontalScalingMetrics(context.state);

  for (const replica of context.state.replicas) replica.assignedQps = 0;
  const activeReplicas = context.state.replicas
    .filter((replica) => replica.status === "active")
    .sort(compareReplicas);
  const hotKeyQps = Math.round(context.state.config.demandQps * context.state.config.hotKeyFraction);
  const normalQps = Math.max(0, context.state.config.demandQps - hotKeyQps);
  for (const assignment of assignQps(context.state, activeReplicas, normalQps, hotKeyQps)) {
    assignment.replica.assignedQps = assignment.qps;
  }

  if (nextMetrics.queuedQps > previousQueueDepth) {
    emit(
      context,
      "queue-grew",
      "Queue grew",
      `The request queue is holding ${nextMetrics.queuedQps} requests.`,
    );
  }
  if (nextMetrics.rejectedQps > 0) {
    emit(
      context,
      "requests-rejected",
      "Requests rejected",
      `${nextMetrics.rejectedQps} requests exceeded available capacity or queue space.`,
    );
  }
  if (nextMetrics.dependencySaturated) {
    emit(
      context,
      "dependency-saturated",
      "Shared dependency saturated",
      context.state.database.status === "failed"
        ? "The database is unavailable, so database-dependent work cannot complete."
        : `The database is limited to ${context.state.database.capacityQps} QPS.`,
    );
  }
  if (nextMetrics.sessionMissesQps > 0) {
    emit(
      context,
      "session-miss",
      "Local session misses",
      `${nextMetrics.sessionMissesQps} requests may miss in-process session state.`,
    );
  }
  if (nextMetrics.hotKeyRejectedQps > 0) {
    emit(
      context,
      "hot-key-saturated",
      "Hot key saturated one replica",
      `${nextMetrics.hotKeyRejectedQps} hot-key requests exceed the selected owner's capacity.`,
    );
  }
  if (nextMetrics.overloaded && !context.state.progress.overloadObserved) {
    context.state.progress.overloadObserved = true;
    context.state.progress.overloadObservedTick = context.state.tick;
    emit(context, "overload-observed", "Overload observed", "Demand is above effective capacity or the queue is non-empty.");
  }
  if (
    context.state.progress.capacityActionTick !== null &&
    context.state.tick > context.state.progress.capacityActionTick &&
    context.state.progress.resultObservedTick === null
  ) {
    context.state.progress.resultObservedTick = context.state.tick;
    emit(context, "capacity-result-observed", "Capacity change observed", "A later step now shows the result of the capacity action.");
  }

}

function advanceReplicaLifecycle(context: MutableTransitionContext): void {
  for (const replica of context.state.replicas) {
    if (replica.status === "warming") {
      replica.warmupTicksRemaining = Math.max(0, replica.warmupTicksRemaining - 1);
      if (replica.warmupTicksRemaining === 0) {
        replica.status = "active";
        emit(context, "replica-ready", `${replica.id} is ready`, `${replica.id} finished warming up.`);
      }
    }
    if (replica.status === "replacing") {
      replica.replacementTicksRemaining = Math.max(0, replica.replacementTicksRemaining - 1);
      if (replica.replacementTicksRemaining === 0) {
        replica.cores = replica.targetCores ?? replica.cores;
        replica.memoryGb = replica.targetMemoryGb ?? replica.memoryGb;
        delete replica.targetCores;
        delete replica.targetMemoryGb;
        replica.status = "active";
        emit(context, "server-upgrade-completed", `${replica.id} upgrade completed`, `${replica.id} now has ${replica.cores} cores.`);
      }
    }
  }
}

function addReplica(
  context: MutableTransitionContext,
  requestedCores: number | undefined,
  requestedMemoryGb: number | undefined,
): void {
  if (context.state.replicas.length >= context.state.config.maxReplicas) {
    throw new HorizontalScalingValidationError("Cannot add a replica beyond the configured maximum.");
  }
  const cores = requestedCores === undefined ? context.state.config.defaultReplicaCores : requestedCores;
  const memoryGb = requestedMemoryGb === undefined ? context.state.config.defaultReplicaMemoryGb : requestedMemoryGb;
  assertPositiveInteger(cores, "Replica cores");
  assertPositiveInteger(memoryGb, "Replica memory");
  const id = `replica-${context.state.nextReplicaNumber}`;
  context.state.nextReplicaNumber += 1;
  const warmupTicks = context.state.config.warmupTicks;
  context.state.replicas.push({
    id,
    cores,
    memoryGb,
    status: warmupTicks === 0 ? "active" : "warming",
    warmupTicksRemaining: warmupTicks,
    replacementTicksRemaining: 0,
    assignedQps: 0,
  });
  context.state.progress.capacityActionTick = context.state.tick;
  emit(context, "replica-added", `${id} added`, `${id} is ${warmupTicks === 0 ? "active" : "warming"}.`);
  if (warmupTicks > 0) emit(context, "replica-warming", `${id} warming`, `${id} will be ready in ${warmupTicks} ticks.`);
}

function removeReplica(context: MutableTransitionContext, replicaId: string): void {
  const index = context.state.replicas.findIndex((replica) => replica.id === replicaId);
  if (index < 0) throw new HorizontalScalingValidationError(`Unknown replica ID: ${replicaId}.`);
  if (context.state.replicas.length <= 1) {
    throw new HorizontalScalingValidationError("Cannot remove the last replica; fail it instead to demonstrate an outage.");
  }
  context.state.replicas.splice(index, 1);
  context.state.progress.capacityActionTick = context.state.tick;
  emit(context, "replica-removed", `${replicaId} removed`, `${replicaId} no longer contributes capacity.`);
}

function upgradeServer(
  context: MutableTransitionContext,
  action: Extract<HorizontalScalingAction, { type: "upgrade-server" | "scale-up" }>,
): void {
  assertPositiveInteger(action.cores, "Server cores");
  assertPositiveInteger(action.memoryGb, "Server memory");
  const target = action.replicaId
    ? context.state.replicas.find((replica) => replica.id === action.replicaId)
    : context.state.replicas.find((replica) => replica.status === "active") ?? context.state.replicas[0];
  if (!target) throw new HorizontalScalingValidationError("Cannot upgrade a cluster without a replica.");
  if (target.status === "failed" || target.status === "warming") {
    throw new HorizontalScalingValidationError(`Cannot upgrade replica ${target.id} while it is ${target.status}.`);
  }
  const replacementTicks = action.replacementTicks === undefined
    ? context.state.config.replacementTicks
    : action.replacementTicks;
  assertNonNegativeInteger(replacementTicks, "Replacement ticks");
  context.state.progress.capacityActionTick = context.state.tick;
  if (replacementTicks === 0) {
    target.cores = action.cores;
    target.memoryGb = action.memoryGb;
    emit(context, "server-upgrade-completed", `${target.id} upgraded`, `${target.id} now has ${action.cores} cores.`);
    return;
  }
  target.status = "replacing";
  target.replacementTicksRemaining = replacementTicks;
  target.targetCores = action.cores;
  target.targetMemoryGb = action.memoryGb;
  emit(context, "server-upgrade-started", `${target.id} upgrade started`, `${target.id} is being replaced for ${replacementTicks} ticks.`);
}

function failReplica(context: MutableTransitionContext, replicaId: string): void {
  const replica = findReplica(context.state, replicaId);
  if (replica.status === "failed") throw new HorizontalScalingValidationError(`Replica ${replicaId} is already failed.`);
  replica.status = "failed";
  replica.warmupTicksRemaining = 0;
  replica.replacementTicksRemaining = 0;
  delete replica.targetCores;
  delete replica.targetMemoryGb;
  emit(context, "replica-failed", `${replicaId} failed`, `${replicaId} contributes no capacity until recovery.`);
}

function recoverReplica(context: MutableTransitionContext, replicaId: string): void {
  const replica = findReplica(context.state, replicaId);
  if (replica.status !== "failed") throw new HorizontalScalingValidationError(`Replica ${replicaId} is not failed.`);
  const warmupTicks = context.state.config.warmupTicks;
  replica.status = warmupTicks === 0 ? "active" : "warming";
  replica.warmupTicksRemaining = warmupTicks;
  emit(context, "replica-recovered", `${replicaId} recovering`, `${replicaId} is ${warmupTicks === 0 ? "active" : "warming"}.`);
}

function failDatabase(context: MutableTransitionContext): void {
  if (context.state.database.status === "failed") throw new HorizontalScalingValidationError("Database is already failed.");
  context.state.database.status = "failed";
  emit(context, "database-failed", "Database failed", "Database-dependent requests now queue or reject.");
}

function recoverDatabase(context: MutableTransitionContext): void {
  if (context.state.database.status !== "failed") throw new HorizontalScalingValidationError("Database is not failed.");
  context.state.database.status = "healthy";
  emit(context, "database-recovered", "Database recovered", `Database capacity is ${context.state.database.capacityQps} QPS.`);
}

function updateCompletion(state: HorizontalScalingState, actionType: HorizontalScalingAction["type"]): void {
  if (actionType !== "step") return;
  const progress = state.progress;
  progress.completed =
    progress.overloadObserved &&
    progress.overloadObservedTick !== null &&
    progress.capacityActionTick !== null &&
    progress.overloadObservedTick <= progress.capacityActionTick &&
    progress.resultObservedTick !== null &&
    progress.resultObservedTick > progress.capacityActionTick;
}

function assignQps(
  state: HorizontalScalingState,
  activeReplicas: readonly HorizontalScalingReplica[],
  normalQps: number,
  hotKeyQps: number,
): Array<{ replica: HorizontalScalingReplica; qps: number }> {
  if (activeReplicas.length === 0) return [];
  const ordered = [...activeReplicas];
  if (state.config.loadBalancer === "least-loaded") {
    ordered.sort((left, right) => left.assignedQps - right.assignedQps || compareReplicas(left, right));
  }
  const base = Math.floor(normalQps / ordered.length);
  const remainder = normalQps % ordered.length;
  const assignments = ordered.map((replica, index) => ({
    replica,
    qps: base + (index < remainder ? 1 : 0),
  }));
  const hotOwner = assignments.find((assignment) => assignment.replica.id === activeReplicas[0]?.id);
  if (hotOwner) hotOwner.qps += hotKeyQps;
  return assignments.sort((left, right) => compareReplicas(left.replica, right.replica));
}

function estimateSessionMisses(state: HorizontalScalingState, activeReplicaCount: number): number {
  if (state.config.sessionMode !== "local" || state.config.stickySessions || activeReplicaCount <= 1) return 0;
  return Math.round(state.config.demandQps * ((activeReplicaCount - 1) / activeReplicaCount));
}

function calculateCapacityAfterOneNodeFailure(
  activeReplicas: readonly HorizontalScalingReplica[],
  config: HorizontalScalingConfig,
  database: HorizontalScalingDatabase,
): number {
  const appCapacity = activeReplicas
    .map((replica) => replicaCapacityQps(replica, config))
    .sort((left, right) => right - left);
  const afterFailureApp = Math.max(0, appCapacity.slice(1).reduce((sum, capacity) => sum + capacity, 0));
  const databaseCapacity = config.databaseRequired && database.status === "healthy"
    ? database.capacityQps
    : config.databaseRequired
      ? 0
      : afterFailureApp;
  return Math.min(afterFailureApp, databaseCapacity);
}

function modeledP95Latency(
  config: HorizontalScalingConfig,
  queueDepth: number,
  effectiveCapacityQps: number,
  overloaded: boolean,
): number {
  const queueDelay = effectiveCapacityQps > 0 ? Math.ceil((queueDepth / effectiveCapacityQps) * 1_000) : overloaded ? 5_000 : 0;
  const saturationPenalty = overloaded ? 250 : 0;
  return Math.min(30_000, config.baseLatencyMs + queueDelay + saturationPenalty);
}

function replicaCapacityQps(
  replica: HorizontalScalingReplica,
  config: HorizontalScalingConfig,
): number {
  return replica.status === "active" ? replica.cores * config.appCapacityPerCoreQps : 0;
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return numerator > 0 ? Number.MAX_SAFE_INTEGER : 0;
  return numerator / denominator;
}

function emit(
  context: MutableTransitionContext,
  type: string,
  title: string,
  detail: string,
): void {
  const id = `${type}-${context.state.tick}-${context.eventSequence}`;
  context.eventSequence += 1;
  context.events.push({
    id,
    tick: context.state.tick,
    type,
    title,
    detail,
    tone: EVENT_TONE_BY_TYPE[type] ?? "info",
  });
}

function findReplica(state: HorizontalScalingState, replicaId: string): HorizontalScalingReplica {
  const replica = state.replicas.find((candidate) => candidate.id === replicaId);
  if (!replica) throw new HorizontalScalingValidationError(`Unknown replica ID: ${replicaId}.`);
  return replica;
}

function nextReplicaNumber(
  replicas: readonly Pick<HorizontalScalingReplica, "id">[],
): number {
  let next = 1;
  for (const replica of replicas) {
    const match = /^replica-(\d+)$/.exec(replica.id);
    if (match) next = Math.max(next, Number(match[1]) + 1);
  }
  return next;
}

function compareReplicas(left: Pick<HorizontalScalingReplica, "id">, right: Pick<HorizontalScalingReplica, "id">): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function clonePreset(preset: HorizontalScalingPresetDefinition): HorizontalScalingPresetDefinition {
  return {
    ...preset,
    config: cloneConfig(preset.config),
    replicas: preset.replicas.map((replica) => ({ ...replica })),
  };
}

function cloneConfig(config: HorizontalScalingConfig): HorizontalScalingConfig {
  return { ...config };
}

function cloneState(state: HorizontalScalingState): HorizontalScalingState {
  return {
    ...state,
    config: cloneConfig(state.config),
    replicas: state.replicas.map((replica) => ({ ...replica })),
    database: { ...state.database },
    progress: { ...state.progress },
    events: state.events.map((event) => ({ ...event })),
  };
}

function assertHorizontalScalingState(value: unknown): asserts value is HorizontalScalingState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HorizontalScalingValidationError("Horizontal scaling state must be an object.");
  }
  const state = value as Partial<HorizontalScalingState>;
  if (state.schemaVersion !== 1) throw new HorizontalScalingValidationError("Unsupported horizontal scaling state version.");
  if (typeof state.presetId !== "string" || !PRESETS_BY_ID.has(state.presetId as HorizontalScalingPresetId)) {
    throw new HorizontalScalingValidationError("Horizontal scaling state has an unknown preset ID.");
  }
  assertNonNegativeInteger(state.tick, "State tick");
  if (!state.config || typeof state.config !== "object") throw new HorizontalScalingValidationError("Horizontal scaling state requires config.");
  assertConfig(state.config as HorizontalScalingConfig);
  if (!Array.isArray(state.replicas) || state.replicas.length === 0) throw new HorizontalScalingValidationError("Horizontal scaling state requires at least one replica.");
  const ids = new Set<string>();
  for (const replica of state.replicas) {
    if (typeof replica !== "object" || replica === null || typeof replica.id !== "string") throw new HorizontalScalingValidationError("Replica records require string IDs.");
    if (ids.has(replica.id)) throw new HorizontalScalingValidationError(`Duplicate replica ID: ${replica.id}.`);
    ids.add(replica.id);
    assertPositiveInteger(replica.cores, `Replica ${replica.id} cores`);
    assertPositiveInteger(replica.memoryGb, `Replica ${replica.id} memory`);
    if (!["active", "warming", "failed", "replacing"].includes(replica.status)) throw new HorizontalScalingValidationError(`Unknown status for replica ${replica.id}.`);
    assertNonNegativeInteger(replica.warmupTicksRemaining, `Replica ${replica.id} warm-up ticks`);
    assertNonNegativeInteger(replica.replacementTicksRemaining, `Replica ${replica.id} replacement ticks`);
    assertNonNegativeInteger(replica.assignedQps, `Replica ${replica.id} assigned QPS`);
  }
  if (!state.database || (state.database.status !== "healthy" && state.database.status !== "failed")) throw new HorizontalScalingValidationError("Invalid database state.");
  assertPositiveInteger(state.database.capacityQps, "Database capacity");
  assertNonNegativeInteger(state.queueDepth, "Queue depth");
  if (state.queueDepth > state.config.queueCapacity) throw new HorizontalScalingValidationError("Queue depth cannot exceed queue capacity.");
  if (!Array.isArray(state.events)) throw new HorizontalScalingValidationError("Horizontal scaling state events must be an array.");
  if (!state.progress || typeof state.progress !== "object") throw new HorizontalScalingValidationError("Horizontal scaling state requires progress.");
}

function assertConfig(config: HorizontalScalingConfig): void {
  assertNonNegativeInteger(config.demandQps, "Demand QPS");
  assertPositiveInteger(config.appCapacityPerCoreQps, "Application capacity per core");
  assertPositiveInteger(config.databaseCapacityQps, "Database capacity");
  assertPositiveInteger(config.baseLatencyMs, "Base latency");
  assertPositiveInteger(config.queueCapacity, "Queue capacity");
  assertNonNegativeInteger(config.warmupTicks, "Warm-up ticks");
  assertNonNegativeInteger(config.replacementTicks, "Replacement ticks");
  assertPositiveInteger(config.defaultReplicaCores, "Default replica cores");
  assertPositiveInteger(config.defaultReplicaMemoryGb, "Default replica memory");
  assertPositiveInteger(config.maxReplicas, "Maximum replicas");
  assertLoadBalancer(config.loadBalancer);
  assertSessionMode(config.sessionMode);
  assertBoolean(config.databaseRequired, "Database required");
  assertBoolean(config.stickySessions, "Sticky sessions");
  assertFraction(config.hotKeyFraction, "Hot-key fraction");
  assertPositiveInteger(config.sessionKeyCount, "Session key count");
}

function assertLoadBalancer(value: unknown): asserts value is HorizontalScalingLoadBalancer {
  if (value !== "round-robin" && value !== "least-loaded") throw new HorizontalScalingValidationError(`Unknown load-balancing policy: ${String(value)}.`);
}

function assertSessionMode(value: unknown): asserts value is HorizontalScalingSessionMode {
  if (value !== "local" && value !== "shared") throw new HorizontalScalingValidationError(`Unknown session mode: ${String(value)}.`);
}

function assertBoolean(value: unknown, label: string): asserts value is boolean {
  if (typeof value !== "boolean") throw new HorizontalScalingValidationError(`${label} must be a boolean.`);
}

function assertFraction(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) throw new HorizontalScalingValidationError(`${label} must be between 0 and 1.`);
}

function assertPositiveInteger(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) throw new HorizontalScalingValidationError(`${label} must be a positive integer.`);
}

function assertNonNegativeInteger(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw new HorizontalScalingValidationError(`${label} must be a non-negative integer.`);
}

function assertNever(value: never): never {
  throw new HorizontalScalingValidationError(`Unsupported horizontal scaling action: ${JSON.stringify(value)}.`);
}
