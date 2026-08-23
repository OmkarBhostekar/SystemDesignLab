"use client";

import { useCallback, useMemo, useState } from "react";

import {
  MAX_AVERAGE_SERVICE_MS,
  MAX_FAN_OUT_COUNT,
  MAX_SAMPLE_WINDOW,
  MAX_SLOW_REQUEST_LATENCY_MS,
  MAX_SLOW_REQUEST_PROBABILITY,
  MAX_QUEUE_UTILIZATION,
  MAX_TIMEOUT_MS,
  MIN_AVERAGE_SERVICE_MS,
  MIN_FAN_OUT_COUNT,
  MIN_SAMPLE_WINDOW,
  MIN_SLOW_REQUEST_LATENCY_MS,
  MIN_TIMEOUT_MS,
  TAIL_LATENCY_PRESETS,
  createTailLatencyState,
  tailLatencyMetrics,
  toTailLatencySimulationMetrics,
  transitionTailLatency,
  type TailLatencyAction,
  type TailLatencyMetrics,
  type TailLatencyPresetId,
  type TailLatencyState,
} from "@/simulations/tail-latency";
import type { SimulationEvent } from "@/simulations";

import { SimulationShell } from "./SimulationShell";
import type {
  SimulationCompletionFactory,
  SimulationRepository,
} from "./simulation-types";

export interface TailLatencySimulationProps {
  lessonId?: string;
  repository?: SimulationRepository;
  completionFactory?: SimulationCompletionFactory;
}

