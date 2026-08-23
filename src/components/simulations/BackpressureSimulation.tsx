"use client";

import { useCallback, useMemo, useState } from "react";

import {
  BACKPRESSURE_ADMISSION_POLICIES,
  BACKPRESSURE_MAX_ARRIVAL_RATE,
  BACKPRESSURE_MAX_CONSUMERS,
  BACKPRESSURE_MAX_DOWNSTREAM_LIMIT,
  BACKPRESSURE_MAX_PREFETCH,
  BACKPRESSURE_MAX_RETRY_LIMIT,
  BACKPRESSURE_MAX_SERVICE_RATE,
  BACKPRESSURE_PRESETS,
  BACKPRESSURE_PRIORITY_POLICIES,
  backpressureMetrics,
  createBackpressureState,
  toBackpressureSimulationMetrics,
  transitionBackpressure,
  type BackpressureAction,
  type BackpressureAdmissionPolicy,
  type BackpressureMetrics,
  type BackpressurePriorityPolicy,
  type BackpressurePresetId,
  type BackpressureState,
} from "@/simulations/backpressure";
import type { SimulationEvent } from "@/simulations/types";

import { SimulationShell } from "./SimulationShell";
import type {
  SimulationCompletionFactory,
  SimulationRepository,
} from "./simulation-types";

export interface BackpressureSimulationProps {
  lessonId?: string;
  repository?: SimulationRepository;
  completionFactory?: SimulationCompletionFactory;
}

