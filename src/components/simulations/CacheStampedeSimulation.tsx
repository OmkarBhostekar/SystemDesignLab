"use client";

import { useCallback, useMemo, useState } from "react";

import {
  CACHE_STAMPEDE_MITIGATIONS,
  CACHE_STAMPEDE_PRESETS,
  MAX_CACHE_STAMPEDE_ARRIVAL_RATE,
  MAX_CACHE_STAMPEDE_BURST_READERS,
  MAX_CACHE_STAMPEDE_LOADER_LATENCY_MS,
  MAX_CACHE_STAMPEDE_LOCK_LEASE_MS,
  MAX_CACHE_STAMPEDE_PROCESS_COUNT,
  MAX_CACHE_STAMPEDE_STALE_GRACE_MS,
  MAX_CACHE_STAMPEDE_TTL_MS,
  MAX_CACHE_STAMPEDE_TTL_JITTER_MS,
  MAX_CACHE_STAMPEDE_WAITER_TIMEOUT_MS,
  MIN_CACHE_STAMPEDE_ARRIVAL_RATE,
  MIN_CACHE_STAMPEDE_BURST_READERS,
  MIN_CACHE_STAMPEDE_LOADER_LATENCY_MS,
  MIN_CACHE_STAMPEDE_LOCK_LEASE_MS,
  MIN_CACHE_STAMPEDE_PROCESS_COUNT,
  MIN_CACHE_STAMPEDE_TTL_MS,
  MIN_CACHE_STAMPEDE_WAITER_TIMEOUT_MS,
  cacheStampedeMetrics,
  cacheStampedeMitigationLabel,
  createCacheStampedeState,
  transitionCacheStampede,
  type CacheStampedeAction,
  type CacheStampedeMetrics,
  type CacheStampedeMitigation,
  type CacheStampedePresetId,
  type CacheStampedeState,
} from "@/simulations/cache-stampede";
import type { SimulationEvent, SimulationMetric } from "@/simulations/types";

import { SimulationShell } from "./SimulationShell";
import type {
  SimulationCompletionFactory,
  SimulationRepository,
} from "./simulation-types";

export interface CacheStampedeSimulationProps {
  lessonId?: string;
  repository?: SimulationRepository;
  completionFactory?: SimulationCompletionFactory;
}

