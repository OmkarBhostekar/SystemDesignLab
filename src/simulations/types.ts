export const SIMULATION_SPEEDS = [0.5, 1, 2] as const;

export type SimulationSpeed = (typeof SIMULATION_SPEEDS)[number];

export type SimulationEventTone = "info" | "success" | "warning" | "failure";

export interface SimulationEvent {
  id: string;
  tick: number;
  type: string;
  title: string;
  detail: string;
  tone: SimulationEventTone;
}

export interface SimulationMetric {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone?: SimulationEventTone;
}

export interface SimulationPreset<TPresetId extends string> {
  id: TPresetId;
  label: string;
  description: string;
}

export const VISUALIZATION_KINDS = ["horizontal-scaling", "consistent-hashing"] as const;

export type VisualizationKind = (typeof VISUALIZATION_KINDS)[number];

export interface VisualizationDefinition {
  id: string;
  lessonId: string;
  kind: VisualizationKind;
  title: string;
  description: string;
}
