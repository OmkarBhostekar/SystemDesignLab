import type { SimulationEventTone } from "../types";
import type {
  ScenarioLabDefinition,
  ScenarioLabFrame,
  ScenarioLabId,
  ScenarioLabNode,
  ScenarioLabPreset,
  ScenarioNodeTone,
} from "./types";

type NodeKind = ScenarioLabNode["kind"];
type Phase = readonly [
  title: string,
  explanation: string,
  tones: string,
  linkLabel: string,
  values: readonly [string, string, string],
  eventTone: SimulationEventTone,
];

function node(id: string, label: string, detail: string, kind: NodeKind): ScenarioLabNode {
  return { id, label, detail, kind };
}

function preset(
  id: string,
  label: string,
  description: string,
  nodes: readonly ScenarioLabNode[],
  metricLabels: readonly [string, string, string],
  phases: readonly Phase[],
): ScenarioLabPreset {
  return {
    id,
    label,
    description,
    frames: phases.map((phase, index) => frame(nodes, metricLabels, phase, index, phases.length)),
  };
}

function frame(
  nodes: readonly ScenarioLabNode[],
  metricLabels: readonly [string, string, string],
  phase: Phase,
  index: number,
  phaseCount: number,
): ScenarioLabFrame {
  const [title, explanation, tones, linkLabel, values, eventTone] = phase;
  const toneValues = tones.split(" ") as ScenarioNodeTone[];
  return {
    title,
    explanation,
    nodeTones: Object.fromEntries(nodes.map((item, nodeIndex) => [item.id, toneValues[nodeIndex] ?? "neutral"])),
    links: nodes.slice(1).map((item, nodeIndex) => ({
      from: nodes[nodeIndex]!.id,
      to: item.id,
      label: linkLabel,
      tone: toneValues[nodeIndex + 1] ?? "neutral",
    })),
    metrics: metricLabels.map((metricLabel, metricIndex) => ({
      id: `${metricLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${metricIndex}`,
      label: metricLabel,
      value: values[metricIndex] ?? "—",
      detail: `Current modeled value for ${metricLabel.toLowerCase()}.`,
      tone: eventTone,
    })),
    event: {
      type: index === phaseCount - 1 ? "outcome" : "transition",
      title,
      detail: explanation,
      tone: eventTone,
    },
  };
}

const retryNodes = [
  node("clients", "500 clients", "Callers share the same failure and retry budget.", "client"),
  node("schedule", "Retry schedule", "Policy chooses each attempt time.", "coordinator"),
  node("dependency", "Dependency", "Unavailable first, then recovering.", "service"),
  node("outcome", "Outcomes", "Useful completions or abandoned work.", "store"),
] as const;
const limiterNodes = [
  node("callers", "Callers", "Two identities send bursty work.", "client"),
  node("bucket", "Token bucket", "Atomic refill and spend at the admission edge.", "coordinator"),
  node("service", "Protected service", "Only admitted work reaches capacity.", "service"),
  node("response", "Response", "Admit or reject with retry guidance.", "store"),
] as const;
const breakerNodes = [
  node("requests", "Requests", "Calls enter with a bounded deadline.", "client"),
  node("breaker", "Circuit breaker", "Closed, open, and half-open policy.", "coordinator"),
  node("dependency", "Dependency", "The protected remote service.", "service"),
  node("fallback", "Fallback", "Fast degraded response or success.", "store"),
] as const;
const quorumNodes = [
  node("coordinator", "Coordinator", "Fans operations to the replica set.", "coordinator"),
  node("replica-a", "Replica A", "Versioned owner in zone A.", "store"),
  node("replica-b", "Replica B", "Versioned owner in zone B.", "store"),
  node("replica-c", "Replica C", "Versioned owner in zone C.", "store"),
] as const;
const replicationNodes = [
  node("client", "Client", "Issues a write and a follow-up read.", "client"),
  node("leader", "Leader", "Owns the write order and log.", "store"),
  node("follower-a", "Follower A", "Applies shipped log entries.", "store"),
  node("follower-b", "Follower B", "May lag or become a promotion candidate.", "store"),
] as const;
const shardingNodes = [
  node("traffic", "Keys", "Workload includes one hot tenant.", "client"),
  node("router", "Shard router", "Maps keys using the active shard map.", "coordinator"),
  node("shard-a", "Shard A", "Owns one bounded key range.", "store"),
  node("shard-b", "Shard B", "Owns the neighboring key range.", "store"),
] as const;
const queueNodes = [
  node("producer", "Producer", "Publishes durable work.", "client"),
  node("broker", "Bounded queue", "Buffers and owns delivery state.", "queue"),
  node("consumer", "Consumer group", "Claims and processes work.", "service"),
  node("sink", "Downstream", "Commits the observable side effect.", "store"),
] as const;
const deliveryNodes = [
  node("broker", "Broker", "Tracks visibility and acknowledgment.", "queue"),
  node("worker", "Worker", "May crash around the side effect.", "service"),
  node("effect", "Side effect", "Payment, email, or database mutation.", "store"),
  node("ledger", "Idempotency ledger", "Deduplicates by stable operation key.", "coordinator"),
] as const;
const raftNodes = [
  node("node-a", "Node A", "Follower or candidate in term state.", "coordinator"),
  node("node-b", "Node B", "Voting member with a replicated log.", "coordinator"),
  node("node-c", "Node C", "Voting member with a replicated log.", "coordinator"),
  node("client", "Client", "Observes committed decisions only.", "client"),
] as const;
const lockNodes = [
  node("worker-a", "Worker A", "Competes to mutate the resource.", "client"),
  node("lock", "Lease service", "Grants bounded ownership and a fencing token.", "coordinator"),
  node("worker-b", "Worker B", "May acquire after the old lease expires.", "client"),
  node("resource", "Protected store", "Rejects stale fencing tokens.", "store"),
] as const;

