"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";

import { IndexedDbProgressRepository } from "@/repositories/indexeddb-progress-repository";
import {
  createSimulationCompletionId,
  type SimulationCompletion,
} from "@/domain/progress";
import {
  SIMULATION_SPEEDS,
  type SimulationEvent,
  type SimulationMetric,
  type SimulationPreset,
  type SimulationSpeed,
} from "@/simulations";

import type {
  SimulationCompletionFactory,
  SimulationRepository,
} from "./simulation-types";

const PLAY_INTERVAL_MS: Record<SimulationSpeed, number> = {
  0.5: 1600,
  1: 800,
  2: 400,
};

export interface SimulationShellProps<State, Action = unknown> {
  simulationId: string;
  lessonId?: string;
  title: string;
  description: string;
  state: State;
  dispatch: Dispatch<Action>;
  onStep: () => void;
  onReset: () => void;
  onPresetChange?: (presetId: string) => void;
  metrics: readonly SimulationMetric[];
  events?: readonly SimulationEvent[];
  explanation: string;
  summary: string;
  presets?: readonly SimulationPreset<string>[];
  presetId?: string;
  isComplete?: boolean;
  externalError?: string | null;
  repository?: SimulationRepository;
  completionFactory?: SimulationCompletionFactory;
  children: ReactNode;
  controls?: ReactNode | ((props: SimulationShellRenderProps<Action>) => ReactNode);
  initialStatus?: string;
}

export interface SimulationShellRenderProps<Action = unknown> {
  dispatch: Dispatch<Action>;
  announce: (message: string) => void;
  reducedMotion: boolean;
  playing: boolean;
  speed: SimulationSpeed;
}

/**
 * Shared client-only chrome for a deterministic simulation renderer. The
 * engine remains outside this component; the shell owns only playback,
 * announcements, persistence, and presentation of the model's state.
 */
