import { SCENARIO_LABS } from "./configurations";
import type {
  ScenarioLabAction,
  ScenarioLabDefinition,
  ScenarioLabFrame,
  ScenarioLabId,
  ScenarioLabPreset,
  ScenarioLabState,
  ScenarioLabTransition,
} from "./types";

const MAX_EVENTS = 8;

export function getScenarioLab(labId: ScenarioLabId): ScenarioLabDefinition {
  const lab = SCENARIO_LABS.find((candidate) => candidate.id === labId);
  if (!lab) throw new Error(`Unknown scenario lab: ${labId}.`);
  return lab;
}

export function getScenarioLabPreset(labId: ScenarioLabId, presetId: string): ScenarioLabPreset {
  const lab = getScenarioLab(labId);
  const preset = lab.presets.find((candidate) => candidate.id === presetId);
  if (!preset) throw new Error(`Unknown ${labId} preset: ${presetId}.`);
  return preset;
}

export function createScenarioLabState(labId: ScenarioLabId, presetId?: string): ScenarioLabState {
  const lab = getScenarioLab(labId);
  const selectedPresetId = presetId ?? lab.presets[0]?.id;
  if (!selectedPresetId) throw new Error(`Scenario lab ${labId} has no presets.`);
  getScenarioLabPreset(labId, selectedPresetId);
  return { labId, presetId: selectedPresetId, frameIndex: 0, events: [], completed: false };
}

export function currentScenarioLabFrame(state: ScenarioLabState): ScenarioLabFrame {
  const preset = getScenarioLabPreset(state.labId, state.presetId);
  const frame = preset.frames[state.frameIndex];
  if (!frame) throw new Error(`Frame ${state.frameIndex} is unavailable for ${state.labId}.`);
  return frame;
}

export function transitionScenarioLab(
  state: ScenarioLabState,
  action: ScenarioLabAction,
): ScenarioLabTransition {
  if (action.type === "reset") {
    const next = createScenarioLabState(state.labId, state.presetId);
    return {
      state: next,
      event: {
        id: `${state.labId}-reset`,
        tick: 0,
        type: "reset",
        title: "Scenario reset",
        detail: "The authored initial state was restored exactly.",
        tone: "info",
      },
    };
  }

  const preset = getScenarioLabPreset(state.labId, state.presetId);
  const nextIndex = Math.min(state.frameIndex + 1, preset.frames.length - 1);
  const frame = preset.frames[nextIndex];
  if (!frame) throw new Error(`Scenario ${state.presetId} has no frames.`);
  const event = {
    ...frame.event,
    id: `${state.labId}-${state.presetId}-${nextIndex}`,
    tick: nextIndex,
  };
  const completed = nextIndex === preset.frames.length - 1;
  return {
    state: {
      ...state,
      frameIndex: nextIndex,
      completed,
      events: nextIndex === state.frameIndex
        ? state.events
        : [...state.events, event].slice(-MAX_EVENTS),
    },
    event,
  };
}