export function TailLatencySimulation({
  lessonId,
  repository,
  completionFactory,
}: TailLatencySimulationProps) {
  const [presetId, setPresetId] = useState<TailLatencyPresetId>("average-hides-tail");
  const [state, setState] = useState<TailLatencyState>(() => createTailLatencyState("average-hides-tail"));
  const [error, setError] = useState<string | null>(null);
  const metrics = useMemo(() => tailLatencyMetrics(state), [state]);

  const apply = useCallback((action: TailLatencyAction) => {
    try {
      const transition = transitionTailLatency(state, action);
      setState(transition.state);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The tail-latency action could not be applied.");
    }
  }, [state]);

  const step = useCallback(() => apply({ type: "step" }), [apply]);
  const reset = useCallback(() => {
    setState(createTailLatencyState(presetId));
    setError(null);
  }, [presetId]);
  const selectPreset = useCallback((nextPresetId: string) => {
    if (!isTailLatencyPresetId(nextPresetId)) return;
    setPresetId(nextPresetId);
    setState(createTailLatencyState(nextPresetId));
    setError(null);
  }, []);

  const simulationMetrics = toTailLatencySimulationMetrics(metrics);
  const simulationEvents = state.events as readonly SimulationEvent[];

  return (
    <SimulationShell<TailLatencyState, TailLatencyAction>
      simulationId="tail-latency"
      lessonId={lessonId}
      title="Can the average hide a slow user?"
      description="Shape a bounded latency distribution, fan it out across dependencies, and compare tail mitigations by both latency and cost."
      state={state}
      dispatch={apply}
      onStep={step}
      onReset={reset}
      onPresetChange={selectPreset}
      metrics={simulationMetrics}
      events={simulationEvents}
      explanation={explanationFor(state, metrics)}
      summary={summaryFor(metrics)}
      presets={TAIL_LATENCY_PRESETS}
      presetId={presetId}
      isComplete={state.completion.completed}
      externalError={error}
      repository={repository}
      completionFactory={completionFactory}
      initialStatus={error ?? "Use Step to sample the bounded request window, or Play to advance it."}
      controls={({ dispatch, announce }) => (
        <fieldset className="simulation-controls simulation-controls--tail-latency">
          <legend>Latency, fan-out, and mitigation controls</legend>
          <label className="simulation-control simulation-control--range" htmlFor="tail-latency-service-time">
            <span>Fast-path service time</span>
            <output htmlFor="tail-latency-service-time">{formatMs(state.config.averageServiceMs)}</output>
            <input
              id="tail-latency-service-time"
              type="range"
              min={MIN_AVERAGE_SERVICE_MS}
              max={MAX_AVERAGE_SERVICE_MS}
              step="0.1"
              value={state.config.averageServiceMs}
              aria-valuetext={`${formatMs(state.config.averageServiceMs)} fast-path service time`}
              onChange={(event) => {
                const milliseconds = Number(event.target.value);
                dispatch({ type: "set-average-service-time", milliseconds });
                announce(`Fast-path service time is ${formatMs(milliseconds)}.`);
              }}
            />
          </label>
          <label className="simulation-control simulation-control--range" htmlFor="tail-latency-slow-probability">
            <span>Slow-request probability</span>
            <output htmlFor="tail-latency-slow-probability">{formatPercent(state.config.slowRequestProbability)}</output>
            <input
              id="tail-latency-slow-probability"
              type="range"
              min={0}
              max={MAX_SLOW_REQUEST_PROBABILITY * 100}
              step={1}
              value={state.config.slowRequestProbability * 100}
              aria-valuetext={`${formatPercent(state.config.slowRequestProbability)} per dependency`}
              onChange={(event) => {
                const probability = Number(event.target.value) / 100;
                dispatch({ type: "set-slow-probability", probability });
                announce(`Slow-request probability is ${formatPercent(probability)}.`);
              }}
            />
          </label>
          <label className="simulation-control simulation-control--range" htmlFor="tail-latency-slow-time">
            <span>Slow-path latency</span>
            <output htmlFor="tail-latency-slow-time">{formatMs(state.config.slowRequestLatencyMs)}</output>
            <input
              id="tail-latency-slow-time"
              type="range"
              min={MIN_SLOW_REQUEST_LATENCY_MS}
              max={MAX_SLOW_REQUEST_LATENCY_MS}
              step={25}
              value={state.config.slowRequestLatencyMs}
              aria-valuetext={`${formatMs(state.config.slowRequestLatencyMs)} slow path`}
              onChange={(event) => {
                const milliseconds = Number(event.target.value);
                dispatch({ type: "set-slow-latency", milliseconds });
                announce(`Slow-path latency is ${formatMs(milliseconds)}.`);
              }}
            />
          </label>
          <label className="simulation-control simulation-control--range" htmlFor="tail-latency-fan-out">
            <span>Parallel fan-out</span>
            <output htmlFor="tail-latency-fan-out">{state.config.fanOutCount} calls</output>
            <input
              id="tail-latency-fan-out"
              type="range"
              min={MIN_FAN_OUT_COUNT}
              max={MAX_FAN_OUT_COUNT}
              step={1}
              value={state.config.fanOutCount}
              aria-valuetext={`${state.config.fanOutCount} parallel dependency calls`}
              onChange={(event) => {
                const count = Number(event.target.value);
                dispatch({ type: "set-fan-out", count });
                announce(`Fan-out is ${count} parallel calls.`);
              }}
            />
          </label>
          <label className="simulation-control simulation-control--range" htmlFor="tail-latency-queue">
            <span>Queue utilization</span>
            <output htmlFor="tail-latency-queue">{formatPercent(state.config.queueUtilization)}</output>
            <input
              id="tail-latency-queue"
              type="range"
              min={0}
              max={MAX_QUEUE_UTILIZATION * 100}
              step={1}
              value={state.config.queueUtilization * 100}
              aria-valuetext={`${formatPercent(state.config.queueUtilization)} queue utilization`}
              onChange={(event) => {
                const utilization = Number(event.target.value) / 100;
                dispatch({ type: "set-queue-utilization", utilization });
                announce(`Queue utilization is ${formatPercent(utilization)}.`);
              }}
            />
          </label>
          <label className="simulation-control simulation-control--range" htmlFor="tail-latency-window">
            <span>Sample window</span>
            <output htmlFor="tail-latency-window">{state.config.sampleWindow.toLocaleString("en-US")} requests</output>
            <input
              id="tail-latency-window"
              type="range"
              min={MIN_SAMPLE_WINDOW}
              max={MAX_SAMPLE_WINDOW}
              step={100}
              value={state.config.sampleWindow}
              aria-valuetext={`${state.config.sampleWindow.toLocaleString("en-US")} request percentile window`}
              onChange={(event) => {
                const requests = Number(event.target.value);
                dispatch({ type: "set-sample-window", requests });
                announce(`Sample window is ${requests.toLocaleString("en-US")} requests.`);
              }}
            />
          </label>
          <div className="simulation-control__selects">
            <label className="simulation-control simulation-control--checkbox">
              <input
                type="checkbox"
                checked={state.mitigations.hedgingEnabled}
                onChange={() => {
                  dispatch({ type: "toggle-hedging" });
                  announce(state.mitigations.hedgingEnabled ? "Hedging disabled." : "Hedging enabled; duplicate read load is visible in the metrics.");
                }}
              />
              <span>Hedge slow reads</span>
            </label>
            <label className="simulation-control simulation-control--checkbox">
              <input
                type="checkbox"
                checked={state.mitigations.timeoutEnabled}
                onChange={() => {
                  dispatch({ type: "toggle-timeout" });
                  announce(state.mitigations.timeoutEnabled ? "Timeout protection disabled." : "Timeout protection enabled.");
                }}
              />
              <span>Enforce timeout</span>
            </label>
            <label className="simulation-control simulation-control--checkbox">
              <input
                type="checkbox"
                checked={state.mitigations.gracefulDegradationEnabled}
                onChange={() => {
                  dispatch({ type: "toggle-graceful-degradation" });
                  announce(state.mitigations.gracefulDegradationEnabled ? "Graceful degradation disabled." : "Graceful degradation enabled; partial results are labeled.");
                }}
              />
              <span>Graceful degradation</span>
            </label>
            <label className="simulation-control simulation-control--checkbox">
              <input
                type="checkbox"
                checked={state.mitigations.correlatedSlowdownEnabled}
                onChange={() => {
                  dispatch({ type: "toggle-correlated-slowdown" });
                  announce(state.mitigations.correlatedSlowdownEnabled ? "Correlated slowdown disabled." : "Correlated slowdown enabled; independent fan-out math no longer applies.");
                }}
              />
              <span>Correlated slowdown</span>
            </label>
          </div>
          <label className="simulation-control simulation-control--range" htmlFor="tail-latency-timeout">
            <span>Deadline</span>
            <output htmlFor="tail-latency-timeout">{formatMs(state.mitigations.timeoutMs)}</output>
            <input
              id="tail-latency-timeout"
              type="range"
              min={MIN_TIMEOUT_MS}
              max={MAX_TIMEOUT_MS}
              step={25}
              value={state.mitigations.timeoutMs}
              aria-valuetext={`${formatMs(state.mitigations.timeoutMs)} deadline`}
              onChange={(event) => {
                const milliseconds = Number(event.target.value);
                dispatch({ type: "set-timeout", milliseconds });
                announce(`Deadline is ${formatMs(milliseconds)}.`);
              }}
            />
          </label>
          <div className="simulation-control__buttons" role="group" aria-label="Failure controls">
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                dispatch({ type: state.slowdownActive ? "recover-slowdown" : "inject-slowdown" });
                announce(state.slowdownActive ? "Dependency slowdown cleared." : "Dependency slowdown injected; inspect p99 and the fan-out risk.");
              }}
            >
              {state.slowdownActive ? "Recover slowdown" : "Inject slowdown"}
            </button>
          </div>
        </fieldset>
      )}
    >
      <TailLatencyGraphic state={state} metrics={metrics} />
      <TailLatencyTable state={state} metrics={metrics} />
    </SimulationShell>
  );
}

