import {
  VISUALIZATION_KINDS,
  type VisualizationDefinition,
} from "@/simulations";

import { visualizations } from "./visualizations";

const STABLE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class VisualizationRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VisualizationRegistryError";
  }
}

function assertStableId(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !STABLE_ID_PATTERN.test(value)) {
    throw new VisualizationRegistryError(`${label} must be a lowercase, hyphen-delimited stable ID.`);
  }
}

function assertText(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new VisualizationRegistryError(`${label} must be non-empty text.`);
  }
}

export function assertVisualizationDefinition(
  value: unknown,
): asserts value is VisualizationDefinition {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new VisualizationRegistryError("Visualization definition must be an object.");
  }
  const record = value as Record<string, unknown>;
  const expected = ["id", "lessonId", "kind", "title", "description"];
  const keys = Object.keys(record);
  if (keys.length !== expected.length || keys.some((key) => !expected.includes(key))) {
    throw new VisualizationRegistryError(`Visualization definition must contain only: ${expected.join(", ")}.`);
  }
  assertStableId(record.id, "Visualization ID");
  assertStableId(record.lessonId, `Visualization ${record.id} lesson ID`);
  if (!VISUALIZATION_KINDS.includes(record.kind as (typeof VISUALIZATION_KINDS)[number])) {
    throw new VisualizationRegistryError(`Visualization ${record.id} has an unsupported kind.`);
  }
  assertText(record.title, `Visualization ${record.id} title`);
  assertText(record.description, `Visualization ${record.id} description`);
}

export function createVisualizationRegistry(
  definitions: readonly VisualizationDefinition[],
): ReadonlyMap<string, VisualizationDefinition> {
  const next = new Map<string, VisualizationDefinition>();
  const lessonIds = new Set<string>();
  for (const definition of definitions) {
    assertVisualizationDefinition(definition);
    if (next.has(definition.id)) {
      throw new VisualizationRegistryError(`Duplicate visualization ID: ${definition.id}.`);
    }
    if (lessonIds.has(definition.lessonId)) {
      throw new VisualizationRegistryError(
        `Lesson ${definition.lessonId} has more than one registered visualization.`,
      );
    }
    lessonIds.add(definition.lessonId);
    next.set(definition.id, { ...definition });
  }
  return next;
}

const registry = createVisualizationRegistry(visualizations);

export function getVisualization(
  visualizationId: string | null | undefined,
): VisualizationDefinition | null {
  return visualizationId ? registry.get(visualizationId) ?? null : null;
}

export function listVisualizationIds(): string[] {
  return [...registry.keys()].sort();
}

export function listVisualizations(): VisualizationDefinition[] {
  return [...registry.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export function assertVisualizationRegistryLessonIds(lessonIds: Iterable<string>): void {
  const known = new Set(lessonIds);
  for (const visualization of registry.values()) {
    if (!known.has(visualization.lessonId)) {
      throw new VisualizationRegistryError(
        `Visualization ${visualization.id} references unknown lesson ID: ${visualization.lessonId}.`,
      );
    }
  }
}
