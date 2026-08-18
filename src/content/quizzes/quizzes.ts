import type { QuizDefinition } from "@/domain/quiz";

export const quizzes = [
  {
    id: "estimation-quiz",
    lessonId: "00-03-estimation",
    title: "Back-of-the-envelope estimation check",
    passThresholdPercent: 80,
    questions: [
      {
        id: "estimation-average-qps", lessonId: "00-03-estimation", type: "numeric-estimation",
        prompt: "A service receives 2.4 million events per day. Estimate its average events per second.",
        correctValue: 27.78, tolerance: { kind: "absolute", value: 0.5 }, unit: "qps",
        explanation: "Divide 2,400,000 by 86,400 seconds per day: about 27.78 events/s. Average QPS is only a baseline; peak and retry load still need explicit assumptions.",
        conceptTags: ["average-qps", "unit-conversion"],
      },
      {
        id: "estimation-egress-bandwidth", lessonId: "00-03-estimation", type: "numeric-estimation",
        prompt: "At 3,000 responses/s and 12 kB per response, estimate decimal egress throughput in MB/s.",
        correctValue: 36, tolerance: { kind: "absolute", value: 1 }, unit: "MB/s",
        explanation: "3,000 × 12 kB = 36,000 kB/s, or about 36 MB/s using decimal units. Multiplying by eight gives roughly 288 Mb/s.",
        conceptTags: ["bandwidth", "unit-conversion"],
      },
      {
        id: "estimation-bits-versus-bytes", lessonId: "00-03-estimation", type: "single-choice",
        prompt: "Which conversion turns 36 MB/s into approximately 288 Mb/s?",
        options: [
          { id: "multiply-by-eight", label: "Multiply by 8" },
          { id: "divide-by-eight", label: "Divide by 8" },
          { id: "multiply-by-one-thousand", label: "Multiply by 1,000" },
        ],
        correctOptionId: "multiply-by-eight",
        explanation: "One byte contains eight bits, so 36 megabytes per second is approximately 288 megabits per second when both use decimal prefixes.",
        conceptTags: ["bandwidth", "unit-conversion"],
      },
      {
        id: "estimation-capacity-inputs", lessonId: "00-03-estimation", type: "multiple-choice",
        prompt: "Which inputs should be included when planning capacity beyond average request rate? Select all that apply.",
        options: [
          { id: "peak-multiplier", label: "Peak-to-average multiplier" },
          { id: "retry-amplification", label: "Retry and fan-out amplification" },
          { id: "failure-headroom", label: "Capacity remaining after a node or region failure" },
          { id: "framework-name", label: "The frontend framework name" },
        ],
        correctOptionIds: ["peak-multiplier", "retry-amplification", "failure-headroom"],
        explanation: "Peak shape, amplified internal work, and failure headroom change required capacity. A framework name does not provide a workload measurement.",
        conceptTags: ["capacity-headroom", "peak-load"],
      },
      {
        id: "estimation-littles-law", lessonId: "00-03-estimation", type: "numeric-estimation",
        prompt: "At 1,200 requests/s and 250 ms average service time, estimate average in-flight requests.",
        correctValue: 300, tolerance: { kind: "absolute", value: 5 }, unit: "requests",
        explanation: "Little's Law gives L = λW. Convert 250 ms to 0.25 s, then 1,200 × 0.25 = 300 in-flight requests on average.",
        conceptTags: ["concurrency", "littles-law"],
      },
    ],
  },
  {
    id: "consistent-hashing-quiz",
    lessonId: "04-10-consistent-hashing",
    title: "Consistent hashing reasoning check",
    passThresholdPercent: 80,
    questions: [
      {
        id: "consistent-hashing-modulo-remapping", lessonId: "04-10-consistent-hashing", type: "single-choice",
        prompt: "Why is hash(key) mod N disruptive when N changes?",
        options: [
          { id: "most-buckets-change", label: "The divisor changes, so most keys compute a different bucket" },
          { id: "hashes-stop-working", label: "Hash functions stop being deterministic" },
          { id: "keys-become-sorted", label: "Keys become range-sorted" },
        ],
        correctOptionId: "most-buckets-change",
        explanation: "Changing N changes the modulo result for most hashes, causing broad remapping even though only one node changed.",
        conceptTags: ["remapping", "modulo-sharding"],
      },
      {
        id: "consistent-hashing-vnodes", lessonId: "04-10-consistent-hashing", type: "multiple-choice",
        prompt: "What can virtual nodes improve? Select all that apply.",
        options: [
          { id: "ownership-balance", label: "Ownership balance across physical nodes" },
          { id: "weighted-capacity", label: "Weighted placement for heterogeneous capacity" },
          { id: "smaller-movement-chunks", label: "Finer-grained movement when membership changes" },
          { id: "hot-key-elimination", label: "Guaranteed elimination of hot keys" },
        ],
        correctOptionIds: ["ownership-balance", "weighted-capacity", "smaller-movement-chunks"],
        explanation: "Many tokens smooth ownership, enable capacity weighting, and divide movement into smaller intervals. They do not split one exceptionally hot key.",
        conceptTags: ["virtual-nodes", "load-balance"],
      },
      {
        id: "consistent-hashing-hot-key", lessonId: "04-10-consistent-hashing", type: "single-choice",
        prompt: "A ring has balanced key counts, but one key receives 40% of requests. What is the main issue?",
        options: [
          { id: "traffic-skew", label: "Traffic skew can overload the key's owner despite balanced ownership" },
          { id: "ring-not-deterministic", label: "The ring is no longer deterministic" },
          { id: "all-keys-remap", label: "All keys remap on every request" },
        ],
        correctOptionId: "traffic-skew",
        explanation: "Balanced key counts do not imply balanced QPS. A hot key may need replication, request coalescing, or application-specific splitting.",
        conceptTags: ["hot-keys", "traffic-skew"],
      },
      {
        id: "consistent-hashing-membership-change", lessonId: "04-10-consistent-hashing", type: "multiple-choice",
        prompt: "What must a durable system coordinate when a node joins or leaves? Select all that apply.",
        options: [
          { id: "ring-version", label: "A consistent ring or placement-map version" },
          { id: "data-migration", label: "Data migration and verification before cutover" },
          { id: "capacity-headroom", label: "Bandwidth and capacity headroom during movement" },
          { id: "rename-hash", label: "Renaming the hash function" },
        ],
        correctOptionIds: ["ring-version", "data-migration", "capacity-headroom"],
        explanation: "Minimized remapping is not a migration protocol. Placement versions, verified movement, and protected foreground capacity remain necessary.",
        conceptTags: ["membership-change", "data-migration"],
      },
      {
        id: "consistent-hashing-guarantee", lessonId: "04-10-consistent-hashing", type: "single-choice",
        prompt: "What does consistent hashing primarily guarantee?",
        options: [
          { id: "bounded-remapping", label: "A membership change remaps only a bounded portion of the keyspace" },
          { id: "perfect-qps-balance", label: "Every node always receives identical QPS" },
          { id: "strong-consistency", label: "Every read observes the latest write" },
        ],
        correctOptionId: "bounded-remapping",
        explanation: "Consistent hashing limits keyspace movement. Balance, hot-key handling, replication, and consistency need additional mechanisms.",
        conceptTags: ["remapping", "trade-offs"],
      },
    ],
  },
] satisfies QuizDefinition[];
