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
const requestLifecycleNodes = [
  node("client", "Client", "Creates one request under an end-to-end deadline.", "client"),
  node("edge", "DNS + edge", "Resolves, connects, terminates TLS, and routes.", "coordinator"),
  node("service", "Application", "Queues and executes business logic.", "service"),
  node("data", "Data store", "Returns the state needed for the response.", "store"),
] as const;
const dnsNodes = [
  node("stub", "Stub resolver", "Starts from browser and OS caches.", "client"),
  node("recursive", "Recursive resolver", "Walks referrals and caches answers.", "coordinator"),
  node("authority", "Authoritative DNS", "Owns the zone and record TTL.", "service"),
  node("endpoint", "Service endpoint", "Receives traffic for the returned address.", "service"),
] as const;
const healthNodes = [
  node("prober", "Health checker", "Samples readiness on a bounded cadence.", "coordinator"),
  node("router", "Traffic router", "Uses the accepted healthy membership view.", "service"),
  node("primary", "Primary instance", "May be slow, failed, or isolated.", "service"),
  node("standby", "Standby instance", "Takes traffic only after safe promotion.", "service"),
] as const;
const indexNodes = [
  node("query", "Query", "Filters and orders rows for one access pattern.", "client"),
  node("planner", "Query planner", "Chooses a scan or an index path.", "coordinator"),
  node("index", "Index", "Maps ordered keys to row locations.", "store"),
  node("table", "Table pages", "Hold complete rows and write amplification.", "store"),
] as const;
const storageTreeNodes = [
  node("writes", "Writes", "Arrive with mixed read/write pressure.", "client"),
  node("memory", "Memory buffer", "Absorbs updates before durable organization.", "store"),
  node("levels", "Tree / levels", "B-tree pages or immutable sorted runs.", "store"),
  node("disk", "Disk I/O", "Exposes random writes, compaction, and reads.", "store"),
] as const;
const invalidationNodes = [
  node("writer", "Writer", "Changes the authoritative value.", "client"),
  node("database", "Database", "Commits versioned source-of-truth state.", "store"),
  node("cache", "Cache", "May hold an older version under a TTL.", "store"),
  node("reader", "Reader", "Observes fresh or stale data through the cache.", "client"),
] as const;
const hotKeyNodes = [
  node("traffic", "Traffic", "A celebrity key dominates otherwise balanced load.", "client"),
  node("router", "Key router", "Hashes requests to owners and replicas.", "coordinator"),
  node("hot-owner", "Hot owner", "Receives the concentrated key workload.", "store"),
  node("capacity", "Relief path", "Replicas, request coalescing, or sharded key state.", "service"),
] as const;
const consumerGroupNodes = [
  node("topic", "Partitioned topic", "Keeps ordered logs per partition.", "queue"),
  node("coordinator", "Group coordinator", "Assigns each partition to one member.", "coordinator"),
  node("consumer-a", "Consumer A", "Processes its current assignment.", "service"),
  node("consumer-b", "Consumer B", "Joins, leaves, or receives reassigned work.", "service"),
] as const;
const dlqNodes = [
  node("source", "Source queue", "Delivers work with a bounded retry policy.", "queue"),
  node("worker", "Consumer", "Classifies transient and permanent failures.", "service"),
  node("dlq", "Dead-letter queue", "Quarantines exhausted poison messages.", "queue"),
  node("operator", "Recovery workflow", "Inspects, fixes, and safely redrives.", "coordinator"),
] as const;
const tracingNodes = [
  node("gateway", "Gateway span", "Starts or propagates trace context.", "service"),
  node("orders", "Orders span", "Records application work and child calls.", "service"),
  node("payments", "Payments span", "May dominate the critical path.", "service"),
  node("collector", "Trace backend", "Samples, joins, and queries spans.", "store"),
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
  {
    id: "request-lifecycle", title: "Where did the request budget go?",
    description: "Trace resolution, connection, queueing, application work, and data access under one deadline.", nodes: requestLifecycleNodes,
    presets: [
      preset("cold-path", "Cold connection path", "No reusable connection or cached resolution is available.", requestLifecycleNodes, ["Elapsed", "Budget left", "Network trips"], [
        ["Resolve destination", "The client misses local DNS caches and spends part of the shared deadline resolving the service.", "active active neutral neutral", "DNS 42ms", ["42ms", "458ms", "2"], "warning"],
        ["Connect and secure", "TCP and TLS handshakes add sequential round trips before application work begins.", "active warning neutral neutral", "connect 88ms", ["130ms", "370ms", "5"], "warning"],
        ["Queue and query", "The request waits behind active work, then the application calls the database.", "active success warning active", "query", ["382ms", "118ms", "6"], "warning"],
        ["Response completes", "Serialization and return transit fit inside the original end-to-end deadline.", "success success success success", "respond", ["456ms", "44ms", "7"], "success"],
      ]),
      preset("warm-path", "Warm pooled path", "Cached DNS and a reused connection expose server time directly.", requestLifecycleNodes, ["Elapsed", "Budget left", "Network trips"], [
        ["Reuse route state", "Cached resolution and an established HTTP/2 connection remove setup round trips.", "active success neutral neutral", "reuse", ["4ms", "496ms", "0"], "success"],
        ["Edge routes", "The edge authenticates and forwards the request without a new connection handshake.", "active success active neutral", "route", ["18ms", "482ms", "1"], "success"],
        ["Application queries", "Most latency now belongs to queueing and the data dependency rather than setup.", "active success active active", "query", ["126ms", "374ms", "2"], "success"],
        ["Response returns", "Connection reuse lowers total latency without changing business work.", "success success success success", "respond", ["148ms", "352ms", "3"], "success"],
      ]),
    ],
  },
  {
    id: "dns", title: "Which DNS answer is still cached?",
    description: "Follow recursive resolution, TTL caching, endpoint migration, and stale-answer behavior.", nodes: dnsNodes,
    presets: [
      preset("recursive-miss", "Recursive cache miss", "A resolver walks the hierarchy and caches the authoritative answer.", dnsNodes, ["Lookups", "Answer TTL", "Endpoint"], [
        ["Stub cache misses", "Neither the application nor operating system has an unexpired answer.", "active active neutral neutral", "query", ["1", "0s", "unknown"], "warning"],
        ["Resolver follows referrals", "The recursive resolver discovers the responsible authoritative zone.", "active warning active neutral", "referral", ["3", "0s", "unknown"], "warning"],
        ["Authority returns A", "The zone returns 203.0.113.10 with a 60-second TTL.", "active active success neutral", "A + TTL", ["4", "60s", "203.0.113.10"], "success"],
        ["Resolver caches", "Subsequent clients reuse the answer until TTL expiry, reducing authority load.", "success success success active", "connect", ["4", "60s", "203.0.113.10"], "success"],
      ]),
      preset("migration", "Endpoint migration", "A TTL bounds but does not instantly remove old answers.", dnsNodes, ["Old-answer users", "TTL left", "Failed connects"], [
        ["Record changes", "The authority points new queries at the replacement endpoint.", "active warning success active", "new A", ["70%", "35s", "0"], "warning"],
        ["Caches retain old A", "Resolvers with unexpired TTLs legitimately continue returning the old address.", "active warning active warning", "cached A", ["52%", "20s", "0"], "warning"],
        ["Old endpoint stops early", "Removing the old endpoint before TTL drains turns valid cached answers into failures.", "failure warning success failure", "connect old", ["31%", "8s", "31"], "failure"],
        ["TTL drains safely", "Keeping both endpoints healthy through the overlap lets all resolvers converge.", "success success success success", "new A", ["0%", "0s", "31"], "success"],
      ]),
    ],
  },
  {
    id: "health-checks-failover", title: "When is an instance safe to receive traffic?",
    description: "Compare readiness hysteresis with a safely fenced failover decision.", nodes: healthNodes,
    presets: [
      preset("flapping", "Flapping readiness", "Consecutive thresholds keep one slow probe from churning membership.", healthNodes, ["Probe failures", "Healthy targets", "Route changes"], [
        ["All targets ready", "The router has an accepted healthy view based on recent successful probes.", "active success success neutral", "route", ["0", "2", "0"], "success"],
        ["One probe is slow", "A single timeout is recorded but does not immediately eject the primary.", "warning success warning neutral", "probe timeout", ["1", "2", "0"], "warning"],
        ["Threshold is crossed", "Three consecutive failures remove the primary from new-request routing.", "failure active failure active", "eject", ["3", "1", "1"], "failure"],
        ["Recovery is stable", "Two successful probes restore readiness without rapid membership flapping.", "success success active active", "restore", ["0", "2", "2"], "success"],
      ]),
      preset("safe-failover", "Safe primary failover", "Detection, fencing, promotion, and routing happen in that order.", healthNodes, ["Primary epoch", "Active writers", "Failover time"], [
        ["Primary is isolated", "Health checks detect loss of reachability but cannot prove the old writer stopped.", "failure warning failure active", "detect", ["12", "1?", "2s"], "failure"],
        ["Old epoch is fenced", "The coordinator invalidates epoch 12 before enabling a replacement writer.", "active warning failure active", "fence 12", ["13", "0", "3s"], "warning"],
        ["Standby promotes", "The most current standby becomes primary under epoch 13.", "active active failure success", "promote", ["13", "1", "5s"], "success"],
        ["Router converges", "Traffic moves only after the promoted writer reports ready for epoch 13.", "success success neutral success", "route", ["13", "1", "7s"], "success"],
      ]),
    ],
  },
  {
    id: "database-indexes", title: "When does an index avoid a table scan?",
    description: "Compare scan cost, composite-key order, covering reads, and write amplification.", nodes: indexNodes,
    presets: [
      preset("selective", "Selective lookup", "A matching composite index prunes almost all table pages.", indexNodes, ["Rows examined", "Pages read", "Write indexes"], [
        ["Filter arrives", "The query asks for one tenant and a recent created-at range.", "active active neutral neutral", "plan", ["1,000,000", "8,200", "2"], "warning"],
        ["Planner matches prefix", "An index on tenant_id, created_at supports equality then ordered range lookup.", "active success active neutral", "seek", ["240", "5", "2"], "success"],
        ["Index locates rows", "Leaf entries identify a small candidate set in key order.", "active success success active", "fetch rows", ["240", "18", "2"], "success"],
        ["Query completes", "The index lowers read work while every future write must maintain the extra structure.", "success success success success", "return", ["240", "18", "2"], "success"],
      ]),
      preset("wrong-order", "Wrong composite order", "An index exists but its leading column cannot prune this predicate.", indexNodes, ["Rows examined", "Pages read", "Plan"], [
        ["Index is present", "The table has an index on status, tenant_id, but the query filters only tenant_id.", "active active active neutral", "consider", ["1,000,000", "8,200", "pending"], "warning"],
        ["Leading key is missing", "The planner cannot efficiently seek past every possible status value.", "active warning warning neutral", "reject index", ["1,000,000", "8,200", "scan"], "failure"],
        ["Table scan runs", "Every table page is examined even though a similarly named index exists.", "active warning neutral failure", "scan", ["1,000,000", "8,200", "scan"], "failure"],
        ["Access pattern fixes design", "Reordering to tenant_id, status matches the actual query prefix.", "success success success active", "new seek", ["1,400", "32", "index"], "success"],
      ]),
    ],
  },
  {
    id: "btree-lsm", title: "Where does storage-engine work move?",
    description: "Contrast in-place B-tree maintenance with buffered LSM writes, read amplification, and compaction.", nodes: storageTreeNodes,
    presets: [
      preset("btree", "B-tree update", "A point update descends and rewrites bounded tree pages.", storageTreeNodes, ["Write latency", "Read runs", "Background I/O"], [
        ["Update arrives", "The engine locates the target key through the root and internal pages.", "active active active neutral", "descend", ["1ms", "1", "0 MB/s"], "success"],
        ["Leaf page changes", "The mutable leaf is updated; a full page may be written for a small record.", "active active warning active", "page write", ["4ms", "1", "2 MB/s"], "warning"],
        ["Split propagates", "A full leaf splits and updates parent separator keys.", "active warning warning active", "split", ["12ms", "1", "8 MB/s"], "warning"],
        ["Reads stay direct", "Point reads follow one ordered tree despite occasional write spikes.", "neutral success success success", "seek", ["4ms p50", "1", "1 MB/s"], "success"],
      ]),
      preset("lsm", "LSM flush and compaction", "Fast buffered writes create later read and compaction work.", storageTreeNodes, ["Write latency", "Read runs", "Compaction I/O"], [
        ["Append to memory", "The write enters a WAL and sorted memtable without an in-place disk update.", "active success neutral active", "WAL + mem", ["0.8ms", "1", "0 MB/s"], "success"],
        ["Memtable flushes", "An immutable sorted run is written sequentially to level zero.", "active warning active active", "flush", ["1.2ms", "4", "18 MB/s"], "warning"],
        ["Read checks runs", "Bloom filters help, but a miss may consult several overlapping files.", "active neutral warning active", "lookup", ["1.2ms", "4", "18 MB/s"], "warning"],
        ["Compaction merges", "Background merging restores read shape while consuming write bandwidth.", "neutral success success warning", "compact", ["2.1ms", "2", "64 MB/s"], "success"],
      ]),
    ],
  },
  {
    id: "cache-invalidation", title: "Which version can a reader observe?",
    description: "Step through cache-aside races and version-aware invalidation after a database commit.", nodes: invalidationNodes,
    presets: [
      preset("delete-race", "Delete-then-write race", "Invalidating before commit lets an old value repopulate the cache.", invalidationNodes, ["DB version", "Cache version", "Stale reads"], [
        ["Cache entry is deleted", "The writer removes cached v1 before the database transaction commits v2.", "active neutral warning active", "delete v1", ["v1", "empty", "0"], "warning"],
        ["Reader misses cache", "A concurrent reader loads still-current database v1.", "active active warning active", "read v1", ["v1", "empty", "0"], "warning"],
        ["Stale value repopulates", "The reader writes v1 back just before the writer commits v2.", "active success failure active", "set v1", ["v2", "v1", "0"], "failure"],
        ["Staleness persists", "Future readers receive cached v1 until TTL or another invalidation repairs it.", "neutral success failure failure", "serve v1", ["v2", "v1", "23"], "failure"],
      ]),
      preset("commit-invalidate", "Commit then invalidate", "Versioned invalidation prevents older fills from winning.", invalidationNodes, ["DB version", "Cache version", "Stale reads"], [
        ["Database commits v2", "The source of truth advances before an invalidation event is published.", "active success active active", "commit v2", ["v2", "v1", "0"], "success"],
        ["Invalidation carries version", "The cache learns that entries older than v2 are no longer eligible.", "active success active active", "invalidate <v2", ["v2", "empty", "0"], "success"],
        ["Reader reloads", "A miss reads v2 and fills only if its version is not older than the invalidation watermark.", "neutral success active success", "fill v2", ["v2", "v2", "0"], "success"],
        ["Readers converge", "Subsequent cache hits return the committed version while TTL remains a safety bound.", "neutral success success success", "serve v2", ["v2", "v2", "0"], "success"],
      ]),
    ],
  },
  {
    id: "hot-keys", title: "Can one key overload a balanced fleet?",
    description: "Expose concentrated ownership and compare replication with request coalescing for a hot key.", nodes: hotKeyNodes,
    presets: [
      preset("single-owner", "Single hot owner", "Consistent distribution of keys does not distribute traffic within one key.", hotKeyNodes, ["Hot-key QPS", "Owner CPU", "p99"], [
        ["Baseline is balanced", "Many ordinary keys distribute evenly across storage owners.", "active success success neutral", "hash keys", ["120", "34%", "18ms"], "success"],
        ["One key trends", "A celebrity profile suddenly attracts most reads but still maps to one owner.", "active active warning neutral", "same key", ["8,000", "91%", "120ms"], "warning"],
        ["Owner saturates", "More unrelated nodes do not help because every hot-key request has the same owner.", "active success failure neutral", "queue", ["12,000", "100%", "940ms"], "failure"],
        ["Requests time out", "Retries amplify the same concentrated path and useful throughput falls.", "failure warning failure neutral", "retry", ["19,000", "100%", "timeout"], "failure"],
      ]),
      preset("coalesced", "Replicated and coalesced", "Read replicas and one in-flight fill bound origin work.", hotKeyNodes, ["Client QPS", "Origin QPS", "p99"], [
        ["Hot reads arrive", "The router spreads eligible reads across several replicas.", "active success active active", "replica read", ["12,000", "600", "45ms"], "success"],
        ["Entry expires", "A cache miss occurs simultaneously across many callers.", "active warning active warning", "miss", ["12,000", "600", "82ms"], "warning"],
        ["One fill owns refresh", "Request coalescing lets one caller refresh while others await or use bounded stale data.", "active success active success", "single fill", ["12,000", "1", "90ms"], "success"],
        ["Fresh replicas serve", "The refreshed value fans out without returning the burst to the origin owner.", "success success success success", "serve", ["12,000", "1", "48ms"], "success"],
      ]),
    ],
  },
  {
    id: "partitions-consumer-groups", title: "Who owns each partition now?",
    description: "Observe parallel consumption, partition limits, and a safe rebalance with offset handoff.", nodes: consumerGroupNodes,
    presets: [
      preset("parallelism", "Partition-limited parallelism", "Consumer count beyond partition count creates idle members.", consumerGroupNodes, ["Partitions", "Consumers", "Idle members"], [
        ["Three partitions exist", "Ordering is independent per partition and each has one active group owner.", "active active active active", "assign", ["3", "2", "0"], "success"],
        ["Two consumers work", "Consumer A owns two partitions while B owns one.", "active success active active", "poll", ["3", "2", "0"], "success"],
        ["Two members join", "Four consumers compete, but only three partitions can be processed in parallel.", "active warning active active", "rebalance", ["3", "4", "1"], "warning"],
        ["Assignments settle", "One member remains idle by design; adding consumers cannot exceed partition parallelism.", "success success success success", "resume", ["3", "4", "1"], "success"],
      ]),
      preset("rebalance", "Offset-safe rebalance", "Revoke, commit, assign, and resume without concurrent ownership.", consumerGroupNodes, ["Lag", "Duplicate risk", "Paused time"], [
        ["Consumer B leaves", "The coordinator starts a new group generation and pauses affected ownership.", "active warning active failure", "leave", ["420", "low", "0.2s"], "warning"],
        ["A revokes partition", "The old owner finishes in-flight work and commits the last safe offset.", "active active warning failure", "revoke + commit", ["510", "medium", "1.1s"], "warning"],
        ["New assignment begins", "The coordinator assigns the orphaned partition only after revocation completes.", "active success active active", "assign", ["580", "low", "1.8s"], "success"],
        ["Consumption catches up", "The new owner resumes from the committed offset and drains accumulated lag.", "success success success success", "poll", ["40", "low", "1.8s"], "success"],
      ]),
    ],
  },
  {
    id: "dead-letter-queues", title: "When should a message stop retrying?",
    description: "Separate transient recovery from poison-message quarantine and controlled redrive.", nodes: dlqNodes,
    presets: [
      preset("poison", "Poison message", "A permanent schema error consumes its bounded attempts, then leaves the hot path.", dlqNodes, ["Attempts", "Source lag", "DLQ depth"], [
        ["Message fails validation", "The consumer classifies an unknown required field instead of treating it as a timeout.", "active warning neutral neutral", "attempt 1", ["1/3", "18", "0"], "warning"],
        ["Bounded retry repeats", "A second delivery confirms the failure is deterministic, not transient.", "active failure neutral neutral", "attempt 2", ["2/3", "31", "0"], "failure"],
        ["Attempt budget exhausts", "The broker moves the original payload and failure metadata to the DLQ.", "success warning active neutral", "dead-letter", ["3/3", "12", "1"], "warning"],
        ["Healthy work proceeds", "Quarantine prevents one poison message from blocking the source partition indefinitely.", "success success active active", "continue", ["3/3", "0", "1"], "success"],
      ]),
      preset("redrive", "Controlled redrive", "An operator fixes the cause and replays through an idempotent path.", dlqNodes, ["DLQ depth", "Redriven", "Repeated effects"], [
        ["Failure is inspected", "Payload, error class, code version, and first/last failure times identify a schema mismatch.", "neutral neutral active active", "inspect", ["25", "0", "0"], "success"],
        ["Consumer is corrected", "A compatible parser deploys before any message is copied back.", "neutral success active active", "deploy", ["25", "0", "0"], "success"],
        ["Canary redrive", "One idempotency-keyed message verifies the fix and downstream side effect.", "active active warning active", "redrive 1", ["24", "1", "0"], "warning"],
        ["Batch redrive completes", "Rate-limited replay drains the DLQ without recreating the original incident.", "success success success success", "redrive 24", ["0", "25", "0"], "success"],
      ]),
    ],
  },
  {
    id: "distributed-tracing", title: "Which span controls user latency?",
    description: "Propagate trace context, reconstruct the critical path, and expose tail-sampling trade-offs.", nodes: tracingNodes,
    presets: [
      preset("critical-path", "Slow payment dependency", "Nested spans reveal where the end-to-end request waits.", tracingNodes, ["Trace duration", "Payment span", "Missing spans"], [
        ["Gateway starts trace", "A trace ID and root span capture the inbound request budget and sampling context.", "active neutral neutral active", "traceparent", ["8ms", "0ms", "0"], "success"],
        ["Orders calls payments", "The orders span records a child dependency call instead of one opaque server duration.", "active active active active", "child span", ["62ms", "38ms", "0"], "success"],
        ["Payment stalls", "The payment child dominates the critical path while unrelated work completes earlier.", "active warning failure active", "wait", ["842ms", "790ms", "0"], "failure"],
        ["Trace joins", "The backend aligns parent/child timestamps and makes the 790ms dependency wait explicit.", "success success warning success", "export", ["860ms", "790ms", "0"], "success"],
      ]),
      preset("tail-sampling", "Tail-based error sampling", "The collector retains a rare failed trace after observing its outcome.", tracingNodes, ["Incoming traces", "Stored traces", "Error traces kept"], [
        ["Requests begin unsampled", "Spans are buffered briefly because the final latency and status are not known yet.", "active active active warning", "buffer", ["10,000", "0", "0%"], "warning"],
        ["Most traces succeed", "Fast successful traces become candidates for aggressive sampling.", "active success success warning", "classify", ["10,000", "0", "0%"], "success"],
        ["Rare error completes", "One trace ends with a payment error and becomes high-value diagnostic evidence.", "active warning failure active", "error", ["10,000", "0", "100% pending"], "warning"],
        ["Policy retains the tail", "The backend keeps all errors plus a small success sample within storage budget.", "success success warning success", "store", ["10,000", "120", "100%"], "success"],
      ]),
    ],
  },
] satisfies readonly ScenarioLabDefinition[];

export function isScenarioLabId(value: string): value is ScenarioLabId {
  return SCENARIO_LABS.some((lab) => lab.id === value);
}
