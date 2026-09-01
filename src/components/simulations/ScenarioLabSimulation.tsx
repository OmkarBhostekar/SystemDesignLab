"use client";

import { useCallback, useMemo, useState } from "react";

import {
  createScenarioLabState,
  currentScenarioLabFrame,
  getScenarioLab,
  transitionScenarioLab,
  type ScenarioLabAction,
  type ScenarioLabId,
  type ScenarioLabState,
} from "@/simulations/scenario-lab";

import { SimulationShell } from "./SimulationShell";
import type { SimulationCompletionFactory, SimulationRepository } from "./simulation-types";

export interface ScenarioLabSimulationProps {
  labId: ScenarioLabId;
  lessonId?: string;
  repository?: SimulationRepository;
  completionFactory?: SimulationCompletionFactory;
}

export function ScenarioLabSimulation({
  labId,
  lessonId,
  repository,
  completionFactory,
}: ScenarioLabSimulationProps) {
  const lab = useMemo(() => getScenarioLab(labId), [labId]);
  const [state, setState] = useState<ScenarioLabState>(() => createScenarioLabState(labId));
  const frame = currentScenarioLabFrame(state);

  const apply = useCallback((action: ScenarioLabAction) => {
    setState((current) => transitionScenarioLab(current, action).state);
  }, []);
  const step = useCallback(() => apply({ type: "step" }), [apply]);
  const reset = useCallback(() => apply({ type: "reset" }), [apply]);
  const selectPreset = useCallback((presetId: string) => {
    setState(createScenarioLabState(labId, presetId));
  }, [labId]);
  const selectedPreset = lab.presets.find((preset) => preset.id === state.presetId)!;

  return (
    <SimulationShell<ScenarioLabState, ScenarioLabAction>
      simulationId={labId}
      lessonId={lessonId}
      title={lab.title}
      description={lab.description}
      state={state}
      dispatch={apply}
      onStep={step}
      onReset={reset}
      onPresetChange={selectPreset}
      metrics={frame.metrics}
      events={state.events}
      explanation={frame.explanation}
      summary={`Step ${state.frameIndex + 1} of ${selectedPreset.frames.length}: ${frame.title}`}
      presets={lab.presets}
      presetId={state.presetId}
      isComplete={state.completed}
      repository={repository}
      completionFactory={completionFactory}
      initialStatus="Use Step to inspect each deterministic decision, or Play to run the scenario."
    >
      <div className="scenario-lab" role="img" aria-label={`${lab.title}. ${frame.explanation}`}>
        <div className="scenario-lab__progress" aria-hidden="true">
          {selectedPreset.frames.map((candidate, index) => (
            <span
              key={candidate.title}
              className={index <= state.frameIndex ? "scenario-lab__progress-step scenario-lab__progress-step--reached" : "scenario-lab__progress-step"}
            />
          ))}
        </div>
        <p className="scenario-lab__phase">{frame.title}</p>
        <div className="scenario-lab__flow">
          {lab.nodes.map((item, index) => (
            <div className="scenario-lab__flow-item" key={item.id}>
              {index > 0 ? (
                <div className={`scenario-lab__link scenario-lab__link--${frame.links[index - 1]?.tone ?? "neutral"}`} aria-hidden="true">
                  <span>{frame.links[index - 1]?.label}</span>
                  <b>→</b>
                </div>
              ) : null}
              <div className={`scenario-lab__node scenario-lab__node--${frame.nodeTones[item.id] ?? "neutral"}`}>
                <span className="scenario-lab__kind">{item.kind}</span>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </div>
            </div>
          ))}
        </div>
        <ol className="scenario-lab__text-alternative">
          {lab.nodes.map((item) => (
            <li key={item.id}>{item.label}: {frame.nodeTones[item.id] ?? "neutral"}. {item.detail}</li>
          ))}
        </ol>
      </div>
    </SimulationShell>
  );
}
