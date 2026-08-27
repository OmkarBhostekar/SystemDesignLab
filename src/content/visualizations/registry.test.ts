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
    expect(listVisualizationIds()).toEqual([
      "backpressure",
      "cache-stampede",
      "cap",
      "consistent-hash-ring",
      "horizontal-scaling",
      "load-balancing-algorithms",
      "tail-latency",
      "transaction-isolation",
    ]);
    expect(getVisualization("horizontal-scaling")?.lessonId).toBe(
      "01-02-horizontal-vs-vertical-scaling",
    );
    expect(getVisualization("tail-latency")).toMatchObject({
      lessonId: "01-04-percentiles-tail-latency",
      kind: "tail-latency",
    });
    expect(getVisualization("cap")).toMatchObject({
      lessonId: "01-09-cap",
      kind: "cap",
    });
    expect(getVisualization("load-balancing-algorithms")).toMatchObject({
      lessonId: "03-02-load-balancing-algorithms",
      kind: "load-balancing",
    });
    expect(getVisualization("transaction-isolation")).toMatchObject({
      lessonId: "04-05-transaction-isolation",
      kind: "transaction-isolation",
    });
    expect(getVisualization("cache-stampede")).toMatchObject({
      lessonId: "05-07-cache-stampede",
      kind: "cache-stampede",
    });
    expect(getVisualization("backpressure")).toMatchObject({
      lessonId: "06-09-backpressure",
      kind: "backpressure",
    });
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
