import {
  SIMULATION_SPEEDS,
  type SimulationEvent,
  type SimulationMetric,
  type SimulationSpeed,
} from "@/simulations/types";

import { getConsistentHashingPreset } from "./presets";
import {
  DEFAULT_KEY_SIZE_BYTES,
  DEFAULT_MIGRATION_BATCH_SIZE,
  HASH_ALGORITHM,
  HASH_SPACE_SIZE,
  MAX_KEY_COUNT,
  MAX_VNODE_COUNT,
  MIN_KEY_COUNT,
  MIN_REPLICATION_FACTOR,
  MIN_VNODE_COUNT,
  type ConsistentHashCompletion,
  type ConsistentHashKeyPlacement,
  type ConsistentHashMigration,
  type ConsistentHashMetrics,
  type ConsistentHashNode,
  type ConsistentHashToken,
  type ConsistentHashingAction,
  type ConsistentHashingPresetId,
  type ConsistentHashingState,
  type HashStrategy,
  type MigrationPolicy,
  type RingRolloutStatus,
} from "./types";

export { HASH_ALGORITHM };
export * from "./types";
export { CONSISTENT_HASHING_PRESETS, CONSISTENT_HASHING_PRESET_BY_ID, getConsistentHashingPreset } from "./presets";

const NODE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_EVENT_COUNT = 200;
const MAX_SEED_LENGTH = 100;

/** Raised when an action cannot be applied to the current educational model. */
export class ConsistentHashingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConsistentHashingValidationError";
  }
}

/**
 * FNV-1a over UTF-8 bytes.  Keeping the UTF-8 encoding here (rather than
 * relying on a browser TextEncoder) makes token and key placement identical in
 * Node tests, server code, and the browser renderer.
 */
export function fixedHash32(value: string): number {
  let hash = 0x811c9dc5;
  for (const character of value) {
    const codePoint = character.codePointAt(0) as number;
    const bytes = utf8Bytes(codePoint);
    for (const byte of bytes) {
      hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
    }
  }
  return hash >>> 0;
}

/** Short alias for callers that think in terms of the placement hash. */
export const hash32 = fixedHash32;

/**
 * FNV-1a is stable but adjacent authored IDs can retain visible bit patterns.
 * This deterministic finalizer gives token and key placement the uniform
 * avalanche expected from a real placement hash without hiding the seed.
 */
export function placementHash32(value: string): number {
  let hash = fixedHash32(value);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function utf8Bytes(codePoint: number): number[] {
  if (codePoint <= 0x7f) return [codePoint];
  if (codePoint <= 0x7ff) return [0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f)];
  if (codePoint <= 0xffff) {
    return [
      0xe0 | (codePoint >> 12),
      0x80 | ((codePoint >> 6) & 0x3f),
      0x80 | (codePoint & 0x3f),
    ];
  }
  return [
    0xf0 | (codePoint >> 18),
    0x80 | ((codePoint >> 12) & 0x3f),
    0x80 | ((codePoint >> 6) & 0x3f),
    0x80 | (codePoint & 0x3f),
  ];
}

export function keyIdAt(index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new ConsistentHashingValidationError(`Key index must be a non-negative integer; received ${index}.`);
  }
  return `key-${index}`;
}

export function keyIds(count: number): string[] {
  assertKeyCount(count);
  return Array.from({ length: count }, (_, index) => keyIdAt(index));
}

export function buildConsistentHashTokens(
  nodeIds: readonly string[],
  tokenSeed: string,
  vnodesEnabled: boolean,
  vnodeCount: number,
): ConsistentHashToken[] {
  assertNodeIds(nodeIds);
  assertSeed(tokenSeed);
  assertVnodeCount(vnodeCount);
  const count = vnodesEnabled ? vnodeCount : 1;
  const tokens: ConsistentHashToken[] = [];
  for (const nodeId of [...nodeIds].sort(compareStrings)) {
    for (let vnodeIndex = 0; vnodeIndex < count; vnodeIndex += 1) {
      const tokenId = `${nodeId}:${vnodeIndex}`;
      tokens.push({
        tokenId,
        nodeId,
        vnodeIndex,
        position: placementHash32(`${tokenSeed}:${tokenId}`),
      });
    }
  }
  return tokens.sort(compareTokens);
}

/** Alias used by renderers that call ring positions "tokens". */
export const buildTokens = buildConsistentHashTokens;

function buildTokensForStrategy(
  strategy: HashStrategy,
  nodeIds: readonly string[],
  tokenSeed: string,
  vnodesEnabled: boolean,
  vnodeCount: number,
): ConsistentHashToken[] {
  return strategy === "ring"
    ? buildConsistentHashTokens(nodeIds, tokenSeed, vnodesEnabled, vnodeCount)
    : [];
}

export function getKeyPlacement(
  state: ConsistentHashingState,
  keyId: string,
): ConsistentHashKeyPlacement | null {
  return state.assignments.find((assignment) => assignment.keyId === keyId) ?? null;
}

export const getKeyOwnership = getKeyPlacement;

export function getPendingKeyPlacement(
  state: ConsistentHashingState,
  keyId: string,
): ConsistentHashKeyPlacement | null {
  return state.pendingAssignments?.find((assignment) => assignment.keyId === keyId) ?? null;
}

export function calculateOwnershipVariance(
  assignments: readonly ConsistentHashKeyPlacement[],
  activeNodeIds: readonly string[],
): number {
  const nodeIds = [...new Set(activeNodeIds)].sort(compareStrings);
  if (nodeIds.length === 0 || assignments.length === 0) return 0;
  const counts = new Map<string, number>(nodeIds.map((nodeId) => [nodeId, 0]));
  for (const assignment of assignments) {
    if (assignment.primaryNodeId && counts.has(assignment.primaryNodeId)) {
      counts.set(assignment.primaryNodeId, (counts.get(assignment.primaryNodeId) ?? 0) + 1);
    }
  }
  const shares = nodeIds.map((nodeId) => (counts.get(nodeId) ?? 0) / assignments.length);
  const mean = shares.reduce((sum, share) => sum + share, 0) / shares.length;
  return shares.reduce((sum, share) => sum + (share - mean) ** 2, 0) / shares.length;
}

