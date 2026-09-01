import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  BackpressureSimulation,
  CacheStampedeSimulation,
  CapSimulation,
  ConsistentHashingSimulation,
  HorizontalScalingSimulation,
  LoadBalancingSimulation,
  TailLatencySimulation,
  TransactionIsolationSimulation,
  ScenarioLabSimulation,
} from "@/components/simulations";
import { SCENARIO_LABS } from "@/simulations";
import { TheoryOnlyState } from "@/components/lesson";
import { getVisualization } from "@/content/visualizations";

describe("visualization route integration", () => {
  it("resolves eight representative lessons through stable registry definitions", () => {
    expect(getVisualization("horizontal-scaling")).toMatchObject({
      lessonId: "01-02-horizontal-vs-vertical-scaling",
      kind: "horizontal-scaling",
    });
    expect(getVisualization("consistent-hash-ring")).toMatchObject({
      lessonId: "04-10-consistent-hashing",
      kind: "consistent-hashing",
    });
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
  });

  it("server-renders all eight simulations without touching IndexedDB", () => {
    const globalObject = globalThis as typeof globalThis & { indexedDB?: IDBFactory };
    const previous = globalObject.indexedDB;
    Reflect.deleteProperty(globalObject, "indexedDB");
    try {
      const cases = [
        {
          render: () => <HorizontalScalingSimulation lessonId="01-02-horizontal-vs-vertical-scaling" />,
          title: "Scale up or scale out?",
        },
        {
          render: () => <ConsistentHashingSimulation lessonId="04-10-consistent-hashing" />,
          title: "Consistent hash-ring explorer",
        },
        {
          render: () => <TailLatencySimulation lessonId="01-04-percentiles-tail-latency" />,
          title: "Can the average hide a slow user?",
        },
        { render: () => <CapSimulation lessonId="01-09-cap" />, title: "CAP partition lab" },
        {
          render: () => <LoadBalancingSimulation lessonId="03-02-load-balancing-algorithms" />,
          title: "Route the same workload seven ways",
        },
        {
          render: () => <TransactionIsolationSimulation lessonId="04-05-transaction-isolation" />,
          title: "Schedule two transactions",
        },
        {
          render: () => <CacheStampedeSimulation lessonId="05-07-cache-stampede" />,
          title: "Stampede Control Room",
        },
        {
          render: () => <BackpressureSimulation lessonId="06-09-backpressure" />,
          title: "Where does overload go?",
        },
      ];
      for (const testCase of cases) {
        const markup = renderToStaticMarkup(testCase.render());
        expect(markup).toContain(testCase.title);
        expect(markup).toContain("Mark visualization complete");
      }
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

  it("server-renders every M8 scenario lab with accessible controls and a text model", () => {
    for (const lab of SCENARIO_LABS) {
      const markup = renderToStaticMarkup(
        <ScenarioLabSimulation labId={lab.id} lessonId="test-lesson" />,
      );
      expect(markup).toContain(lab.title);
      expect(markup).toContain("Mark visualization complete");
      expect(markup).toContain("Step 1 of 4");
      for (const node of lab.nodes) expect(markup).toContain(node.label);
    }
  });
});