function TailLatencyGraphic({ state, metrics }: { state: TailLatencyState; metrics: TailLatencyMetrics }) {
  const distributionTitleId = "tail-latency-distribution-title";
  const historyTitleId = "tail-latency-history-title";
  const chartLeft = 58;
  const chartRight = 736;
  const chartTop = 30;
  const chartBottom = 214;
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;
  const chartMax = Math.max(100, Math.ceil(metrics.maxMs / 100) * 100);
  const binCount = 12;
  const binSize = chartMax / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => {
    const start = index * binSize;
    const end = index === binCount - 1 ? chartMax : start + binSize;
    const count = state.latencySamples.filter((sample) => sample >= start && sample <= end && (index === binCount - 1 || sample < end)).length;
    return { id: `latency-bin-${index}`, start, end, count };
  });
  const maximumBinCount = Math.max(1, ...bins.map((bin) => bin.count));
  const markerValues = [
    { id: "average", label: "avg", value: metrics.averageMs },
    { id: "p50", label: "p50", value: metrics.p50Ms },
    { id: "p95", label: "p95", value: metrics.p95Ms },
    { id: "p99", label: "p99", value: metrics.p99Ms },
    { id: "max", label: "max", value: metrics.maxMs },
  ];
  const history = state.history;
  const historyMax = Math.max(100, ...history.map((point) => point.maxMs));
  const historyLeft = 58;
  const historyRight = 736;
  const historyTop = 25;
  const historyBottom = 142;
  const historyX = (index: number) => history.length <= 1
    ? (historyLeft + historyRight) / 2
    : historyLeft + (index / (history.length - 1)) * (historyRight - historyLeft);
  const historyY = (value: number) => historyBottom - (value / historyMax) * (historyBottom - historyTop);
  const pathFor = (key: "averageMs" | "p95Ms" | "p99Ms" | "maxMs") => history.map((point, index) => `${index === 0 ? "M" : "L"} ${historyX(index).toFixed(1)} ${historyY(point[key]).toFixed(1)}`).join(" ");

  return (
    <>
      <figure className="simulation-graphic simulation-graphic--tail-latency">
        <svg viewBox="0 0 760 300" role="img" aria-labelledby={distributionTitleId}>
          <title id={distributionTitleId}>Latency distribution with percentile markers</title>
          <desc>
            A bounded histogram shows {metrics.sampleCount} rendered observations from a {metrics.sampleWindow.toLocaleString("en-US")} request window. Average is {formatMs(metrics.averageMs)}, p50 is {formatMs(metrics.p50Ms)}, p95 is {formatMs(metrics.p95Ms)}, p99 is {formatMs(metrics.p99Ms)}, and maximum is {formatMs(metrics.maxMs)}. The table below repeats exact values.
          </desc>
          <line className="simulation-svg__edge" x1={chartLeft} y1={chartBottom} x2={chartRight} y2={chartBottom} />
          <line className="simulation-svg__edge" x1={chartLeft} y1={chartTop} x2={chartLeft} y2={chartBottom} />
          {bins.map((bin, index) => {
            const x = chartLeft + (index / binCount) * chartWidth + 1;
            const barWidth = chartWidth / binCount - 2;
            const barHeight = (bin.count / maximumBinCount) * chartHeight;
            return (
              <g key={bin.id}>
                <rect
                  x={x}
                  y={chartBottom - barHeight}
                  width={barWidth}
                  height={Math.max(1, barHeight)}
                  fill="var(--accent)"
                  opacity={0.7}
                  aria-label={`${formatMs(bin.start)} to ${formatMs(bin.end)}: ${bin.count} observations`}
                />
                {index % 2 === 0 ? <text className="simulation-svg__meta" x={x} y={chartBottom + 18} textAnchor="middle">{formatCompactMs(bin.start)}</text> : null}
              </g>
            );
          })}
          {markerValues.map((marker, index) => {
            const x = chartLeft + Math.min(1, marker.value / chartMax) * chartWidth;
            const labelY = chartTop + 14 + (index % 2) * 16;
            return (
              <g key={marker.id}>
                <line x1={x} y1={chartTop} x2={x} y2={chartBottom} stroke="var(--warning)" strokeDasharray="4 3" strokeWidth="1.5" />
                <text className="simulation-svg__label" x={Math.min(chartRight - 4, Math.max(chartLeft + 4, x))} y={labelY} textAnchor={x > chartRight - 35 ? "end" : x < chartLeft + 35 ? "start" : "middle"}>{marker.label} {formatCompactMs(marker.value)}</text>
              </g>
            );
          })}
          <text className="simulation-svg__caption" x={chartLeft} y="286">Latency (ms) →</text>
          <text className="simulation-svg__caption" x={chartLeft} y="18">observations ↑</text>
        </svg>
        <figcaption>Markers use nearest-rank percentiles. A p99 is a windowed estimate, not the maximum.</figcaption>
      </figure>
      <figure className="simulation-graphic simulation-graphic--tail-latency-history">
        <svg viewBox="0 0 760 180" role="img" aria-labelledby={historyTitleId}>
          <title id={historyTitleId}>Bounded latency history</title>
          <desc>Recent stepped windows plot average, p95, p99, and maximum latency. Only the last {history.length} of {40} history points are retained.</desc>
          <line className="simulation-svg__edge" x1={historyLeft} y1={historyBottom} x2={historyRight} y2={historyBottom} />
          <line className="simulation-svg__edge" x1={historyLeft} y1={historyTop} x2={historyLeft} y2={historyBottom} />
          <path d={pathFor("averageMs")} fill="none" stroke="var(--accent)" strokeWidth="2" />
          <path d={pathFor("p95Ms")} fill="none" stroke="var(--success)" strokeWidth="2" strokeDasharray="5 3" />
          <path d={pathFor("p99Ms")} fill="none" stroke="var(--warning)" strokeWidth="2" />
          <path d={pathFor("maxMs")} fill="none" stroke="var(--danger)" strokeWidth="2" strokeDasharray="2 3" />
          <text className="simulation-svg__label" x={historyLeft} y="18">Recent windows (step) · max axis {formatCompactMs(historyMax)}</text>
          <text className="simulation-svg__caption" x={historyLeft} y="170">average · p95 · p99 · maximum</text>
        </svg>
        <figcaption>History is capped at 40 points so Play cannot grow memory without bound.</figcaption>
      </figure>
    </>
  );
}