export function calculateConsistentHashMetrics(state: ConsistentHashingState): ConsistentHashMetrics {
  return calculateMetrics({
    assignments: state.assignments,
    previousAssignments: state.previousAssignments,
    pendingAssignments: state.pendingAssignments,
    currentNodeIds: state.currentNodeIds,
    servers: state.servers,
    tokens: state.tokens,
    migration: state.migration,
    lazyRefillKeys: state.lazyRefillKeys,
    totalTrafficQps: state.totalTrafficQps,
    hotKeyRate: state.hotKeyRate,
  });
}

export function toConsistentHashingSimulationMetrics(
  metrics: ConsistentHashMetrics,
): SimulationMetric[] {
  const ownership = Object.entries(metrics.ownershipFractionByNode)
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([nodeId, fraction]) => `${nodeId} ${(fraction * 100).toFixed(1)}%`)
    .join(", ");
  return [
    metric("remapped-fraction", "Keys remapped", `${(metrics.remappedFraction * 100).toFixed(1)}%`, `${metrics.remappedKeys} keys moved from the previous committed mapping.`),
    metric("pending-remapped-fraction", "Pending movement", `${(metrics.pendingRemappedFraction * 100).toFixed(1)}%`, `${metrics.pendingRemappedKeys} keys would move at the proposed ring.`),
    metric("ownership-variance", "Ownership variance", metrics.ownershipVariance.toFixed(4), ownership || "No active owners."),
    metric("migration-pending", "Migration pending", String(metrics.migrationPendingKeys), `${metrics.migrationBytes} bytes are represented by the migration plan.`),
    metric("hot-node-qps", "Hot-node QPS", metrics.hotNodeQps.toFixed(1), metrics.hotNodeId ? `Primary owner: ${metrics.hotNodeId}.` : "No active hot-key owner."),
    metric("origin-miss-qps", "Origin miss QPS", metrics.originMissQps.toFixed(1), "Lazy refill assumes one illustrative refill attempt per pending key per tick."),
  ];
}

function metric(id: string, label: string, value: string, detail: string): SimulationMetric {
  return { id, label, value, detail };
}

export function createConsistentHashingState(
  presetId: ConsistentHashingPresetId,
): ConsistentHashingState {
  const preset = getConsistentHashingPreset(presetId);
  const servers = preset.nodeIds
    .map((id) => ({ id, status: "active" as const, weight: 1 }))
    .sort(compareNodes);
  const currentNodeIds = [...preset.nodeIds].sort(compareStrings);
  const tokens = buildTokensForStrategy(
    preset.strategy,
    currentNodeIds,
    preset.tokenSeed,
    preset.vnodesEnabled,
    preset.vnodeCount,
  );
  const assignments = buildAssignments({
    strategy: preset.strategy,
    keyCount: preset.keyCount,
    currentNodeIds,
    servers,
    tokens,
    replicationFactor: preset.replicationFactor,
  });
  const completion: ConsistentHashCompletion = {
    meaningfulAction: false,
    progressObserved: false,
    completed: false,
  };
  const stateWithoutMetrics: Omit<ConsistentHashingState, "metrics"> = {
    presetId,
    tick: 0,
    strategy: preset.strategy,
    tokenSeed: preset.tokenSeed,
    vnodesEnabled: preset.vnodesEnabled,
    vnodeCount: preset.vnodeCount,
    keyCount: preset.keyCount,
    replicationFactor: preset.replicationFactor,
    hotKeyRate: preset.hotKeyRate,
    totalTrafficQps: preset.totalTrafficQps,
    keySizeBytes: DEFAULT_KEY_SIZE_BYTES,
    migrationBatchSize: DEFAULT_MIGRATION_BATCH_SIZE,
    migrationPolicy: preset.migrationPolicy,
    speed: 1,
    playing: false,
    servers,
    currentNodeIds,
    pendingNodeIds: null,
    tokens,
    pendingTokens: null,
    currentRingVersion: 1,
    pendingRingVersion: null,
    rolloutStatus: "stable",
    assignments,
    pendingAssignments: null,
    previousAssignments: assignments.map(cloneAssignment),
    migration: [],
    lazyRefillKeys: [],
    events: [
      {
        id: "event-0-initialized",
        tick: 0,
        type: "initialized",
        title: preset.label,
        detail: `${preset.keyCount} deterministic keys are mapped with ${preset.strategy === "ring" ? "a hash ring" : "modulo-N hashing"}. Hash: ${HASH_ALGORITHM}.`,
        tone: "info",
      },
    ],
    completion,
  };
  return {
    ...stateWithoutMetrics,
    metrics: calculateMetrics({
      assignments,
      previousAssignments: assignments,
      pendingAssignments: null,
      currentNodeIds,
      servers,
      tokens,
      migration: [],
      lazyRefillKeys: [],
      totalTrafficQps: preset.totalTrafficQps,
      hotKeyRate: preset.hotKeyRate,
    }),
  };
}

