import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HorizontalScalingSimulation } from "@/components/simulations";
import { TheoryOnlyState } from "@/components/lesson";
import { getVisualization } from "@/content/visualizations";

describe("visualization route integration", () => {
  it("resolves both representative lessons through stable registry definitions", () => {
    expect(getVisualization("horizontal-scaling")).toMatchObject({
      lessonId: "01-02-horizontal-vs-vertical-scaling",
      kind: "horizontal-scaling",
    });
    expect(getVisualization("consistent-hash-ring")).toMatchObject({
      lessonId: "04-10-consistent-hashing",
      kind: "consistent-hashing",
    });
  });

  it("server-renders simulation markup without touching IndexedDB", () => {
    const globalObject = globalThis as typeof globalThis & { indexedDB?: IDBFactory };
    const previous = globalObject.indexedDB;
    Reflect.deleteProperty(globalObject, "indexedDB");
    try {
      const markup = renderToStaticMarkup(
        <HorizontalScalingSimulation lessonId="01-02-horizontal-vs-vertical-scaling" />,
      );
      expect(markup).toContain("Scale up or scale out?");
      expect(markup).toContain("Horizontal scaling request fleet");
      expect(markup).toContain("Mark visualization complete");
    } finally {
      if (previous !== undefined) globalObject.indexedDB = previous;
    }
  });

  it("preserves an explicit unavailable state for theory-only lessons", () => {
    const markup = renderToStaticMarkup(
      <TheoryOnlyState visualizationId={null} quizId={null} />,
    );
    expect(markup).toContain("Visualization coming later");
    expect(markup).toContain("authored theory remains complete");
  });
});