export function BackpressureSimulation({
  lessonId,
  repository,
  completionFactory,
}: BackpressureSimulationProps) {
  const [presetId, setPresetId] = useState<BackpressurePresetId>("steady-capacity");
  const [state, setState] = useState<BackpressureState>(() => createBackpressureState("steady-capacity"));
  const [error, setError] = useState<string | null>(null);
  const metrics = useMemo(() => backpressureMetrics(state), [state]);

  const apply = useCallback((action: BackpressureAction) => {
    try {
      const transition = transitionBackpressure(state, action);
      setState(transition.state);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The backpressure action could not be applied.");
    }
  }, [state]);

  const step = useCallback(() => apply({ type: "step" }), [apply]);
  const reset = useCallback(() => {
    setState(createBackpressureState(presetId));
    setError(null);
  }, [presetId]);
  const selectPreset = useCallback((nextPresetId: string) => {
    if (!isBackpressurePresetId(nextPresetId)) return;
    setPresetId(nextPresetId);
    setState(createBackpressureState(nextPresetId));
    setError(null);
  }, []);

  const simulationMetrics = toBackpressureSimulationMetrics(metrics);
  const simulationEvents = state.events as readonly SimulationEvent[];

  return (
    <SimulationShell<BackpressureState, BackpressureAction>
      simulationId="backpressure"
      lessonId={lessonId}
      title="Where does overload go?"
      description="Replay a producer, bounded broker, partitioned worker pool, and downstream dependency. Change the feedback policy and make queue growth, memory, loss, and retry traffic visible."
      state={state}
      dispatch={apply}
      onStep={step}
      onReset={reset}
      onPresetChange={selectPreset}
      metrics={simulationMetrics}
      events={simulationEvents}
      explanation={explanationFor(state, metrics)}
      summary={summaryFor(metrics)}
      presets={BACKPRESSURE_PRESETS}
      presetId={presetId}
      isComplete={state.completion.completed}
      externalError={error}
      repository={repository}
      completionFactory={completionFactory}
      initialStatus={error ?? "Use Step to compare arrival, service, backlog, and feedback."}
      controls={({ dispatch, announce }) => (
        <fieldset className="simulation-controls simulation-controls--backpressure">
          <legend>Capacity and backpressure controls</legend>
          <RangeControl
            id="backpressure-arrival-rate"
            label="Arrival rate"
            value={state.config.arrivalRate}
            min={0}
            max={BACKPRESSURE_MAX_ARRIVAL_RATE}
            output={`${state.config.arrivalRate} jobs/tick`}
            valueText={`${state.config.arrivalRate} producer jobs per tick`}
            onChange={(rate) => {
              dispatch({ type: "set-arrival-rate", rate });
              announce(`Arrival rate is ${rate} jobs per tick.`);
            }}
          />
          <RangeControl
            id="backpressure-service-rate"
            label="Service rate per consumer"
            value={state.config.serviceRate}
            min={0}
            max={BACKPRESSURE_MAX_SERVICE_RATE}
            output={`${state.config.serviceRate} jobs/tick`}
            valueText={`${state.config.serviceRate} jobs per consumer per tick`}
            onChange={(rate) => {
              dispatch({ type: "set-service-rate", rate });
              announce(`Service rate is ${rate} jobs per consumer per tick.`);
            }}
          />
          <RangeControl
            id="backpressure-queue-capacity"
            label="Bounded queue capacity"
            value={state.config.queueCapacity}
            min={1}
            max={80}
            output={`${state.config.queueCapacity} jobs`}
            valueText={`${state.config.queueCapacity} queued jobs maximum`}
            onChange={(capacity) => {
              dispatch({ type: "set-queue-capacity", capacity });
              announce(`Queue capacity is ${capacity} jobs.`);
            }}
          />
          <RangeControl
            id="backpressure-prefetch"
            label="Prefetch per consumer"
            value={state.config.prefetch}
            min={1}
            max={BACKPRESSURE_MAX_PREFETCH}
            output={`${state.config.prefetch} jobs`}
            valueText={`${state.config.prefetch} unacknowledged jobs per consumer`}
            onChange={(count) => {
              dispatch({ type: "set-prefetch", count });
              announce(`Prefetch is ${count} jobs per consumer.`);
            }}
          />
          <RangeControl
            id="backpressure-consumer-count"
            label="Consumer count"
            value={state.config.consumerCount}
            min={1}
            max={BACKPRESSURE_MAX_CONSUMERS}
            output={`${state.config.consumerCount} consumers`}
            valueText={`${state.config.consumerCount} consumers`}
            onChange={(count) => {
              dispatch({ type: "set-consumer-count", count });
              announce(`Consumer count is ${count}.`);
            }}
          />
          <RangeControl
            id="backpressure-downstream-limit"
            label="Downstream concurrency limit"
            value={state.config.downstreamLimit}
            min={1}
            max={BACKPRESSURE_MAX_DOWNSTREAM_LIMIT}
            output={`${state.config.downstreamLimit} calls`}
            valueText={`${state.config.downstreamLimit} downstream calls maximum`}
            onChange={(limit) => {
              dispatch({ type: "set-downstream-limit", limit });
              announce(`Downstream concurrency is limited to ${limit} calls.`);
            }}
          />
          <RangeControl
            id="backpressure-retry-limit"
            label="Retries after failure"
            value={state.config.retryLimit}
            min={0}
            max={BACKPRESSURE_MAX_RETRY_LIMIT}
            output={`${state.config.retryLimit} retries`}
            valueText={`${state.config.retryLimit} retries after each failed attempt`}
            onChange={(count) => {
              dispatch({ type: "set-retry-limit", count });
              announce(`Retry limit is ${count}.`);
            }}
          />
          <div className="simulation-control__selects">
            <label className="simulation-control">
              <span>Priority handling</span>
              <select
                value={state.config.priorityPolicy}
                onChange={(event) => {
                  const policy = event.target.value as BackpressurePriorityPolicy;
                  dispatch({ type: "set-priority-policy", policy });
                  announce(priorityLabel(policy));
                }}
              >
                {BACKPRESSURE_PRIORITY_POLICIES.map((policy) => (
                  <option key={policy} value={policy}>{priorityLabel(policy)}</option>
                ))}
              </select>
            </label>
            <label className="simulation-control">
              <span>Admission / shedding</span>
              <select
                value={state.config.admissionPolicy}
                onChange={(event) => {
                  const policy = event.target.value as BackpressureAdmissionPolicy;
                  dispatch({ type: "set-admission-policy", policy });
                  announce(admissionLabel(policy));
                }}
              >
                {BACKPRESSURE_ADMISSION_POLICIES.map((policy) => (
                  <option key={policy} value={policy}>{admissionLabel(policy)}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="simulation-control__buttons" role="group" aria-label="Dependency failure controls">
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                dispatch({ type: state.runtime.downstreamAvailable ? "inject-outage" : "recover-outage" });
                announce(state.runtime.downstreamAvailable ? "Downstream outage injected; inspect retries and queue age." : "Downstream recovered; inspect recovery and backlog drain.");
              }}
            >
              {state.runtime.downstreamAvailable ? "Inject outage" : "Recover outage"}
            </button>
          </div>
        </fieldset>
      )}
    >
      <BackpressureGraphic state={state} metrics={metrics} />
      <BackpressureTable state={state} metrics={metrics} />
    </SimulationShell>
  );
}

function RangeControl({
  id,
  label,
  value,
  min,
  max,
  output,
  valueText,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  output: string;
  valueText: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="simulation-control simulation-control--range" htmlFor={id}>
      <span>{label}</span>
      <output htmlFor={id}>{output}</output>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        aria-valuetext={valueText}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function BackpressureGraphic({
  state,
  metrics,
}: {
  state: BackpressureState;
  metrics: BackpressureMetrics;
}) {
  const history = state.history;
  const historyMax = Math.max(state.config.queueCapacity, 1, ...history.map((point) => point.queueDepth));
  const historyLeft = 28;
  const historyRight = 926;
  const historyTop = 284;
  const historyBottom = 346;
  const historyX = (index: number) => history.length <= 1
    ? (historyLeft + historyRight) / 2
    : historyLeft + (index / (history.length - 1)) * (historyRight - historyLeft);
  const historyY = (value: number) => historyBottom - (value / historyMax) * (historyBottom - historyTop);
  const queueBarWidth = 118;
  const queueFillWidth = queueBarWidth * Math.min(1, metrics.queueUtilization);
  const path = history.map((point, index) => `${index === 0 ? "M" : "L"} ${historyX(index).toFixed(1)} ${historyY(point.queueDepth).toFixed(1)}`).join(" ");
  const titleId = "backpressure-flow-title";
  const description = `At tick ${metrics.tick}, the producer offers ${metrics.arrivalRate} jobs per tick, the broker holds ${metrics.queueDepth} of ${metrics.queueCapacity}, workers hold ${metrics.inFlightMemory} of ${metrics.inFlightMemoryCapacity} prefetch slots, throughput is ${metrics.throughput}, and ${metrics.downstreamAvailable ? "the downstream is healthy" : "the downstream is in outage"}. The exact table below repeats queue age, retries, saturation, and loss.`;

  return (
    <>
      <figure className="simulation-graphic simulation-graphic--backpressure">
        <svg viewBox="0 0 960 360" role="img" aria-labelledby={titleId}>
          <title id={titleId}>Queue and backpressure flow</title>
          <desc>{description}</desc>
          <defs>
            <pattern id="backpressure-outage-pattern" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="var(--danger)" strokeWidth="2" opacity="0.35" />
            </pattern>
          </defs>
          <line className="simulation-svg__edge" x1="160" y1="91" x2="198" y2="91" />
          <line className="simulation-svg__edge" x1="392" y1="91" x2="438" y2="91" />
          <line className="simulation-svg__edge" x1="638" y1="91" x2="684" y2="91" />
          <polygon points="198,91 188,85 188,97" fill="var(--accent)" />
          <polygon points="438,91 428,85 428,97" fill="var(--accent)" />
          <polygon points="684,91 674,85 674,97" fill="var(--accent)" />

          <g className="simulation-svg__node">
            <rect x="20" y="48" width="140" height="86" rx="10" />
            <text className="simulation-svg__label" x="90" y="75" textAnchor="middle">Producer</text>
            <text className="simulation-svg__meta" x="90" y="98" textAnchor="middle">λ {metrics.arrivalRate} jobs/tick</text>
            <text className="simulation-svg__meta" x="90" y="117" textAnchor="middle">{metrics.generated} generated</text>
          </g>

          <g className="simulation-svg__node">
            <rect x="198" y="30" width="194" height="122" rx="10" />
            <text className="simulation-svg__label" x="295" y="57" textAnchor="middle">Broker / partitions</text>
            <rect x="218" y="76" width={queueBarWidth} height="14" rx="3" fill="var(--surface-subtle)" stroke="var(--border-strong)" />
            <rect x="218" y="76" width={queueFillWidth} height="14" rx="3" fill="var(--accent)" opacity="0.75" />
            <text className="simulation-svg__meta" x="218" y="109">queue {metrics.queueDepth}/{metrics.queueCapacity}</text>
            <text className="simulation-svg__meta" x="218" y="128">oldest {metrics.oldestAgeTicks} tick{metrics.oldestAgeTicks === 1 ? "" : "s"}</text>
            {metrics.partitionDepths.map((depth, index) => (
              <g key={`partition-${index + 1}`}>
                <rect x={332 + (index % 2) * 25} y={71 + Math.floor(index / 2) * 19} width="19" height="14" rx="2" fill="var(--surface-raised)" stroke="var(--border-strong)" />
                <text className="simulation-svg__meta" x={341.5 + (index % 2) * 25} y={81 + Math.floor(index / 2) * 19} textAnchor="middle" fontSize="9">p{index + 1}:{depth}</text>
              </g>
            ))}
          </g>

          <g className="simulation-svg__node">
            <rect x="438" y="30" width="200" height="122" rx="10" />
            <text className="simulation-svg__label" x="538" y="57" textAnchor="middle">Workers</text>
            <text className="simulation-svg__meta" x="538" y="82" textAnchor="middle">{state.config.consumerCount} consumers × {state.config.prefetch} prefetch</text>
            <text className="simulation-svg__meta" x="538" y="102" textAnchor="middle">{metrics.workerBufferDepth} buffered, {metrics.processingCount} active</text>
            <text className="simulation-svg__meta" x="538" y="122" textAnchor="middle">capacity {metrics.serviceCapacity} jobs/tick</text>
          </g>

          <g className="simulation-svg__node">
            <rect x="684" y="30" width="246" height="122" rx="10" fill={metrics.downstreamAvailable ? "var(--surface-raised)" : "url(#backpressure-outage-pattern)"} />
            <text className="simulation-svg__label" x="807" y="57" textAnchor="middle">Downstream dependency</text>
            <text className="simulation-svg__meta" x="807" y="82" textAnchor="middle">limit {metrics.downstreamLimit} concurrent calls</text>
            <text className="simulation-svg__meta" x="807" y="102" textAnchor="middle">saturation {metrics.downstreamAvailable ? `${Math.round(metrics.dependencySaturation * 100)}%` : "outage"}</text>
            <text className="simulation-svg__meta" x="807" y="122" textAnchor="middle">{metrics.downstreamAvailable ? "healthy completions" : "calls fail / safe policies pause"}</text>
          </g>

          <text className="simulation-svg__caption" x="28" y="270">Queue depth history (last {history.length} ticks; max {historyMax})</text>
          <line className="simulation-svg__edge" x1={historyLeft} y1={historyBottom} x2={historyRight} y2={historyBottom} />
          <line className="simulation-svg__edge" x1={historyLeft} y1={historyTop} x2={historyLeft} y2={historyBottom} />
          {path ? <path d={path} fill="none" stroke="var(--accent)" strokeWidth="3" /> : null}
          <text className="simulation-svg__meta" x="38" y="300">0</text>
          <text className="simulation-svg__meta" x="38" y="338">{historyMax}</text>
          <text className="simulation-svg__meta" x="926" y="358" textAnchor="end">tick {metrics.tick}</text>
        </svg>
        <figcaption>{description}</figcaption>
      </figure>
    </>
  );
}

function BackpressureTable({
  state,
  metrics,
}: {
  state: BackpressureState;
  metrics: BackpressureMetrics;
}) {
  const rows = [
    ["Tick", String(metrics.tick), "One deterministic producer/worker cycle."],
    ["Arrival λ", `${metrics.arrivalRate} jobs/tick`, "Current authored rate, including the finite burst window."],
    ["Queue depth / bound", `${metrics.queueDepth} / ${metrics.queueCapacity}`, `${Math.round(metrics.queueUtilization * 100)}% full; oldest age ${metrics.oldestAgeTicks} ticks.`],
    ["Partition depths", metrics.partitionDepths.map((depth, index) => `p${index + 1} ${depth}`).join(" · "), "Logical broker partitions; workers share the bounded pool."],
    ["Worker memory", `${metrics.inFlightMemory} / ${metrics.inFlightMemoryCapacity}`, "Prefetched plus active, unacknowledged jobs."],
    ["Throughput", `${metrics.throughput} jobs/tick`, `Worker/dependency capacity is ${metrics.serviceCapacity} jobs/tick.`],
    ["Dependency", metrics.downstreamAvailable ? `${Math.round(metrics.dependencySaturation * 100)}% saturated` : "outage", `${metrics.processingCount}/${metrics.downstreamLimit} downstream calls active.`],
    ["Retries", `${metrics.retries} (${metrics.retryAmplification.toFixed(2)}× amplification)`, `${metrics.retryBacklog} retry jobs waiting; ${metrics.outageFailures} outage failures.`],
    ["Rejected / dropped", `${metrics.rejected} / ${metrics.dropped}`, `${metrics.throttled} fresh arrivals were throttled.`],
    ["Pending logical work", String(metrics.pendingWork), `${metrics.completed} completed of ${metrics.generated} generated.`],
    ["Recovery drain", metrics.recoveryTimeTicks === null ? (metrics.recoveryElapsedTicks === null ? "not observed" : `${metrics.recoveryElapsedTicks} ticks draining`) : `${metrics.recoveryTimeTicks} ticks post-recovery`, metrics.recoveryComplete ? "Backlog drained after the dependency recovered." : "The elapsed value starts at the recovery signal; final time appears only after pending work drains."],
    ["Policy", `${priorityLabel(state.config.priorityPolicy)} · ${admissionLabel(state.config.admissionPolicy)}`, "Feedback determines which work waits, sheds, or is rejected."],
  ] as const;

  return (
    <div className="simulation-table-wrap">
      <table className="simulation-table" aria-label="Exact queue and backpressure metrics">
        <caption>Exact queue and backpressure metrics</caption>
        <thead>
          <tr><th scope="col">Signal</th><th scope="col">Value</th><th scope="col">Meaning</th></tr>
        </thead>
        <tbody>
          {rows.map(([label, value, detail]) => (
            <tr key={label}><th scope="row">{label}</th><td>{value}</td><td>{detail}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="simulation-table__note">The model tracks {metrics.generated} logical jobs and samples no more than one record per job in the bounded state; retry attempts reuse the same logical job.</p>
    </div>
  );
}

function explanationFor(state: BackpressureState, metrics: BackpressureMetrics): string {
  if (!metrics.downstreamAvailable) {
    if (state.config.admissionPolicy === "buffer") {
      return `The dependency is unavailable, but the open buffer keeps issuing calls. ${metrics.retries} retries now compete with fresh arrivals, so retry traffic amplifies pressure.`;
    }
    return `The dependency is unavailable. ${admissionLabel(state.config.admissionPolicy)} pauses unsafe calls, spending freshness or availability to protect the failing dependency.`;
  }
  if (metrics.rejected > 0 || metrics.dropped > 0) {
    return `${metrics.rejected + metrics.dropped} logical jobs have an explicit outcome because the finite capacity was reached. That visible loss is the backpressure signal, not hidden queue growth.`;
  }
  if (metrics.queueDepth > 0) {
    return `Arrival is ahead of the capacity currently available to workers or the downstream. The queue absorbs a finite burst, while age and in-flight memory expose the cost.`;
  }
  return `The producer is within the modeled capacity budget. Compare ${metrics.arrivalRate} offered jobs/tick with ${metrics.serviceCapacity} jobs/tick of worker and downstream capacity, then inject a burst or outage.`;
}

function summaryFor(metrics: BackpressureMetrics): string {
  return `At tick ${metrics.tick}, ${metrics.queueDepth} jobs wait in the broker, ${metrics.inFlightMemory} are in worker memory, throughput is ${metrics.throughput} jobs/tick, and ${metrics.rejectedOrDropped} jobs have been rejected or dropped. Queue age and dependency saturation are explicit backpressure signals.`;
}

function priorityLabel(policy: BackpressurePriorityPolicy): string {
  if (policy === "critical-first") return "Critical first";
  if (policy === "reserved-critical") return "Reserved critical";
  return "FIFO (all compete)";
}

function admissionLabel(policy: BackpressureAdmissionPolicy): string {
  if (policy === "throttle") return "Throttle producer";
  if (policy === "shed-low-priority") return "Shed low priority";
  return "Bounded buffer then reject";
}

function isBackpressurePresetId(value: string): value is BackpressurePresetId {
  return BACKPRESSURE_PRESETS.some((preset) => preset.id === value);
}