export function transitionConsistentHashing(
  state: ConsistentHashingState,
  action: ConsistentHashingAction,
): ConsistentHashingState {
  switch (action.type) {
    case "reset":
      return createConsistentHashingState(state.presetId);
    case "play":
      return { ...state, playing: true };
    case "pause":
      return { ...state, playing: false };
    case "set-speed":
      assertSpeed(action.speed);
      return { ...state, speed: action.speed };
    case "step":
      return stepState(state);
    case "set-strategy":
      return setStrategy(state, action.strategy);
    case "toggle-vnodes":
      return setVnodeConfiguration(state, !state.vnodesEnabled, state.vnodeCount);
    case "set-vnode-count":
      assertVnodeCount(action.count);
      return setVnodeConfiguration(state, state.vnodesEnabled, action.count);
    case "set-key-count":
      assertKeyCount(action.count);
      return setKeyCount(state, action.count);
    case "add-keys":
      assertPositiveInteger(action.count, "Key increment");
      return setKeyCount(state, Math.min(MAX_KEY_COUNT, state.keyCount + action.count));
    case "add-10000-keys":
      return setKeyCount(state, MAX_KEY_COUNT);
    case "set-hot-key-rate":
      assertUnitInterval(action.rate, "Hot-key rate");
      return withMetrics(
        appendEvent({ ...state, hotKeyRate: action.rate }, "hot-key-rate", "Hot-key rate changed", `${Math.round(action.rate * 100)}% of traffic targets key-0.`, "info"),
      );
    case "set-replication-factor":
      return setReplicationFactor(state, action.factor);
    case "set-token-seed":
      assertSeed(action.seed);
      return reconfigurePlacement(
        { ...state, tokenSeed: action.seed },
        "token-seed",
        "Token seed changed",
        `The deterministic token positions now use ${JSON.stringify(action.seed)}.`,
      );
    case "set-migration-policy":
      return setMigrationPolicy(state, action.policy);
    case "add-server":
      return addServer(state, action.nodeId);
    case "remove-server":
      return removeServer(state, action.nodeId);
    case "fail-server":
    case "kill-server":
      return failServer(state, action.nodeId);
    case "recover-server":
      return recoverServer(state, action.nodeId);
    case "pause-rollout":
      return pauseRollout(state);
    case "resume-rollout":
      return resumeRollout(state);
    case "cutover":
      return cutover(state);
    default:
      return assertNever(action);
  }
}

function stepState(state: ConsistentHashingState): ConsistentHashingState {
  const advanced = { ...state, tick: state.tick + 1 };

  if (state.rolloutStatus === "paused") {
    return appendEvent(advanced, "step-paused", "Rollout is paused", "Resume the ring rollout before migration can advance.", "warning");
  }

  if (state.rolloutStatus === "pending") {
    return appendEvent(
      advanced,
      "step-pending",
      "Pending ring did not advance",
      "A pending rollout needs Resume before a migration batch can advance.",
      "warning",
    );
  }

  if (state.rolloutStatus === "migrating") {
    const next = state.migrationPolicy === "durable-migration"
      ? advanceDurableMigration(advanced)
      : advanceLazyMigration(advanced);
    return markCompletion(next, true);
  }

  if (state.completion.meaningfulAction && !state.completion.progressObserved) {
    return markCompletion(
      appendEvent(
        advanced,
        "failure-observed",
        "Membership change observed",
        "A deterministic step exposed the new ownership or failure fallback state.",
        "success",
      ),
      true,
    );
  }

  return advanced;
}

function advanceDurableMigration(state: ConsistentHashingState): ConsistentHashingState {
  const firstPending = state.migration.findIndex((item) => item.status === "pending");
  if (firstPending >= 0) {
    const next = [...state.migration];
    const indices = next
      .map((item, index) => (item.status === "pending" ? index : -1))
      .filter((index) => index >= 0)
      .slice(0, state.migrationBatchSize);
    for (const index of indices) next[index] = { ...next[index]!, status: "copied" };
    return appendEvent(
      withMetrics({ ...state, migration: next, rolloutStatus: "migrating" }),
      "migration-copied",
      "Migration batch copied",
      `${indices.length} key interval${indices.length === 1 ? "" : "s"} copied; verification is still required before durable cutover.`,
      "info",
    );
  }

  const firstCopied = state.migration.findIndex((item) => item.status === "copied");
  if (firstCopied >= 0) {
    const next = [...state.migration];
    const indices = next
      .map((item, index) => (item.status === "copied" ? index : -1))
      .filter((index) => index >= 0)
      .slice(0, state.migrationBatchSize);
    for (const index of indices) next[index] = { ...next[index]!, status: "verified" };
    const ready = next.every((item) => item.status === "verified");
    return appendEvent(
      withMetrics({ ...state, migration: next, rolloutStatus: ready ? "ready" : "migrating" }),
      "migration-verified",
      ready ? "Migration ready for cutover" : "Migration batch verified",
      `${indices.length} copied key interval${indices.length === 1 ? "" : "s"} verified${ready ? "; durable cutover is now safe." : "."}`,
      "success",
    );
  }

  return appendEvent(
    { ...state, rolloutStatus: "ready" },
    "migration-ready",
    "Migration ready for cutover",
    "Every affected key has been copied and verified.",
    "success",
  );
}

function advanceLazyMigration(state: ConsistentHashingState): ConsistentHashingState {
  return appendEvent(
    withMetrics(state),
    "lazy-refill-step",
    "Lazy refill waits for cutover",
    "No durable copy is performed before cutover; moved cache keys will refill from the origin.",
    "warning",
  );
}

function setStrategy(state: ConsistentHashingState, strategy: HashStrategy): ConsistentHashingState {
  if (state.strategy === strategy) return state;
  return reconfigurePlacement(
    { ...state, strategy },
    "strategy",
    "Placement strategy changed",
    strategy === "ring" ? "Keys now choose a clockwise ring successor." : "Keys now choose hash(key) modulo the active node count.",
  );
}

function setVnodeConfiguration(
  state: ConsistentHashingState,
  vnodesEnabled: boolean,
  vnodeCount: number,
): ConsistentHashingState {
  assertVnodeCount(vnodeCount);
  if (state.vnodesEnabled === vnodesEnabled && state.vnodeCount === vnodeCount) return state;
  return reconfigurePlacement(
    { ...state, vnodesEnabled, vnodeCount },
    "vnodes",
    vnodesEnabled ? "Virtual nodes enabled" : "Virtual nodes disabled",
    vnodesEnabled ? `${vnodeCount} tokens are generated per physical node.` : "One token is generated per physical node.",
  );
}