function TailLatencyTable({ state, metrics }: { state: TailLatencyState; metrics: TailLatencyMetrics }) {
  return (
    <div className="simulation-table-wrap">
      <table className="simulation-table">
        <caption>Exact latency and fan-out summary</caption>
        <thead>
          <tr><th scope="col">Signal</th><th scope="col">Value</th><th scope="col">Why it matters</th></tr>
        </thead>
        <tbody>
          <tr><th scope="row">Average</th><td>{formatMs(metrics.averageMs)}</td><td>Mean across the effective bounded sample</td></tr>
          <tr><th scope="row">p50 / p95 / p99</th><td>{formatMs(metrics.p50Ms)} / {formatMs(metrics.p95Ms)} / {formatMs(metrics.p99Ms)}</td><td>Windowed nearest-rank percentiles</td></tr>
          <tr><th scope="row">Maximum</th><td>{formatMs(metrics.maxMs)}</td><td>Observed slowest effective request</td></tr>
          <tr><th scope="row">Fan-out risk</th><td>{formatPercent(metrics.fanOutSlowProbability)}</td><td>{metrics.fanOutCount} parallel calls; independent estimate {formatPercent(metrics.independentFanOutRisk)}</td></tr>
          <tr><th scope="row">Queue wait</th><td>{formatMs(metrics.queueWaitMs)}</td><td>{formatPercent(metrics.queueUtilization)} utilization adds nonlinear waiting</td></tr>
          <tr><th scope="row">Mitigation trade-off</th><td>{mitigationValue(metrics)}</td><td>{mitigationDetail(metrics)}</td></tr>
        </tbody>
        <tfoot>
          <tr><th scope="row">Sample bound</th><td>{metrics.sampleCount} rendered / {state.config.sampleWindow.toLocaleString("en-US")} logical</td><td>Sample and history remain bounded during playback</td></tr>
        </tfoot>
      </table>
    </div>
  );
}

