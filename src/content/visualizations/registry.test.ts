import { describe, expect, it } from "vitest";

import type { VisualizationDefinition } from "@/simulations";

import {
  VisualizationRegistryError,
  assertVisualizationRegistryLessonIds,
  createVisualizationRegistry,
  getVisualization,
  listVisualizationIds,
} from "./registry";

describe("visualization registry", () => {
  it("resolves registered IDs deterministically", () => {
    expect(listVisualizationIds()).toEqual(["consistent-hash-ring", "horizontal-scaling"]);
    expect(getVisualization("horizontal-scaling")?.lessonId).toBe(
      "01-02-horizontal-vs-vertical-scaling",
    );
    expect(getVisualization("missing-visualization")).toBeNull();
  });

  it("rejects duplicate visualization and lesson IDs", () => {
    const visualization = getVisualization("horizontal-scaling") as VisualizationDefinition;
    expect(() => createVisualizationRegistry([visualization, visualization])).toThrow(
      VisualizationRegistryError,
    );
    expect(() => createVisualizationRegistry([
      visualization,
      { ...visualization, id: "another-scaling-view" },
    ])).toThrow(/more than one registered visualization/);
  });

  it("rejects unknown registry lesson IDs", () => {
    expect(() => assertVisualizationRegistryLessonIds([
      "01-02-horizontal-vs-vertical-scaling",
    ])).toThrow(/unknown lesson ID/);
  });
});