function setKeyCount(state: ConsistentHashingState, keyCount: number): ConsistentHashingState {
  const assignments = buildAssignments({
    strategy: state.strategy,
    keyCount,
    currentNodeIds: state.currentNodeIds,
    servers: state.servers,
    tokens: state.tokens,
    replicationFactor: state.replicationFactor,
  });
  const pendingAssignments = state.pendingNodeIds && state.pendingTokens
    ? buildAssignments({
        strategy: state.strategy,
        keyCount,
        currentNodeIds: state.pendingNodeIds,
        servers: state.servers,
        tokens: state.pendingTokens,
        replicationFactor: state.replicationFactor,
      })
    : null;
  return withMetrics(
    appendEvent(
      {
        ...state,
        keyCount,
        assignments,
        previousAssignments: assignments.map(cloneAssignment),
        pendingAssignments,
        migration: pendingAssignments ? buildMigration(state.assignments, pendingAssignments, state.keySizeBytes) : state.migration,
        lazyRefillKeys: [],
      },
      "key-count",
      "Key count changed",
      `The model now aggregates ${keyCount.toLocaleString("en-US")} deterministic keys.`,
      "info",
    ),
  );
}

function setReplicationFactor(state: ConsistentHashingState, factor: number): ConsistentHashingState {
  assertReplicationFactor(factor, state.currentNodeIds.length);
  const assignments = buildAssignments({
    strategy: state.strategy,
    keyCount: state.keyCount,
    currentNodeIds: state.currentNodeIds,
    servers: state.servers,
    tokens: state.tokens,
    replicationFactor: factor,
  });
  const pendingAssignments = state.pendingNodeIds && state.pendingTokens
    ? buildAssignments({
        strategy: state.strategy,
        keyCount: state.keyCount,
        currentNodeIds: state.pendingNodeIds,
        servers: state.servers,
        tokens: state.pendingTokens,
        replicationFactor: factor,
      })
    : null;
  return withMetrics(
    appendEvent(
      {
        ...state,
        replicationFactor: factor,
        assignments,
        previousAssignments: state.assignments.map(cloneAssignment),
        pendingAssignments,
        migration: pendingAssignments
          ? buildMigration(state.assignments, pendingAssignments, state.keySizeBytes)
          : state.migration,
      },
      "replication-factor",
      "Replication factor changed",
      `Each key now selects up to ${factor} distinct physical owner${factor === 1 ? "" : "s"}.`,
      "info",
    ),
  );
}

function setMigrationPolicy(state: ConsistentHashingState, policy: MigrationPolicy): ConsistentHashingState {
  if (state.migrationPolicy === policy) return state;
  const migration = state.pendingAssignments
    ? buildMigration(state.assignments, state.pendingAssignments, state.keySizeBytes)
    : state.migration;
  const rolloutStatus: RingRolloutStatus = state.pendingAssignments ? "pending" : state.rolloutStatus;
  return withMetrics(
    appendEvent(
      { ...state, migrationPolicy: policy, migration, rolloutStatus },
      "migration-policy",
      "Migration policy changed",
      policy === "durable-migration"
        ? "Affected keys must be copied and verified before durable cutover."
        : "Cutover may happen before copying; affected cache keys refill from the origin.",
      "info",
    ),
  );
}

function addServer(state: ConsistentHashingState, requestedNodeId?: string): ConsistentHashingState {
  if (state.pendingNodeIds) {
    throw new ConsistentHashingValidationError("Finish or cancel the current ring rollout before adding another server.");
  }
  const nodeId = requestedNodeId ?? nextNodeId(state.servers);
  assertNodeId(nodeId);
  if (state.servers.some((server) => server.id === nodeId)) {
    throw new ConsistentHashingValidationError(`Server ${JSON.stringify(nodeId)} already exists.`);
  }
  const servers = [...state.servers, { id: nodeId, status: "active" as const, weight: 1 }].sort(compareNodes);
  return preparePendingRollout(
    {
      ...state,
      servers,
      completion: { ...state.completion, meaningfulAction: true },
    },
    [...state.currentNodeIds, nodeId],
    "server-added",
    "Server added to proposed ring",
    `Server ${nodeId} owns no requests until the pending ring is rolled out.`,
  );
}

function removeServer(state: ConsistentHashingState, nodeId: string): ConsistentHashingState {
  assertNodeId(nodeId);
  if (state.pendingNodeIds) {
    throw new ConsistentHashingValidationError("Finish or cancel the current ring rollout before removing another server.");
  }
  if (!state.currentNodeIds.includes(nodeId)) {
    throw new ConsistentHashingValidationError(`Server ${JSON.stringify(nodeId)} is not in the committed membership.`);
  }
  if (state.currentNodeIds.length <= 1) {
    throw new ConsistentHashingValidationError("A ring must retain at least one committed server.");
  }
  const nextNodeIds = state.currentNodeIds.filter((candidate) => candidate !== nodeId);
  return preparePendingRollout(
    {
      ...state,
      completion: { ...state.completion, meaningfulAction: true },
    },
    nextNodeIds,
    "server-removed",
    "Server removed from proposed ring",
    `Server ${nodeId} remains on the old ring until migration and cutover complete.`,
  );
}

function failServer(state: ConsistentHashingState, nodeId: string): ConsistentHashingState {
  assertNodeId(nodeId);
  const server = state.servers.find((candidate) => candidate.id === nodeId);
  if (!server) throw new ConsistentHashingValidationError(`Unknown server ${JSON.stringify(nodeId)}.`);
  if (!state.currentNodeIds.includes(nodeId)) {
    throw new ConsistentHashingValidationError(`Server ${JSON.stringify(nodeId)} is not in the committed membership.`);
  }
  if (server.status === "failed") {
    throw new ConsistentHashingValidationError(`Server ${JSON.stringify(nodeId)} is already failed.`);
  }
  if (server.status === "removed") {
    throw new ConsistentHashingValidationError(`Server ${JSON.stringify(nodeId)} has already been removed.`);
  }
  const servers = state.servers
    .map((candidate) => candidate.id === nodeId ? { ...candidate, status: "failed" as const } : { ...candidate })
    .sort(compareNodes);
  const assignments = buildAssignments({
    strategy: state.strategy,
    keyCount: state.keyCount,
    currentNodeIds: state.currentNodeIds,
    servers,
    tokens: state.tokens,
    replicationFactor: state.replicationFactor,
  });
  const pendingAssignments = state.pendingNodeIds && state.pendingTokens
    ? buildAssignments({
        strategy: state.strategy,
        keyCount: state.keyCount,
        currentNodeIds: state.pendingNodeIds,
        servers,
        tokens: state.pendingTokens,
        replicationFactor: state.replicationFactor,
      })
    : null;
  const next = withMetrics(
    appendEvent(
      {
        ...state,
        servers,
        assignments,
        previousAssignments: state.assignments.map(cloneAssignment),
        pendingAssignments,
        migration: pendingAssignments
          ? buildMigration(assignments, pendingAssignments, state.keySizeBytes)
          : state.migration,
        completion: { ...state.completion, meaningfulAction: true },
      },
      "server-failed",
      "Server failed",
      `${nodeId} is unavailable; ownership falls through to the next distinct active owner where possible.`,
      "failure",
    ),
  );
  return next;
}

