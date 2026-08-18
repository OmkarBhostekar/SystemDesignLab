import { ProgressValidationError } from "./errors";
import type { SimulationCompletion } from "./model";
import { assertLessonId } from "./transitions";

const STABLE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COMPLETION_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*--[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertStableId(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !STABLE_ID_PATTERN.test(value)) {
    throw new ProgressValidationError(`${label} must be a lowercase, hyphen-delimited stable ID.`);
  }
}

export function createSimulationCompletionId(
  visualizationId: string,
  scenarioId: string,
): string {
  assertStableId(visualizationId, "Visualization ID");
  assertStableId(scenarioId, "Scenario ID");
  return `${visualizationId}--${scenarioId}`;
}

export function normalizeSimulationCompletionId(value: unknown): string {
  if (typeof value !== "string" || !COMPLETION_ID_PATTERN.test(value)) {
    throw new ProgressValidationError(
      "Simulation completion ID must join stable visualization and scenario IDs with --.",
    );
  }
  return value;
}

export function normalizeSimulationCompletion(value: unknown): SimulationCompletion {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ProgressValidationError("Simulation completion must be an object.");
  }
  const record = value as Record<string, unknown>;
  const expected = ["completionId", "visualizationId", "lessonId", "scenarioId"];
  const keys = Object.keys(record);
  if (keys.length !== expected.length || keys.some((key) => !expected.includes(key))) {
    throw new ProgressValidationError(
      `Simulation completion must contain only: ${expected.join(", ")}.`,
    );
  }
  normalizeSimulationCompletionId(record.completionId);
  assertStableId(record.visualizationId, "Visualization ID");
  assertStableId(record.scenarioId, "Scenario ID");
  assertLessonId(record.lessonId);
  const expectedId = createSimulationCompletionId(record.visualizationId, record.scenarioId);
  if (record.completionId !== expectedId) {
    throw new ProgressValidationError(
      `Simulation completion ID must equal ${expectedId}.`,
    );
  }
  return {
    completionId: expectedId,
    visualizationId: record.visualizationId,
    lessonId: record.lessonId,
    scenarioId: record.scenarioId,
  };
}

export function simulationCompletionsEqual(
  left: SimulationCompletion,
  right: SimulationCompletion,
): boolean {
  return JSON.stringify(normalizeSimulationCompletion(left)) ===
    JSON.stringify(normalizeSimulationCompletion(right));
}