export function CacheStampedeSimulation({
  lessonId,
  repository,
  completionFactory,
}: CacheStampedeSimulationProps) {
  const [presetId, setPresetId] = useState<CacheStampedePresetId>("synchronized-expiry");
  const [state, setState] = useState<CacheStampedeState>(() => createCacheStampedeState("synchronized-expiry"));
  const [error, setError] = useState<string | null>(null);
  const metrics = useMemo(() => cacheStampedeMetrics(state), [state]);

  const apply = useCallback((action: CacheStampedeAction) => {
    try {
      const transition = transitionCacheStampede(state, action);
      setState(transition.state);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The stampede action could not be applied.");
    }
  }, [state]);

  const step = useCallback(() => apply({ type: "step" }), [apply]);
  const reset = useCallback(() => {
    setState(createCacheStampedeState(presetId));
    setError(null);
  }, [presetId]);
  const selectPreset = useCallback((nextPresetId: string) => {
    if (!isCacheStampedePresetId(nextPresetId)) return;
    setPresetId(nextPresetId);
    setState(createCacheStampedeState(nextPresetId));
    setError(null);
  }, []);

  return (
    <SimulationShell<CacheStampedeState, CacheStampedeAction>
      simulationId="cache-stampede"
      lessonId={lessonId}
      title="Stampede Control Room"
      description="Synchronize a hot-key expiry, watch readers amplify source work, and compare coordination with bounded stale data."
      state={state}
      dispatch={apply}
      onStep={step}
      onReset={reset}
      onPresetChange={selectPreset}
      metrics={toSimulationMetrics(metrics)}
      events={state.events as readonly SimulationEvent[]}
      explanation={explanationFor(state, metrics)}
      summary={summaryFor(state, metrics)}
      presets={CACHE_STAMPEDE_PRESETS}
      presetId={presetId}
      isComplete={state.completion.completed}
      externalError={error}
      repository={repository}
      completionFactory={completionFactory}
      initialStatus={error ?? "Use Step to release a deterministic reader burst, or Play to watch the cache lifecycle."}
      controls={({ dispatch, announce }) => (
        <fieldset className="simulation-controls simulation-controls--cache-stampede">
          <legend>Reader, TTL, source, and mitigation controls</legend>
          <div className="simulation-control__selects">
            <label className="simulation-control">
              <span>Mitigation</span>
              <select
                value={state.mitigation}
                onChange={(event) => {
                  const mitigation = event.target.value as CacheStampedeMitigation;
                  dispatch({ type: "set-mitigation", mitigation });
                  announce(`${cacheStampedeMitigationLabel(mitigation)} selected.`);
                }}
              >
                {CACHE_STAMPEDE_MITIGATIONS.map((mitigation) => (
                  <option key={mitigation} value={mitigation}>{cacheStampedeMitigationLabel(mitigation)}</option>
                ))}
              </select>
            </label>
            <label className="simulation-control">
              <span>Processes</span>
              <select
                value={state.config.processCount}
                onChange={(event) => {
                  const count = Number(event.target.value);
                  dispatch({ type: "set-process-count", count });
                  announce(`${count} processes receive readers for key K.`);
                }}
              >
                {Array.from({ length: MAX_CACHE_STAMPEDE_PROCESS_COUNT - MIN_CACHE_STAMPEDE_PROCESS_COUNT + 1 }, (_, index) => index + MIN_CACHE_STAMPEDE_PROCESS_COUNT).map((count) => (
                  <option key={count} value={count}>{count}</option>
                ))}
              </select>
            </label>
          </div>

          <RangeControl
            id="cache-stampede-arrival-rate"
            label="Reader arrival rate"
            value={state.config.arrivalRatePerSecond}
            min={MIN_CACHE_STAMPEDE_ARRIVAL_RATE}
            max={MAX_CACHE_STAMPEDE_ARRIVAL_RATE}
            step={100}
            output={`${formatNumber(state.config.arrivalRatePerSecond)} readers/s`}
            valueText={`${formatNumber(state.config.arrivalRatePerSecond)} reader arrivals per second`}
            onChange={(rate) => {
              dispatch({ type: "set-arrival-rate", rate });
              announce(`Reader arrival rate is ${formatNumber(rate)} per second.`);
            }}
          />
          <RangeControl
            id="cache-stampede-burst-readers"
            label="Synchronized reader burst"
            value={state.config.burstReaders}
            min={MIN_CACHE_STAMPEDE_BURST_READERS}
            max={MAX_CACHE_STAMPEDE_BURST_READERS}
            step={20}
            output={`${formatNumber(state.config.burstReaders)} readers`}
            valueText={`${formatNumber(state.config.burstReaders)} synchronized readers at cold start and expiry`}
            onChange={(readers) => {
              dispatch({ type: "set-burst-readers", readers });
              announce(`Synchronized burst is ${formatNumber(readers)} readers.`);
            }}
          />
          <RangeControl
            id="cache-stampede-loader-latency"
            label="Loader latency"
            value={state.config.loaderLatencyMs}
            min={MIN_CACHE_STAMPEDE_LOADER_LATENCY_MS}
            max={MAX_CACHE_STAMPEDE_LOADER_LATENCY_MS}
            step={25}
            output={formatMs(state.config.loaderLatencyMs)}
            valueText={`${formatMs(state.config.loaderLatencyMs)} source loader latency`}
            onChange={(milliseconds) => {
              dispatch({ type: "set-loader-latency", milliseconds });
              announce(`Loader latency is ${formatMs(milliseconds)}.`);
            }}
          />
          <RangeControl
            id="cache-stampede-ttl"
            label="Fresh TTL"
            value={state.config.ttlMs}
            min={MIN_CACHE_STAMPEDE_TTL_MS}
            max={MAX_CACHE_STAMPEDE_TTL_MS}
            step={100}
            output={formatMs(state.config.ttlMs)}
            valueText={`${formatMs(state.config.ttlMs)} fresh TTL`}
            onChange={(milliseconds) => {
              dispatch({ type: "set-ttl", milliseconds });
              announce(`Fresh TTL is ${formatMs(milliseconds)}.`);
            }}
          />
          <RangeControl
            id="cache-stampede-jitter"
            label="TTL jitter"
            value={state.config.ttlJitterMs}
            min={0}
            max={MAX_CACHE_STAMPEDE_TTL_JITTER_MS}
            step={100}
            output={`±${formatMs(state.config.ttlJitterMs)}`}
            valueText={`expiry jitter plus or minus ${formatMs(state.config.ttlJitterMs)}`}
            onChange={(milliseconds) => {
              dispatch({ type: "set-ttl-jitter", milliseconds });
              announce(`TTL jitter is plus or minus ${formatMs(milliseconds)}.`);
            }}
          />
          <div className="simulation-control__selects">
            <RangeControl
              id="cache-stampede-lock-lease"
              label="Lock lease"
              value={state.config.lockLeaseMs}
              min={MIN_CACHE_STAMPEDE_LOCK_LEASE_MS}
              max={MAX_CACHE_STAMPEDE_LOCK_LEASE_MS}
              step={25}
              output={formatMs(state.config.lockLeaseMs)}
              valueText={`${formatMs(state.config.lockLeaseMs)} distributed lock lease`}
              onChange={(milliseconds) => {
                dispatch({ type: "set-lock-lease", milliseconds });
                announce(`Lock lease is ${formatMs(milliseconds)}.`);
              }}
            />
            <RangeControl
              id="cache-stampede-waiter-timeout"
              label="Waiter timeout"
              value={state.config.waiterTimeoutMs}
              min={MIN_CACHE_STAMPEDE_WAITER_TIMEOUT_MS}
              max={MAX_CACHE_STAMPEDE_WAITER_TIMEOUT_MS}
              step={25}
              output={formatMs(state.config.waiterTimeoutMs)}
              valueText={`${formatMs(state.config.waiterTimeoutMs)} waiter timeout`}
              onChange={(milliseconds) => {
                dispatch({ type: "set-waiter-timeout", milliseconds });
                announce(`Waiter timeout is ${formatMs(milliseconds)}.`);
              }}
            />
            <RangeControl
              id="cache-stampede-stale-grace"
              label="Stale grace"
              value={state.config.staleGraceMs}
              min={0}
              max={MAX_CACHE_STAMPEDE_STALE_GRACE_MS}
              step={100}
              output={formatMs(state.config.staleGraceMs)}
              valueText={`${formatMs(state.config.staleGraceMs)} stale grace window`}
              onChange={(milliseconds) => {
                dispatch({ type: "set-stale-grace", milliseconds });
                announce(`Stale grace is ${formatMs(milliseconds)}.`);
              }}
            />
          </div>

          <div className="simulation-control__buttons" role="group" aria-label="Failure controls">
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                dispatch({ type: state.sourceFailure ? "recover-source-failure" : "inject-source-failure" });
                announce(state.sourceFailure ? "Source recovered." : "Source failure injected; inspect failed loads and stale fallback.");
              }}
            >
              {state.sourceFailure ? "Recover source" : "Inject source failure"}
            </button>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                dispatch({ type: state.ownerFailure ? "recover-owner-failure" : "inject-owner-failure" });
                announce(state.ownerFailure ? "Owner failure cleared." : "Lock owner failure injected; wait for lease expiry.");
              }}
            >
              {state.ownerFailure ? "Recover owner" : "Inject owner failure"}
            </button>
          </div>
        </fieldset>
      )}
    >
      <CacheStampedeGraphic state={state} metrics={metrics} />
      <CacheStampedeTable state={state} metrics={metrics} />
    </SimulationShell>
  );
}