function recoverServer(state: ConsistentHashingState, nodeId: string): ConsistentHashingState {
  assertNodeId(nodeId);
  const server = state.servers.find((candidate) => candidate.id === nodeId);
  if (!server) throw new ConsistentHashingValidationError(`Unknown server ${JSON.stringify(nodeId)}.`);
  if (server.status !== "failed") {
    throw new ConsistentHashingValidationError(`Server ${JSON.stringify(nodeId)} is not failed and cannot be recovered.`);
  }
  const servers = state.servers
    .map((candidate) => candidate.id === nodeId ? { ...candidate, status: "active" as const } : { ...candidate })
    .sort(compareNodes);
  const assignments = buildAssignments({
    strategy: state.strategy,
    keyCount: state.keyCount,
    currentNodeIds: state.currentNodeIds,
    servers,
    tokens: state.tokens,
    replicationFactor: state.replicationFactor,
  });
  const pendingAssignments = state.pendingNodeIds && state.pendingTokens
    ? buildAssignments({
        strategy: state.strategy,
        keyCount: state.keyCount,
        currentNodeIds: state.pendingNodeIds,
        servers,
        tokens: state.pendingTokens,
        replicationFactor: state.replicationFactor,
      })
    : null;
  return withMetrics(
    appendEvent(
      {
        ...state,
        servers,
        assignments,
        previousAssignments: state.assignments.map(cloneAssignment),
        pendingAssignments,
        migration: pendingAssignments
          ? buildMigration(assignments, pendingAssignments, state.keySizeBytes)
          : state.migration,
        completion: { ...state.completion, meaningfulAction: true },
      },
      "server-recovered",
      "Server recovered",
      `${nodeId} is active again; the committed ring still determines placement until a new rollout.`,
      "success",
    ),
  );
}

function preparePendingRollout(
  state: ConsistentHashingState,
  pendingNodeIds: readonly string[],
  eventType: string,
  title: string,
  detail: string,
): ConsistentHashingState {
  const sortedNodeIds = [...pendingNodeIds].sort(compareStrings);
  assertNodeIds(sortedNodeIds);
  const pendingTokens = buildTokensForStrategy(
    state.strategy,
    sortedNodeIds,
    state.tokenSeed,
    state.vnodesEnabled,
    state.vnodeCount,
  );
  const pendingAssignments = buildAssignments({
    strategy: state.strategy,
    keyCount: state.keyCount,
    currentNodeIds: sortedNodeIds,
    servers: state.servers,
    tokens: pendingTokens,
    replicationFactor: state.replicationFactor,
  });
  return withMetrics(
    appendEvent(
      {
        ...state,
        pendingNodeIds: sortedNodeIds,
        pendingTokens,
        pendingAssignments,
        pendingRingVersion: state.currentRingVersion + 1,
        rolloutStatus: "pending",
        migration: buildMigration(state.assignments, pendingAssignments, state.keySizeBytes),
        lazyRefillKeys: [],
      },
      eventType,
      title,
      detail,
      "info",
    ),
  );
}

function reconfigurePlacement(
  state: ConsistentHashingState,
  eventType: string,
  title: string,
  detail: string,
): ConsistentHashingState {
  const tokens = buildTokensForStrategy(
    state.strategy,
    state.currentNodeIds,
    state.tokenSeed,
    state.vnodesEnabled,
    state.vnodeCount,
  );
  const assignments = buildAssignments({
    strategy: state.strategy,
    keyCount: state.keyCount,
    currentNodeIds: state.currentNodeIds,
    servers: state.servers,
    tokens,
    replicationFactor: state.replicationFactor,
  });
  const pendingTokens = state.pendingNodeIds
    ? buildTokensForStrategy(
        state.strategy,
        state.pendingNodeIds,
        state.tokenSeed,
        state.vnodesEnabled,
        state.vnodeCount,
      )
    : null;
  const pendingAssignments = state.pendingNodeIds && pendingTokens
    ? buildAssignments({
        strategy: state.strategy,
        keyCount: state.keyCount,
        currentNodeIds: state.pendingNodeIds,
        servers: state.servers,
        tokens: pendingTokens,
        replicationFactor: state.replicationFactor,
      })
    : null;
  return withMetrics(
    appendEvent(
      {
        ...state,
        tokens,
        assignments,
        previousAssignments: state.assignments.map(cloneAssignment),
        pendingTokens,
        pendingAssignments,
        migration: pendingAssignments
          ? buildMigration(assignments, pendingAssignments, state.keySizeBytes)
          : state.migration,
      },
      eventType,
      title,
      detail,
      "info",
    ),
  );
}

function pauseRollout(state: ConsistentHashingState): ConsistentHashingState {
  if (!state.pendingAssignments || state.rolloutStatus === "stable") {
    throw new ConsistentHashingValidationError("There is no pending ring rollout to pause.");
  }
  if (state.rolloutStatus === "paused") return state;
  return appendEvent(
    { ...state, rolloutStatus: "paused" },
    "rollout-paused",
    "Ring rollout paused",
    `Clients remain on ring version ${state.currentRingVersion}; version ${state.pendingRingVersion} is not committed.`,
    "warning",
  );
}