export function SimulationShell<State, Action = unknown>({
  simulationId,
  lessonId,
  title,
  description,
  dispatch,
  onStep,
  onReset,
  onPresetChange,
  metrics,
  events = [],
  explanation,
  summary,
  presets = [],
  presetId,
  isComplete = false,
  externalError,
  repository,
  completionFactory = createDefaultCompletion,
  children,
  controls,
  initialStatus = "Use Step to advance the model, or Play to let it run.",
}: SimulationShellProps<State, Action>) {
  const titleId = useId();
  const statusId = `${titleId}-status`;
  const summaryId = `${titleId}-summary`;
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<SimulationSpeed>(1);
  const reducedMotion = usePrefersReducedMotion();
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [persistedCompletionId, setPersistedCompletionId] = useState<string | null>(null);
  const repositoryRef = useRef<SimulationRepository | null>(null);
  const boundedEvents = useMemo(() => events.slice(-8), [events]);
  const completion = useMemo(
    () => (lessonId ? completionFactory(simulationId, lessonId, presetId ?? "default") : null),
    [completionFactory, lessonId, presetId, simulationId],
  );
  const persistedCompletion = completion?.completionId === persistedCompletionId;
  const playbackActive = playing && !isComplete;
  const visibleStatus = externalError
    ? "The simulation action could not be applied."
    : reducedMotion
      ? "Reduced motion is on. Use Step to advance without autoplay."
      : status;

  useEffect(() => {
    let cancelled = false;

    if (!completion) return;

    const nextRepository = repository ?? repositoryRef.current ?? new IndexedDbProgressRepository();
    repositoryRef.current = nextRepository;
    void nextRepository.getSimulationCompletion(completion.completionId)
      .then((savedCompletion) => {
        if (!cancelled) setPersistedCompletionId(savedCompletion ? completion.completionId : null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(errorMessage(cause));
        setStatus("The local completion record could not be checked.");
      });

    return () => {
      cancelled = true;
    };
  }, [completion, repository]);

  const announce = useCallback((message: string) => {
    setStatus(message);
    setError(null);
  }, []);

  useEffect(() => {
    if (!playbackActive || reducedMotion) return;

    const timer = window.setInterval(() => {
      onStep();
    }, PLAY_INTERVAL_MS[speed]);

    return () => window.clearInterval(timer);
  }, [onStep, playbackActive, reducedMotion, speed]);

  function togglePlayback() {
    if (reducedMotion) {
      announce("Reduced motion is on. Use Step to advance without autoplay.");
      return;
    }
    if (isComplete) {
      announce("Scenario complete. Reset to run it again.");
      return;
    }
    setPlaying((current) => {
      const next = !current;
      announce(next ? `Simulation playing at ${speed}× speed.` : "Simulation paused.");
      return next;
    });
  }

  function changeSpeed(nextSpeed: SimulationSpeed) {
    setSpeed(nextSpeed);
    announce(`Playback speed set to ${nextSpeed}×.`);
  }

  function reset() {
    setPlaying(false);
    onReset();
    announce(presetId ? "Simulation reset to the selected preset." : "Simulation reset to its initial state.");
  }

  function choosePreset(nextPresetId: string) {
    setPlaying(false);
    onPresetChange?.(nextPresetId);
    announce("Scenario preset loaded.");
  }

  async function markVisualizationComplete() {
    if (!lessonId) {
      setError("This simulation is not attached to a lesson yet.");
      setStatus("Completion could not be saved.");
      return;
    }

    if (!isComplete) {
      setError("Finish the scenario before recording its visualization milestone.");
      setStatus("Completion could not be saved.");
      return;
    }

    setSaving(true);
    setError(null);
    setStatus("Saving visualization completion…");
    const nextRepository = repository ?? repositoryRef.current ?? new IndexedDbProgressRepository();
    repositoryRef.current = nextRepository;
    const nextCompletion = completion ?? completionFactory(simulationId, lessonId, presetId ?? "default");

    try {
      await nextRepository.saveSimulationCompletion(nextCompletion);
      setPersistedCompletionId(nextCompletion.completionId);
      setStatus("Visualization completion saved on this device.");
    } catch (cause) {
      setError(errorMessage(cause));
      setStatus("The scenario is complete, but completion could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="simulation-shell" aria-labelledby={titleId} data-simulation-id={simulationId}>
      <header className="simulation-shell__header">
        <p className="eyebrow">Interactive simulation</p>
        <h2 id={titleId}>{title}</h2>
        <p>{description}</p>
      </header>

      <div className="simulation-shell__toolbar" aria-label="Simulation controls">
        <div className="simulation-shell__transport" role="group" aria-label="Playback controls">
          <button className="button button--primary" type="button" onClick={togglePlayback} disabled={saving}>
            {playbackActive ? "Pause" : "Play"}
          </button>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => {
              setPlaying(false);
              onStep();
              announce("Simulation advanced one step.");
            }}
            disabled={saving}
          >
            Step
          </button>
          <button className="button button--secondary" type="button" onClick={reset} disabled={saving}>
            Reset
          </button>
        </div>

        <label className="simulation-shell__field">
          <span>Speed</span>
          <select
            value={String(speed)}
            onChange={(event) => changeSpeed(Number(event.target.value) as SimulationSpeed)}
            disabled={saving}
          >
            {SIMULATION_SPEEDS.map((option) => (
              <option key={option} value={option}>
                {option}×
              </option>
            ))}
          </select>
        </label>

        {presets.length > 0 ? (
          <label className="simulation-shell__field">
            <span>Scenario</span>
            <select
              value={presetId ?? presets[0]?.id}
              onChange={(event) => choosePreset(event.target.value)}
              disabled={saving}
            >
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {controls ? (
        <div className="simulation-shell__scenario-controls">
          {typeof controls === "function"
            ? controls({ dispatch, announce, reducedMotion, playing: playbackActive, speed })
            : controls}
        </div>
      ) : null}

      <p className="simulation-shell__status" id={statusId} role="status" aria-live="polite" aria-atomic="true">
        {visibleStatus}
      </p>
      {externalError || error ? <p className="simulation-shell__error" role="alert">{externalError ?? error}</p> : null}

      <div className="simulation-shell__body">
        <div className="simulation-shell__visual" aria-describedby={summaryId}>
          {children}
        </div>
        <aside className="simulation-shell__explanation" aria-label="Simulation explanation">
          <p className="eyebrow">What changed</p>
          <p>{explanation}</p>
          <p className="simulation-shell__summary" id={summaryId}>{summary}</p>
        </aside>
      </div>

      <div className="simulation-shell__metrics" aria-label="Simulation metrics">
        <h3>Current metrics</h3>
        <dl>
          {metrics.map((metric) => (
            <div key={metric.id} className={`simulation-metric simulation-metric--${metric.tone ?? "info"}`}>
              <dt>{metric.label}</dt>
              <dd>{metric.value}</dd>
              <small>{metric.detail}</small>
            </div>
          ))}
        </dl>
      </div>

      <details className="simulation-shell__events">
        <summary>Event timeline ({boundedEvents.length})</summary>
        {boundedEvents.length > 0 ? (
          <ol aria-label="Simulation event timeline">
            {boundedEvents.map((event) => (
              <li key={event.id} className={`simulation-event simulation-event--${event.tone}`}>
                <strong>{event.title}</strong>
                <span>{event.detail}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p>No simulation events yet. Use Step or a scenario control.</p>
        )}
      </details>

      <div className="simulation-shell__completion">
        <div>
          <p className="eyebrow">Learning checkpoint</p>
          <p>
            {persistedCompletion
              ? "Visualization complete and saved locally."
              : isComplete
                ? "Scenario complete. Record the visualization milestone on this device."
                : "Run the scenario, then record the visualization milestone."}
          </p>
        </div>
        <button
          className="button button--secondary"
          type="button"
          onClick={markVisualizationComplete}
          disabled={saving || persistedCompletion || !isComplete}
        >
          {saving ? "Saving…" : persistedCompletion ? "Visualization completed" : "Mark visualization complete"}
        </button>
      </div>
    </section>
  );
}

function createDefaultCompletion(
  simulationId: string,
  lessonId: string,
  scenarioId: string,
): SimulationCompletion {
  return {
    completionId: createSimulationCompletionId(simulationId, scenarioId),
    visualizationId: simulationId,
    lessonId,
    scenarioId,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unknown progress storage error occurred.";
}

function usePrefersReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  return reducedMotion;
}