function RangeControl({
  id,
  label,
  value,
  min,
  max,
  step,
  output,
  valueText,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
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
        step={step}
        value={value}
        aria-valuetext={valueText}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function CacheStampedeGraphic({ state, metrics }: { state: CacheStampedeState; metrics: CacheStampedeMetrics }) {
  const titleId = "cache-stampede-graphic-title";
  const descriptionId = "cache-stampede-graphic-description";
  const readerCount = Math.min(10, Math.max(1, state.lastStep.readers));
  const sourceCount = Math.min(10, Math.max(0, metrics.currentSourceConcurrency));
  const cacheFill = metrics.cacheStatus === "fresh" ? "var(--success)" : metrics.cacheStatus === "stale" ? "var(--warning)" : "var(--danger)";
  const timelineLeft = 74;
  const timelineRight = 686;
  const timelineWidth = timelineRight - timelineLeft;
  const windowMs = Math.max(state.config.ttlMs + state.config.staleGraceMs, state.config.loaderLatencyMs, 1);
  const freshWidth = Math.min(timelineWidth, (state.config.ttlMs / windowMs) * timelineWidth);
  const staleWidth = Math.max(0, Math.min(timelineWidth - freshWidth, (state.config.staleGraceMs / windowMs) * timelineWidth));
  const markerX = timelineLeft + Math.min(timelineWidth, (metrics.cacheAgeMs / windowMs) * timelineWidth);

  return (
    <figure className="simulation-graphic simulation-graphic--cache-stampede">
      <svg viewBox="0 0 760 390" role="img" aria-labelledby={titleId} aria-describedby={descriptionId}>
        <title id={titleId}>Cache stampede control room</title>
        <desc id={descriptionId}>
          A sampled reader burst reaches cache key K. The cache is {metrics.cacheStatus}, {metrics.currentSourceConcurrency} source calls are currently active, and {metrics.lockHeld ? `lock owner ${metrics.lockOwner}` : "no distributed lock is held"}. Exact values appear in the tables below.
        </desc>

        <text className="simulation-svg__caption" x="104" y="28" textAnchor="middle">READERS</text>
        <text className="simulation-svg__caption" x="380" y="28" textAnchor="middle">CACHE KEY K</text>
        <text className="simulation-svg__caption" x="650" y="28" textAnchor="middle">SOURCE</text>
        <line className="simulation-svg__edge" x1="156" y1="120" x2="296" y2="120" />
        <line className="simulation-svg__edge" x1="464" y1="120" x2="596" y2="120" />

        <g className="simulation-svg__node simulation-svg__node--active">
          <rect x="24" y="72" width="160" height="96" rx="10" />
          <text className="simulation-svg__label" x="104" y="103" textAnchor="middle">{formatNumber(state.lastStep.readers)} readers</text>
          <text className="simulation-svg__meta" x="104" y="125" textAnchor="middle">{readerCount} dots sampled</text>
          <text className="simulation-svg__meta" x="104" y="146" textAnchor="middle">{formatNumber(metrics.cacheMisses)} misses total</text>
        </g>
        {Array.from({ length: readerCount }, (_, index) => {
          const x = 44 + (index % 5) * 27;
          const y = 194 + Math.floor(index / 5) * 22;
          return <circle key={`reader-dot-${index}`} cx={x} cy={y} r="6" fill={metrics.cacheStatus === "fresh" ? "var(--success)" : "var(--warning)"} aria-label={`sampled reader ${index + 1}`} />;
        })}
        <text className="simulation-svg__meta" x="104" y="248" textAnchor="middle">sample only · workload is logical</text>

        <g className="simulation-svg__node simulation-svg__node--active">
          <rect x="296" y="72" width="168" height="96" rx="10" fill={cacheFill} fillOpacity="0.18" />
          <text className="simulation-svg__label" x="380" y="103" textAnchor="middle">cache K</text>
          <text className="simulation-svg__meta" x="380" y="125" textAnchor="middle">{metrics.cacheStatus} · v{state.cache.valueVersion}</text>
          <text className="simulation-svg__meta" x="380" y="146" textAnchor="middle">TTL left {formatMs(metrics.ttlRemainingMs)}</text>
        </g>

        <g className="simulation-svg__node simulation-svg__node--active">
          <rect x="596" y="72" width="140" height="96" rx="10" />
          <text className="simulation-svg__label" x="666" y="103" textAnchor="middle">source</text>
          <text className="simulation-svg__meta" x="666" y="125" textAnchor="middle">{formatNumber(metrics.currentSourceConcurrency)} active</text>
          <text className="simulation-svg__meta" x="666" y="146" textAnchor="middle">{formatNumber(metrics.failedLoads)} failed</text>
        </g>

        <text className="simulation-svg__caption" x="530" y="204" textAnchor="middle">ACTIVE SOURCE CALLS</text>
        {Array.from({ length: sourceCount }, (_, index) => {
          const x = 446 + (index % 5) * 46;
          const y = 224 + Math.floor(index / 5) * 22;
          return <rect key={`source-call-${index}`} x={x} y={y} width="32" height="10" rx="5" fill={metrics.sourceFailure ? "var(--danger)" : "var(--accent)"} aria-label={`sampled source call ${index + 1}`} />;
        })}
        <text className="simulation-svg__meta" x="530" y="286" textAnchor="middle">{sourceCount < metrics.currentSourceConcurrency ? `showing ${sourceCount} of ${formatNumber(metrics.currentSourceConcurrency)}` : `${sourceCount} active calls`}</text>

        <rect x="24" y="306" width="240" height="52" rx="8" fill="var(--surface-muted)" />
        <text className="simulation-svg__label" x="36" y="327">{metrics.lockHeld ? "LEASE OWNER" : "LEASE FREE"}</text>
        <text className="simulation-svg__meta" x="36" y="347">{metrics.lockHeld ? `${metrics.lockOwner} · ${formatMs(metrics.leaseRemainingMs)} left` : "No owner token protects K"}</text>

        <line className="simulation-svg__edge" x1={timelineLeft} y1="376" x2={timelineRight} y2="376" />
        <rect x={timelineLeft} y="366" width={freshWidth} height="10" fill="var(--success)" fillOpacity="0.75" />
        <rect x={timelineLeft + freshWidth} y="366" width={staleWidth} height="10" fill="var(--warning)" fillOpacity="0.75" />
        <line x1={markerX} y1="356" x2={markerX} y2="386" stroke="var(--accent)" strokeWidth="2" />
        <text className="simulation-svg__meta" x={timelineLeft} y="356">fresh</text>
        <text className="simulation-svg__meta" x={timelineLeft + freshWidth + 6} y="356">stale grace</text>
        <text className="simulation-svg__meta" x={timelineRight} y="356" textAnchor="end">expiry age {formatMs(metrics.cacheAgeMs)}</text>
      </svg>
      <figcaption>Reader and source shapes are sampled for readability; the exact logical counts, TTL state, lock owner, and stale age are repeated below.</figcaption>
    </figure>
  );
}

function CacheStampedeTable({ state, metrics }: { state: CacheStampedeState; metrics: CacheStampedeMetrics }) {
  return (
    <>
      <div className="simulation-table-wrap">
        <table className="simulation-table" aria-label="Exact cache stampede metrics">
          <caption>Exact cache stampede metrics</caption>
          <thead><tr><th scope="col">Signal</th><th scope="col">Value</th><th scope="col">Why it matters</th></tr></thead>
          <tbody>
            <tr><th scope="row">Peak source concurrency</th><td>{formatNumber(metrics.peakSourceConcurrency)} calls</td><td>Maximum simultaneous source work observed in the bounded run</td></tr>
            <tr><th scope="row">Source QPS</th><td>{formatNumber(metrics.sourceQps)} calls/s</td><td>Calls started in the latest {state.timeMs === 0 ? 0 : 100} ms step</td></tr>
            <tr><th scope="row">Average wait latency</th><td>{formatMs(metrics.averageWaitLatencyMs)}</td><td>Miss readers wait for their load; stale readers wait zero</td></tr>
            <tr><th scope="row">Stale age</th><td>{formatMs(metrics.staleAgeMs)}</td><td>Freshness budget spent by stale-while-revalidate</td></tr>
            <tr><th scope="row">Lock contention</th><td>{formatNumber(metrics.lockContention)} readers</td><td>Readers that joined a held distributed lease</td></tr>
            <tr><th scope="row">Failed loads</th><td>{formatNumber(metrics.failedLoads)} source calls</td><td>Source or crashed-owner failures; timeouts are listed separately</td></tr>
            <tr><th scope="row">Owner / lease trade-off</th><td>{metrics.ownerFailures} owner failures · {metrics.leaseExpirations} expirations</td><td>{metrics.lockHeld ? `Token ${metrics.lockOwner} holds ${formatMs(metrics.leaseRemainingMs)} remaining` : "A short lease can let a second owner start before a slow load finishes."}</td></tr>
          </tbody>
          <tfoot><tr><th scope="row">Bound</th><td>{state.history.length} / 40 history points</td><td>History and event timeline are capped during Play.</td></tr></tfoot>
        </table>
      </div>
      <div className="simulation-table-wrap">
        <table className="simulation-table" aria-label="Mitigation comparison">
          <caption>Mitigation comparison for the current reader burst</caption>
          <thead><tr><th scope="col">Mitigation</th><th scope="col">Peak source</th><th scope="col">Wait</th><th scope="col">Stale readers</th><th scope="col">Trade-off</th></tr></thead>
          <tbody>
            {metrics.comparisons.map((comparison) => (
              <tr key={comparison.mitigation}>
                <th scope="row">{comparison.label}{comparison.mitigation === metrics.mitigation ? " · active" : ""}</th>
                <td>{formatNumber(comparison.peakSourceConcurrency)} calls</td>
                <td>{formatMs(comparison.waitLatencyMs)}</td>
                <td>{formatNumber(comparison.staleReaders)}</td>
                <td>{comparison.tradeoff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function toSimulationMetrics(metrics: CacheStampedeMetrics): SimulationMetric[] {
  return [
    { id: "peak-source-concurrency", label: "Peak source concurrency", value: `${formatNumber(metrics.peakSourceConcurrency)} calls`, detail: `${formatNumber(metrics.sourceCalls)} total calls; amplification ${metrics.amplification.toFixed(2)}×`, tone: metrics.peakSourceConcurrency > 1 ? "warning" : "success" },
    { id: "source-qps", label: "Source QPS", value: `${formatNumber(metrics.sourceQps)} calls/s`, detail: `${formatNumber(metrics.readersThisStep)} readers in the latest logical step`, tone: metrics.sourceQps > 0 ? "warning" : "info" },
    { id: "wait-latency", label: "Average wait latency", value: formatMs(metrics.averageWaitLatencyMs), detail: `${formatNumber(metrics.timedOutReaders)} readers timed out`, tone: metrics.timedOutReaders > 0 ? "failure" : "info" },
    { id: "stale-age", label: "Stale age", value: formatMs(metrics.staleAgeMs), detail: `${formatNumber(metrics.staleServed)} stale responses`, tone: metrics.staleAgeMs > 0 ? "warning" : "info" },
    { id: "lock-contention", label: "Lock contention", value: `${formatNumber(metrics.lockContention)} readers`, detail: `${metrics.lockAcquisitions} acquisitions · ${metrics.leaseExpirations} lease expirations`, tone: metrics.lockContention > 0 ? "warning" : "info" },
    { id: "failed-loads", label: "Failed loads", value: `${formatNumber(metrics.failedLoads)} calls`, detail: `${formatNumber(metrics.failedReaders)} failed readers · owner failures ${metrics.ownerFailures}`, tone: metrics.failedLoads > 0 ? "failure" : "success" },
  ];
}

function explanationFor(state: CacheStampedeState, metrics: CacheStampedeMetrics): string {
  if (metrics.failedLoads > 0 || state.sourceFailure) {
    return state.mitigation === "stale-while-revalidate" && metrics.staleServed > 0
      ? "The source is failing, but SWR keeps serving the previous value inside its explicit stale grace window. That protects latency and source load by spending freshness budget."
      : "A failed source load does not create a cache value. Without bounded coordination, each retry can become another source call; inspect failed loads and waiter timeouts."
  }
  if (metrics.leaseExpirations > 0) {
    return "The lease expired before a slow owner finished. A second owner was allowed to start, so a lock bounds ownership but does not guarantee exactly-once loading."
  }
  if (state.mitigation === "none") {
    return `The cache is ${metrics.cacheStatus}. On a synchronized miss, ${formatNumber(metrics.sourceCalls)} source calls can overlap for the same key; the cache has multiplied rather than absorbed the burst.`
  }
  if (state.mitigation === "jitter") {
    return "TTL jitter moves expiry boundaries between fills, but this single hot key still has one boundary. Jitter spreads cohorts; it does not coalesce a simultaneous miss."
  }
  if (state.mitigation === "local-single-flight") {
    return `Local single-flight collapses readers inside each process. With ${state.config.processCount} processes, up to one loader per process can still reach the source.`
  }
  if (state.mitigation === "distributed-lock") {
    return metrics.lockHeld
      ? `One owner token holds the per-key lease while ${formatNumber(metrics.lockContention)} readers wait. A bounded lease lets the system recover if that owner crashes.`
      : "The distributed lease is free. The next miss will atomically choose one owner token before other readers join it."
  }
  return metrics.staleServed > 0
    ? `SWR served ${formatNumber(metrics.staleServed)} readers at stale age ${formatMs(metrics.staleAgeMs)} while one background refresh ran. Availability improved, freshness became an explicit budget.`
    : "SWR behaves like a coordinated fill on a cold key, then serves the expired value during the stale grace window while one refresh runs."
}

function summaryFor(state: CacheStampedeState, metrics: CacheStampedeMetrics): string {
  return `${cacheStampedeMitigationLabel(state.mitigation)} · cache ${metrics.cacheStatus} · ${formatNumber(metrics.currentSourceConcurrency)} source calls active · ${formatNumber(metrics.failedLoads)} failed loads.`;
}

function isCacheStampedePresetId(value: string): value is CacheStampedePresetId {
  return CACHE_STAMPEDE_PRESETS.some((preset) => preset.id === value);
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function formatMs(value: number): string {
  return `${Math.round(value)} ms`;
}