function resumeRollout(state: ConsistentHashingState): ConsistentHashingState {
  if (!state.pendingAssignments || state.rolloutStatus === "stable") {
    throw new ConsistentHashingValidationError("There is no pending ring rollout to resume.");
  }
  if (state.rolloutStatus === "migrating" || state.rolloutStatus === "ready") return state;
  return appendEvent(
    withMetrics({ ...state, rolloutStatus: "migrating" }),
    "rollout-resumed",
    "Ring rollout resumed",
    state.migrationPolicy === "durable-migration"
      ? "Deterministic copy/verify batches can now advance with Step."
      : "Lazy refill will be recorded at cutover; no durable copy is performed first.",
    "info",
  );
}

function cutover(state: ConsistentHashingState): ConsistentHashingState {
  if (!state.pendingAssignments || !state.pendingNodeIds || !state.pendingTokens || state.pendingRingVersion === null) {
    throw new ConsistentHashingValidationError("There is no pending ring rollout to cut over.");
  }
  if (state.rolloutStatus === "paused") {
    throw new ConsistentHashingValidationError("Resume the ring rollout before cutover.");
  }
  if (
    state.migrationPolicy === "durable-migration" &&
    !state.migration.every((item) => item.status === "verified")
  ) {
    throw new ConsistentHashingValidationError("Durable cutover requires every migration item to be verified.");
  }

  const movedKeys = state.migration.map((item) => item.keyId).sort(compareStrings);
  const servers = state.servers
    .map((server) => {
      if (state.pendingNodeIds?.includes(server.id)) {
        return server.status === "removed" ? { ...server, status: "active" as const } : { ...server };
      }
      return { ...server, status: "removed" as const };
    })
    .sort(compareNodes);
  const lazyRefillKeys = state.migrationPolicy === "lazy-refill" ? movedKeys : [];
  const migration = state.migration.map((item) => ({
    ...item,
    status: state.migrationPolicy === "lazy-refill" ? "refill-pending" as const : "verified" as const,
  }));
  const next: ConsistentHashingState = {
    ...state,
    servers,
    currentNodeIds: [...state.pendingNodeIds],
    pendingNodeIds: null,
    tokens: [...state.pendingTokens],
    pendingTokens: null,
    currentRingVersion: state.pendingRingVersion,
    pendingRingVersion: null,
    rolloutStatus: "stable",
    assignments: state.pendingAssignments.map(cloneAssignment),
    previousAssignments: state.assignments.map(cloneAssignment),
    pendingAssignments: null,
    migration,
    lazyRefillKeys,
    completion: {
      meaningfulAction: state.completion.meaningfulAction,
      progressObserved: true,
      completed: state.completion.meaningfulAction,
    },
  };
  return withMetrics(
    appendEvent(
      next,
      "ring-cutover",
      "Ring version committed",
      state.migrationPolicy === "lazy-refill"
        ? `Ring version ${next.currentRingVersion} is live; ${movedKeys.length} moved keys will refill lazily.`
        : `Ring version ${next.currentRingVersion} is live after copy and verification.`,
      "success",
    ),
  );
}

function markCompletion(state: ConsistentHashingState, progressObserved: boolean): ConsistentHashingState {
  if (!state.completion.meaningfulAction || !progressObserved) return state;
  return {
    ...state,
    completion: {
      meaningfulAction: true,
      progressObserved: true,
      completed: true,
    },
  };
}

function withMetrics(state: ConsistentHashingState): ConsistentHashingState {
  return {
    ...state,
    metrics: calculateConsistentHashMetrics(state),
  };
}

function appendEvent(
  state: ConsistentHashingState,
  type: string,
  title: string,
  detail: string,
  tone: SimulationEvent["tone"],
): ConsistentHashingState {
  const event: SimulationEvent = {
    id: `event-${state.tick}-${state.events.length + 1}-${type}`,
    tick: state.tick,
    type,
    title,
    detail,
    tone,
  };
  const events = [...state.events, event];
  return { ...state, events: events.slice(Math.max(0, events.length - MAX_EVENT_COUNT)) };
}

type AssignmentInput = {
  strategy: HashStrategy;
  keyCount: number;
  currentNodeIds: readonly string[];
  servers: readonly ConsistentHashNode[];
  tokens: readonly ConsistentHashToken[];
  replicationFactor: number;
};

function buildAssignments(input: AssignmentInput): ConsistentHashKeyPlacement[] {
  assertKeyCount(input.keyCount);
  assertNodeIds(input.currentNodeIds);
  assertReplicationFactor(input.replicationFactor, input.currentNodeIds.length);
  const statusByNode = new Map(input.servers.map((server) => [server.id, server.status] as const));
  const activeNodeIds = input.currentNodeIds
    .filter((nodeId) => statusByNode.get(nodeId) === "active")
    .sort(compareStrings);
  const tokens = [...input.tokens].sort(compareTokens);
  const placements: ConsistentHashKeyPlacement[] = [];
  for (let index = 0; index < input.keyCount; index += 1) {
    const keyId = keyIdAt(index);
    const hash = placementHash32(keyId);
    const owners = input.strategy === "ring"
      ? ringOwners(hash, tokens, activeNodeIds, input.replicationFactor)
      : moduloOwners(hash, activeNodeIds, input.replicationFactor);
    placements.push({
      keyId,
      hash,
      primaryNodeId: owners[0] ?? null,
      replicaNodeIds: owners.slice(1),
    });
  }
  return placements;
}

function moduloOwners(hash: number, activeNodeIds: readonly string[], replicationFactor: number): string[] {
  if (activeNodeIds.length === 0) return [];
  const ownerIndex = hash % activeNodeIds.length;
  const owners: string[] = [];
  for (let offset = 0; offset < activeNodeIds.length && owners.length < replicationFactor; offset += 1) {
    const nodeId = activeNodeIds[(ownerIndex + offset) % activeNodeIds.length];
    if (nodeId && !owners.includes(nodeId)) owners.push(nodeId);
  }
  return owners;
}