export const SCENARIO_LABS: readonly ScenarioLabDefinition[] = [
  {
    id: "retry-jitter", title: "Can retries avoid becoming the outage?",
    description: "Compare synchronized exponential retries with bounded jitter while a dependency recovers.", nodes: retryNodes,
    presets: [
      preset("synchronized", "Exponential without jitter", "All clients share the same retry boundaries.", retryNodes, ["Peak retry QPS", "Useful completions", "Abandoned"], [
        ["Dependency fails", "All 500 clients fail together and schedule the same first retry.", "active active failure neutral", "attempt", ["500", "0", "0"], "failure"],
        ["First retry wave", "A deterministic one-second delay keeps every client phase-aligned.", "active warning failure neutral", "retry at 1s", ["500", "0", "0"], "warning"],
        ["Recovery meets a wave", "The dependency recovers just before the next synchronized boundary.", "active warning active neutral", "retry at 3s", ["500", "500", "0"], "warning"],
        ["Burst recovery", "Work completes, but the recovering dependency absorbs the entire fleet at once.", "neutral neutral success success", "complete", ["500", "500", "0"], "success"],
      ]),
      preset("full-jitter", "Capped full jitter", "A fixed seed spreads attempts inside each backoff window.", retryNodes, ["Peak retry QPS", "Useful completions", "Abandoned"], [
        ["Dependency fails", "Each client computes a bounded random delay from the same policy.", "active active failure neutral", "attempt", ["500", "0", "0"], "failure"],
        ["Retries spread", "Attempts occupy many time buckets instead of one shared boundary.", "active success warning neutral", "jittered retry", ["146", "0", "0"], "success"],
        ["Capacity returns", "Early jittered attempts begin succeeding without a recovery spike.", "active success active active", "sample recovery", ["118", "312", "0"], "success"],
        ["Budget closes", "Remaining clients complete before the capped attempt and deadline budget.", "neutral success success success", "complete", ["146", "500", "0"], "success"],
      ]),
    ],
  },
  {
    id: "token-bucket", title: "How much burst should the service admit?",
    description: "Watch token refill, burst allowance, sustained admission, and rejection at the edge.", nodes: limiterNodes,
    presets: [
      preset("bounded-burst", "Bounded burst", "A full bucket admits a short burst, then enforces refill rate.", limiterNodes, ["Tokens", "Admitted", "Rejected"], [
        ["Bucket is full", "Ten stored tokens represent the allowed immediate burst.", "active success neutral neutral", "check", ["10", "0", "0"], "success"],
        ["Burst arrives", "Eight requests spend eight tokens atomically and reach the service.", "active warning active active", "spend 8", ["2", "8", "0"], "warning"],
        ["Sustained traffic", "Only the two refilled tokens are admitted on the next tick.", "active warning active warning", "refill 2/s", ["0", "10", "4"], "warning"],
        ["Average is enforced", "The long-run admission rate is bounded while the service stays below saturation.", "neutral success success success", "429 + retry-after", ["0", "12", "8"], "success"],
      ]),
      preset("store-partition", "Limiter store partition", "Compare a safe local emergency budget with unlimited fail-open.", limiterNodes, ["Local budget", "Admitted", "At risk"], [
        ["Shared state fails", "Gateways cannot reach the authoritative token owner.", "active failure neutral neutral", "store timeout", ["4", "0", "0"], "failure"],
        ["Emergency mode", "Each gateway uses a small bounded local budget instead of unlimited fail-open.", "active warning active active", "local spend", ["2", "6", "0"], "warning"],
        ["Budget exhausts", "Further requests are rejected before expensive downstream work.", "active warning success warning", "429", ["0", "8", "12"], "warning"],
        ["Store recovers", "Authoritative state resumes without having exposed unbounded service capacity.", "neutral success success success", "reconcile", ["10", "8", "0"], "success"],
      ]),
    ],
  },
  {
    id: "circuit-breaker", title: "When should callers stop trying?",
    description: "Trip a breaker, fail fast, and probe a recovering dependency without a half-open stampede.", nodes: breakerNodes,
    presets: [
      preset("recovering", "Recovering dependency", "A bounded probe budget protects recovery.", breakerNodes, ["Breaker", "Dependency calls", "Degraded"], [
        ["Closed circuit", "Calls pass while relevant failures accumulate in the rolling window.", "active active failure neutral", "call", ["closed", "20", "4"], "warning"],
        ["Threshold trips", "The breaker opens and subsequent callers receive the cheap fallback.", "active failure failure active", "fast reject", ["open", "20", "24"], "failure"],
        ["Half-open probe", "After cooldown, one controlled probe tests the recovering dependency.", "active warning active active", "one probe", ["half-open", "21", "24"], "warning"],
        ["Circuit closes", "Successful probes restore normal traffic gradually.", "active success success neutral", "resume", ["closed", "30", "24"], "success"],
      ]),
      preset("bad-shard", "Single bad shard", "A shard-scoped breaker preserves healthy traffic.", breakerNodes, ["Open scopes", "Healthy calls", "Failed calls"], [
        ["One shard degrades", "Timeouts are isolated to shard C, not the entire dependency.", "active active warning neutral", "route by shard", ["0", "30", "5"], "warning"],
        ["Shard C opens", "Only the failing partition is fast-rejected.", "active warning failure active", "scope=C", ["1", "60", "5"], "warning"],
        ["Healthy shards continue", "A and B retain useful availability while C cools down.", "active success warning active", "A/B pass", ["1", "90", "5"], "success"],
        ["C recovers", "A scoped probe succeeds and the final circuit closes.", "active success success neutral", "probe C", ["0", "120", "5"], "success"],
      ]),
    ],
  },
  {
    id: "read-write-quorums", title: "Does the read overlap the write?",
    description: "Adjust the acknowledgment story by comparing weak and overlapping replica sets.", nodes: quorumNodes,
    presets: [
      preset("weak", "N=3, W=1, R=1", "Fast operations can miss an acknowledged version.", quorumNodes, ["Write acks", "Read replies", "Newest version"], [
        ["Write v2 begins", "The coordinator sends v2 to the three intended owners.", "active active neutral neutral", "write v2", ["0/1", "0/1", "v1"], "warning"],
        ["One replica acks", "A alone acknowledges, so W=1 reports success while B and C remain stale.", "success success warning warning", "ack", ["1/1", "0/1", "v1"], "success"],
        ["Read chooses C", "R=1 contacts stale replica C and returns v1.", "active success warning failure", "read", ["1/1", "1/1", "v1 stale"], "failure"],
        ["Repair catches up", "Background repair eventually converges, but the completed read was stale.", "neutral success success success", "repair v2", ["1/1", "1/1", "v2"], "warning"],
      ]),
      preset("overlap", "N=3, W=2, R=2", "Same-set overlap exposes an acknowledged version under stated assumptions.", quorumNodes, ["Write acks", "Read replies", "Overlap"], [
        ["Write v2 begins", "All owners receive v2; the coordinator waits for two acknowledgments.", "active active active warning", "write v2", ["0/2", "0/2", "0"], "warning"],
        ["Quorum commits", "A and B acknowledge, establishing the W=2 set.", "success success success warning", "ack", ["2/2", "0/2", "0"], "success"],
        ["Read samples A and C", "The R=2 set intersects the write set at A and compares versions.", "active success neutral active", "read", ["2/2", "2/2", "1 replica"], "success"],
        ["Newest response wins", "The read returns v2; overlap alone still does not claim linearizability.", "neutral success success success", "return v2", ["2/2", "2/2", "1 replica"], "success"],
      ]),
    ],
  },
  {
    id: "replication", title: "What does an acknowledged write protect?",
    description: "Follow log positions, stale reads, and promotion choices across a leader and followers.", nodes: replicationNodes,
    presets: [
      preset("read-after-write", "Read-after-write miss", "An asynchronous follower serves a stale post-write read.", replicationNodes, ["Leader LSN", "Follower LSN", "Read result"], [
        ["Write reaches leader", "The leader durably records order v42 and acknowledges asynchronously.", "active success neutral neutral", "append 42", ["42", "41", "pending"], "success"],
        ["Log shipping lags", "Followers have not applied the acknowledged position.", "active success warning warning", "ship", ["42", "41", "pending"], "warning"],
        ["Read hits follower", "A naive read router returns v41 and misses the customer's new order.", "failure success failure warning", "read", ["42", "41", "stale v41"], "failure"],
        ["Session token routes safely", "The required LSN sends the read to an eligible authority and returns v42.", "success success success warning", "require LSN 42", ["42", "42", "fresh v42"], "success"],
      ]),
      preset("leader-failure", "Leader failure and fencing", "Promote the most current follower without split brain.", replicationNodes, ["Committed LSN", "Promotion LSN", "Active leaders"], [
        ["Leader ships log", "Follower A has the highest known durable log position.", "active success success warning", "replicate", ["105", "105", "1"], "success"],
        ["Leader becomes isolated", "Clients cannot safely infer whether the old leader stopped accepting writes.", "active failure success warning", "partition", ["105", "105", "1?"], "failure"],
        ["Fence then promote", "A new epoch invalidates the old leader before follower A is promoted.", "active failure active warning", "epoch 8", ["105", "105", "1"], "warning"],
        ["Routes converge", "The new leader serves writes with one authoritative epoch and zero modeled RPO.", "success neutral success success", "resume", ["106", "105", "1"], "success"],
      ]),
    ],
  },
  {
    id: "partitioning-sharding", title: "How does ownership move without losing writes?",
    description: "Expose hot-shard skew and a copy, verify, cutover rebalancing sequence.", nodes: shardingNodes,
    presets: [
      preset("hot-tenant", "Hot tenant", "Uniform key counts hide work concentrated on one shard.", shardingNodes, ["Shard A QPS", "Shard B QPS", "Skew"], [
        ["Keys distribute", "The range map appears balanced by stored key count.", "active active success success", "route", ["100", "100", "1.0×"], "success"],
        ["Tenant spikes", "One tenant's range sends most requests to shard A.", "active warning failure success", "hot range", ["900", "100", "9.0×"], "failure"],
        ["Split hot range", "The router introduces a sub-range owned by shard B.", "active warning active active", "dual route", ["520", "480", "1.1×"], "warning"],
        ["Load stabilizes", "Ownership and traffic metrics confirm a balanced cutover.", "neutral success success success", "cutover", ["510", "490", "1.0×"], "success"],
      ]),
      preset("rebalance", "Safe range migration", "Copy and verify before authoritative routing cutover.", shardingNodes, ["Copied keys", "Dual writes", "Missing keys"], [
        ["Plan range move", "Shard A remains authoritative while the router records the target owner.", "active active success neutral", "plan", ["0%", "off", "0"], "success"],
        ["Copy snapshot", "Historical keys stream to shard B while reads stay on A.", "active active warning active", "copy", ["85%", "off", "0"], "warning"],
        ["Catch up writes", "A bounded change stream closes the delta and verifies counts/checksums.", "active active active active", "catch up", ["100%", "on", "0"], "warning"],
        ["Cut over ownership", "The router switches atomically only after verification succeeds.", "neutral success neutral success", "cutover", ["100%", "off", "0"], "success"],
      ]),
    ],
  },
  {
    id: "message-queue-fundamentals", title: "When does buffering become backlog?",
    description: "Follow publish, durable enqueue, consumer acknowledgment, and overload through a bounded queue.", nodes: queueNodes,
    presets: [
      preset("steady", "Steady capacity", "Consumers drain at least as quickly as producers publish.", queueNodes, ["Queue depth", "Oldest age", "Completed"], [
        ["Producer publishes", "Ten jobs enter through a durable broker acknowledgment path.", "active active neutral neutral", "publish 10", ["10", "0s", "0"], "success"],
        ["Consumers claim", "Two consumers each claim bounded work without removing it prematurely.", "neutral active active neutral", "deliver", ["6", "1s", "0"], "success"],
        ["Side effects commit", "Acknowledgments follow the durable downstream effect.", "neutral active active success", "process + ack", ["2", "1s", "8"], "success"],
        ["Queue drains", "Capacity exceeds arrivals and oldest-message age returns to zero.", "neutral success success success", "ack", ["0", "0s", "10"], "success"],
      ]),
      preset("overload", "Producer overload", "Arrival rate exceeds service rate until the bound is visible.", queueNodes, ["Queue depth", "Oldest age", "Rejected"], [
        ["Burst begins", "Twenty jobs arrive while consumers can finish only six per tick.", "active active active neutral", "publish 20", ["20", "0s", "0"], "warning"],
        ["Backlog grows", "The queue absorbs the mismatch, increasing age rather than capacity.", "active warning active active", "deliver 6", ["34", "2s", "0"], "warning"],
        ["Bound is reached", "The bounded broker rejects new low-priority work instead of exhausting memory.", "active failure active warning", "reject", ["40", "4s", "14"], "failure"],
        ["Feedback reduces arrivals", "Producer admission matches service and the backlog begins to drain.", "warning success success active", "slow producer", ["30", "5s", "14"], "success"],
      ]),
    ],
  },
  {
    id: "delivery-semantics", title: "Where can a duplicate appear?",
    description: "Crash a worker around its side effect and compare redelivery with idempotent handling.", nodes: deliveryNodes,
    presets: [
      preset("duplicate", "At-least-once duplicate", "A crash after effect but before ack causes redelivery.", deliveryNodes, ["Deliveries", "Effects", "Duplicates"], [
        ["Message delivered", "The broker starts a visibility timeout for operation pay-42.", "active active neutral neutral", "deliver", ["1", "0", "0"], "success"],
        ["Effect commits", "The worker charges the card, but the broker has not received an acknowledgment.", "active active success neutral", "charge", ["1", "1", "0"], "warning"],
        ["Worker crashes", "Visibility expires and the broker redelivers the same operation.", "active failure active neutral", "redeliver", ["2", "1", "0"], "failure"],
        ["Effect repeats", "Without an idempotency boundary, the second delivery creates a duplicate charge.", "success active failure neutral", "charge again", ["2", "2", "1"], "failure"],
      ]),
      preset("idempotent", "Idempotent consumer", "A stable operation key joins dedupe and effect atomically.", deliveryNodes, ["Deliveries", "Effects", "Duplicates"], [
        ["Message delivered", "The worker starts operation pay-42 with a stable identity.", "active active neutral active", "lookup key", ["1", "0", "0"], "success"],
        ["Effect and key commit", "The side effect and processed key share one durable transaction boundary.", "active active success success", "commit", ["1", "1", "0"], "success"],
        ["Ack is lost", "The broker redelivers, but the durable key survives the worker failure.", "active warning success active", "redeliver", ["2", "1", "0"], "warning"],
        ["Duplicate is suppressed", "The worker recognizes pay-42, skips the effect, and safely acknowledges.", "success success success success", "dedupe + ack", ["2", "1", "0"], "success"],
      ]),
    ],
  },
  {
    id: "consensus-raft", title: "When is a log entry committed?",
    description: "Elect a leader, replicate one command, and preserve safety across a partitioned term change.", nodes: raftNodes,
    presets: [
      preset("election", "Leader election", "A majority vote chooses one leader for a term.", raftNodes, ["Term", "Votes", "Leaders"], [
        ["Followers wait", "All nodes begin as followers with randomized election deadlines.", "neutral neutral neutral active", "heartbeat wait", ["4", "0/3", "0"], "success"],
        ["A becomes candidate", "A increments the term, votes for itself, and requests votes.", "active warning warning active", "request vote", ["5", "1/3", "0"], "warning"],
        ["Majority votes", "B grants its vote because A's log is sufficiently up to date.", "active success warning active", "vote A", ["5", "2/3", "0"], "success"],
        ["A leads term 5", "Heartbeats establish one leader; a minority cannot elect a competing leader.", "success active active active", "append heartbeat", ["5", "2/3", "1"], "success"],
      ]),
      preset("commit", "Replicate and commit", "A command becomes visible only after majority replication.", raftNodes, ["Match index", "Replicas", "Committed"], [
        ["Leader appends x=7", "A writes the new term-5 entry locally but has not committed it.", "active neutral neutral active", "append", ["A:8", "1/3", "no"], "warning"],
        ["B receives entry", "The leader now knows a majority stores the entry.", "active success warning active", "append entries", ["A/B:8", "2/3", "pending"], "success"],
        ["Commit index advances", "A commits index 8 and applies it to the state machine.", "success success warning active", "commit 8", ["A/B:8", "2/3", "yes"], "success"],
        ["Client sees result", "The committed result is returned; C can catch up without changing the decision.", "success success active success", "apply x=7", ["all:8", "3/3", "yes"], "success"],
      ]),
    ],
  },
  {
    id: "distributed-locks", title: "Can an expired owner still write?",
    description: "Compare a lease alone with a monotonically increasing fencing token at the protected resource.", nodes: lockNodes,
    presets: [
      preset("lease-only", "Lease without fencing", "A paused old owner resumes after its lease expires.", lockNodes, ["Lease owner", "Newest token", "Unsafe writes"], [
        ["A acquires lease", "Worker A receives a short lease and begins a long operation.", "active success neutral neutral", "grant A", ["A", "1", "0"], "success"],
        ["A pauses", "A stops making progress long enough for the lease to expire.", "failure warning neutral neutral", "lease expires", ["none", "1", "0"], "warning"],
        ["B acquires", "Worker B becomes the valid owner and writes a newer value.", "failure active success active", "grant B", ["B", "2", "0"], "success"],
        ["A resumes stale", "Without resource-side fencing, A overwrites B despite holding an expired lease.", "failure warning success failure", "stale write", ["B", "2", "1"], "failure"],
      ]),
      preset("fenced", "Lease with fencing", "The resource rejects operations carrying an older token.", lockNodes, ["Lease owner", "Accepted token", "Rejected writes"], [
        ["A gets token 41", "The lease service returns a monotonic ownership token with the lease.", "active success neutral active", "grant 41", ["A", "41", "0"], "success"],
        ["A pauses and expires", "The resource remembers token 41 even when A is not running.", "failure warning neutral active", "expire", ["none", "41", "0"], "warning"],
        ["B gets token 42", "B writes successfully with the newer fencing token.", "failure active success success", "grant 42", ["B", "42", "0"], "success"],
        ["A is fenced", "The resource compares tokens and rejects A's stale token 41.", "warning success success success", "reject 41", ["B", "42", "1"], "success"],
      ]),
    ],
  },
] satisfies readonly ScenarioLabDefinition[];

export function isScenarioLabId(value: string): value is ScenarioLabId {
  return SCENARIO_LABS.some((lab) => lab.id === value);
}