function explanationFor(state: TailLatencyState, metrics: TailLatencyMetrics): string {
  if (state.slowdownActive) {
    return state.mitigations.correlatedSlowdownEnabled
      ? "A common-cause slowdown moves many dependencies together, so the independent 1 − (1 − p)^N fan-out estimate no longer describes the observed tail."
      : "The injected slowdown increases the slow cohort. The average moves modestly compared with the p99 because only the slow edge changed. Recover it, then compare the distribution."
  }
  if (metrics.fanOutCount > 1 && metrics.fanOutSlowProbability > metrics.slowRequestProbability) {
    return `One slow dependency is enough to delay the request. With ${metrics.fanOutCount} parallel calls, the independent model raises the chance from ${formatPercent(metrics.slowRequestProbability)} to ${formatPercent(metrics.independentFanOutRisk)}.`;
  }
  if (state.mitigations.hedgingEnabled) {
    return "Hedging can lower a read tail by racing a duplicate, but the extra hedge requests consume capacity and can worsen the original queue if used indiscriminately."
  }
  if (state.mitigations.timeoutEnabled || state.mitigations.gracefulDegradationEnabled) {
    return "A deadline makes the tail bounded. Timeout protection trades slow work for failures; graceful degradation trades completeness for a faster, explicitly partial response."
  }
  if (metrics.queueUtilization >= 0.6) {
    return "Queueing grows nonlinearly near saturation. A stable service time can still produce a large p95/p99 when utilization leaves little headroom."
  }
  return "The average describes the center of the distribution, while p95 and p99 expose the slow edge that users and downstream fan-out experience."
}