function ringOwners(
  hash: number,
  tokens: readonly ConsistentHashToken[],
  activeNodeIds: readonly string[],
  replicationFactor: number,
): string[] {
  if (tokens.length === 0 || activeNodeIds.length === 0) return [];
  const active = new Set(activeNodeIds);
  const start = lowerBoundToken(tokens, hash);
  const owners: string[] = [];
  for (let offset = 0; offset < tokens.length && owners.length < replicationFactor; offset += 1) {
    const token = tokens[(start + offset) % tokens.length];
    if (token && active.has(token.nodeId) && !owners.includes(token.nodeId)) owners.push(token.nodeId);
  }
  return owners;
}

function lowerBoundToken(tokens: readonly ConsistentHashToken[], hash: number): number {
  let low = 0;
  let high = tokens.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if ((tokens[middle]?.position ?? HASH_SPACE_SIZE) < hash) low = middle + 1;
    else high = middle;
  }
  return low === tokens.length ? 0 : low;
}

function buildMigration(
  previous: readonly ConsistentHashKeyPlacement[],
  next: readonly ConsistentHashKeyPlacement[],
  keySizeBytes: number,
): ConsistentHashMigration[] {
  const previousByKey = new Map(previous.map((assignment) => [assignment.keyId, assignment] as const));
  return next
    .filter((assignment) => {
      const old = previousByKey.get(assignment.keyId);
      return old?.primaryNodeId !== assignment.primaryNodeId;
    })
    .map((assignment) => {
      const old = previousByKey.get(assignment.keyId);
      return {
        keyId: assignment.keyId,
        fromNodeId: old?.primaryNodeId ?? null,
        toNodeId: assignment.primaryNodeId,
        bytes: keySizeBytes,
        status: "pending" as const,
      };
    })
    .sort(compareMigration);
}

function calculateMetrics(input: {
  assignments: readonly ConsistentHashKeyPlacement[];
  previousAssignments: readonly ConsistentHashKeyPlacement[];
  pendingAssignments: readonly ConsistentHashKeyPlacement[] | null;
  currentNodeIds: readonly string[];
  servers: readonly ConsistentHashNode[];
  tokens: readonly ConsistentHashToken[];
  migration: readonly ConsistentHashMigration[];
  lazyRefillKeys: readonly string[];
  totalTrafficQps: number;
  hotKeyRate: number;
}): ConsistentHashMetrics {
  const activeNodeIds = input.currentNodeIds
    .filter((nodeId) => input.servers.some((server) => server.id === nodeId && server.status === "active"))
    .sort(compareStrings);
  const allNodeIds = input.servers.map((server) => server.id).sort(compareStrings);
  const ownershipByNode = Object.fromEntries(
    allNodeIds.map((nodeId) => [nodeId, 0]),
  ) as Record<string, number>;
  for (const assignment of input.assignments) {
    if (assignment.primaryNodeId && Object.prototype.hasOwnProperty.call(ownershipByNode, assignment.primaryNodeId)) {
      ownershipByNode[assignment.primaryNodeId] = (ownershipByNode[assignment.primaryNodeId] ?? 0) + 1;
    }
  }
  const ownershipFractionByNode = Object.fromEntries(
    allNodeIds.map((nodeId) => [
      nodeId,
      input.assignments.length === 0 ? 0 : (ownershipByNode[nodeId] ?? 0) / input.assignments.length,
    ]),
  ) as Record<string, number>;
  const remap = compareRemapping(input.previousAssignments, input.assignments);
  const pendingRemap = input.pendingAssignments
    ? compareRemapping(input.assignments, input.pendingAssignments)
    : { moved: 0, fraction: 0 };
  const migrationPendingKeys = input.migration.filter((item) => item.status === "pending" || item.status === "copied" || item.status === "refill-pending").length;
  const migrationCopiedKeys = input.migration.filter((item) => item.status === "copied").length;
  const migrationVerifiedKeys = input.migration.filter((item) => item.status === "verified").length;
  const migrationBytes = input.migration.reduce((sum, item) => sum + item.bytes, 0);
  const traffic = calculateTraffic(input.assignments, input.currentNodeIds, input.servers, input.totalTrafficQps, input.hotKeyRate);
  const hotNode = [...traffic.byNode.entries()]
    .sort((left, right) => right[1] - left[1] || compareStrings(left[0], right[0]))[0];
  return {
    keyCount: input.assignments.length,
    activeNodeCount: activeNodeIds.length,
    currentNodeCount: input.currentNodeIds.length,
    remappedKeys: remap.moved,
    remappedFraction: remap.fraction,
    pendingRemappedKeys: pendingRemap.moved,
    pendingRemappedFraction: pendingRemap.fraction,
    ownershipByNode,
    ownershipFractionByNode,
    ownershipVariance: calculateOwnershipVariance(input.assignments, activeNodeIds),
    minimumIntervalFraction: intervalFractions(input.tokens).min,
    maximumIntervalFraction: intervalFractions(input.tokens).max,
    migrationPendingKeys,
    migrationCopiedKeys,
    migrationVerifiedKeys,
    migrationBytes,
    totalTrafficQps: input.totalTrafficQps,
    hotKeyId: input.assignments.length > 0 ? keyIdAt(0) : null,
    hotKeyQps: input.assignments.length > 0 ? input.totalTrafficQps * input.hotKeyRate : 0,
    hotNodeId: hotNode?.[0] ?? null,
    hotNodeQps: hotNode?.[1] ?? 0,
    originMissQps: input.lazyRefillKeys.length,
  };
}

function calculateTraffic(
  assignments: readonly ConsistentHashKeyPlacement[],
  currentNodeIds: readonly string[],
  servers: readonly ConsistentHashNode[],
  totalTrafficQps: number,
  hotKeyRate: number,
): { byNode: Map<string, number> } {
  const active = new Set(
    currentNodeIds.filter((nodeId) => servers.some((server) => server.id === nodeId && server.status === "active")),
  );
  const byNode = new Map<string, number>([...active].sort(compareStrings).map((nodeId) => [nodeId, 0]));
  if (assignments.length === 0 || byNode.size === 0) return { byNode };
  const hotKeyQps = totalTrafficQps * hotKeyRate;
  const regularQps = assignments.length === 1
    ? 0
    : (totalTrafficQps - hotKeyQps) / (assignments.length - 1);
  assignments.forEach((assignment, index) => {
    if (!assignment.primaryNodeId || !byNode.has(assignment.primaryNodeId)) return;
    const qps = index === 0 ? hotKeyQps : regularQps;
    byNode.set(assignment.primaryNodeId, (byNode.get(assignment.primaryNodeId) ?? 0) + qps);
  });
  return { byNode };
}

function intervalFractions(tokens: readonly ConsistentHashToken[]): { min: number; max: number } {
  if (tokens.length === 0) return { min: 0, max: 0 };
  const sorted = [...tokens].sort(compareTokens);
  const intervals = sorted.map((token, index) => {
    const next = sorted[(index + 1) % sorted.length];
    if (!next) return 0;
    const distance = (next.position - token.position + HASH_SPACE_SIZE) % HASH_SPACE_SIZE;
    return distance / HASH_SPACE_SIZE;
  });
  return { min: Math.min(...intervals), max: Math.max(...intervals) };
}

function compareRemapping(
  previous: readonly ConsistentHashKeyPlacement[],
  next: readonly ConsistentHashKeyPlacement[],
): { moved: number; fraction: number } {
  const previousByKey = new Map(previous.map((assignment) => [assignment.keyId, assignment.primaryNodeId] as const));
  const comparable = next.filter((assignment) => previousByKey.has(assignment.keyId));
  const moved = comparable.filter((assignment) => previousByKey.get(assignment.keyId) !== assignment.primaryNodeId).length;
  return { moved, fraction: comparable.length === 0 ? 0 : moved / comparable.length };
}

function cloneAssignment(assignment: ConsistentHashKeyPlacement): ConsistentHashKeyPlacement {
  return {
    keyId: assignment.keyId,
    hash: assignment.hash,
    primaryNodeId: assignment.primaryNodeId,
    replicaNodeIds: [...assignment.replicaNodeIds].sort(compareStrings),
  };
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function compareNodes(left: ConsistentHashNode, right: ConsistentHashNode): number {
  return compareStrings(left.id, right.id);
}

function compareTokens(left: ConsistentHashToken, right: ConsistentHashToken): number {
  return left.position - right.position || compareStrings(left.tokenId, right.tokenId);
}

function compareMigration(left: ConsistentHashMigration, right: ConsistentHashMigration): number {
  return compareStrings(left.keyId, right.keyId) || compareStrings(left.toNodeId ?? "", right.toNodeId ?? "");
}

function nextNodeId(servers: readonly ConsistentHashNode[]): string {
  const existing = new Set(servers.map((server) => server.id));
  for (let index = 0; index < 26; index += 1) {
    const candidate = `node-${String.fromCharCode(97 + index)}`;
    if (!existing.has(candidate)) return candidate;
  }
  let suffix = 1;
  while (existing.has(`node-${suffix}`)) suffix += 1;
  return `node-${suffix}`;
}

function assertNodeId(nodeId: string): void {
  if (typeof nodeId !== "string" || !NODE_ID_PATTERN.test(nodeId)) {
    throw new ConsistentHashingValidationError(`Server ID must be lowercase kebab-case; received ${JSON.stringify(nodeId)}.`);
  }
}

function assertNodeIds(nodeIds: readonly string[]): void {
  const seen = new Set<string>();
  for (const nodeId of nodeIds) {
    assertNodeId(nodeId);
    if (seen.has(nodeId)) {
      throw new ConsistentHashingValidationError(`Duplicate server ID ${JSON.stringify(nodeId)}.`);
    }
    seen.add(nodeId);
  }
}

function assertKeyCount(value: number): void {
  if (!Number.isInteger(value) || value < MIN_KEY_COUNT || value > MAX_KEY_COUNT) {
    throw new ConsistentHashingValidationError(`Key count must be an integer from ${MIN_KEY_COUNT} to ${MAX_KEY_COUNT}; received ${value}.`);
  }
}

function assertVnodeCount(value: number): void {
  if (!Number.isInteger(value) || value < MIN_VNODE_COUNT || value > MAX_VNODE_COUNT) {
    throw new ConsistentHashingValidationError(`Vnode count must be an integer from ${MIN_VNODE_COUNT} to ${MAX_VNODE_COUNT}; received ${value}.`);
  }
}

function assertReplicationFactor(value: number, membershipCount: number): void {
  if (!Number.isInteger(value) || value < MIN_REPLICATION_FACTOR || value > Math.max(MIN_REPLICATION_FACTOR, membershipCount)) {
    throw new ConsistentHashingValidationError(`Replication factor must be an integer from ${MIN_REPLICATION_FACTOR} to ${membershipCount}; received ${value}.`);
  }
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ConsistentHashingValidationError(`${label} must be a positive integer; received ${value}.`);
  }
}

function assertUnitInterval(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new ConsistentHashingValidationError(`${label} must be between 0 and 1; received ${value}.`);
  }
}

function assertSeed(seed: string): void {
  if (typeof seed !== "string" || seed.trim().length === 0 || seed.length > MAX_SEED_LENGTH) {
    throw new ConsistentHashingValidationError(`Token seed must be a non-empty string of at most ${MAX_SEED_LENGTH} characters.`);
  }
}

function assertSpeed(speed: SimulationSpeed): void {
  if (!SIMULATION_SPEEDS.includes(speed)) {
    throw new ConsistentHashingValidationError(`Unsupported simulation speed: ${String(speed)}.`);
  }
}

function assertNever(value: never): never {
  throw new ConsistentHashingValidationError(`Unsupported consistent-hashing action: ${JSON.stringify(value)}.`);
}