function summaryFor(metrics: TailLatencyMetrics): string {
  return `Average ${formatMs(metrics.averageMs)}; p50 ${formatMs(metrics.p50Ms)}, p95 ${formatMs(metrics.p95Ms)}, p99 ${formatMs(metrics.p99Ms)}, maximum ${formatMs(metrics.maxMs)}. ${metrics.fanOutCount} parallel dependencies give a ${formatPercent(metrics.fanOutSlowProbability)} chance that at least one is slow.`;
}

function mitigationValue(metrics: TailLatencyMetrics): string {
  if (metrics.timeoutRate > 0 && metrics.partialResponseRate > 0) return `${formatPercent(metrics.timeoutRate)} timeout + partial`;
  if (metrics.timeoutRate > 0) return `${formatPercent(metrics.timeoutRate)} timeout`;
  if (metrics.partialResponseRate > 0) return `${formatPercent(metrics.partialResponseRate)} partial`;
  if (metrics.hedgeLoadMultiplier > 1) return `+${Math.round((metrics.hedgeLoadMultiplier - 1) * 100)}% load`;
  return "none";
}

function mitigationDetail(metrics: TailLatencyMetrics): string {
  if (metrics.timeoutRate > 0 && metrics.partialResponseRate > 0) {
    return "Deadlines cap the tail; graceful degradation labels omitted optional results.";
  }
  if (metrics.timeoutRate > 0) return "Timeouts cap latency but turn the slow cohort into failed work.";
  if (metrics.partialResponseRate > 0) return "Partial responses protect responsiveness while reducing completeness.";
  if (metrics.hedgeLoadMultiplier > 1) return "Hedging reduces the modeled tail at the cost of duplicate read load.";
  return "No tail mitigation is active; inspect the distribution before changing capacity.";
}

function isTailLatencyPresetId(value: string): value is TailLatencyPresetId {
  return TAIL_LATENCY_PRESETS.some((preset) => preset.id === value);
}

function formatMs(value: number): string {
  return `${Math.round(value * 10) / 10} ms`;
}

function formatCompactMs(value: number): string {
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}s`;
  return `${Math.round(value)}ms`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(value * 100 >= 10 ? 0 : 1)}%`;
}
