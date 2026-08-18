"use client";

import dynamic from "next/dynamic";

import type { VisualizationDefinition } from "@/simulations";

const HorizontalScalingSimulation = dynamic(
  () => import("./HorizontalScalingSimulation").then((module) => module.HorizontalScalingSimulation),
  { ssr: false, loading: SimulationLoadingState },
);

const ConsistentHashingSimulation = dynamic(
  () => import("./ConsistentHashingSimulation").then((module) => module.ConsistentHashingSimulation),
  { ssr: false, loading: SimulationLoadingState },
);

export function VisualizationPanel({
  visualization,
}: {
  visualization: VisualizationDefinition;
}) {
  if (visualization.kind === "horizontal-scaling") {
    return <HorizontalScalingSimulation lessonId={visualization.lessonId} />;
  }
  if (visualization.kind === "consistent-hashing") {
    return <ConsistentHashingSimulation lessonId={visualization.lessonId} />;
  }
  return (
    <p className="simulation-shell__error" role="alert">
      This visualization renderer is not available in this build.
    </p>
  );
}

function SimulationLoadingState() {
  return (
    <section className="simulation-loading" aria-label="Interactive simulation" aria-busy="true">
      <p role="status">Loading the interactive simulation…</p>
    </section>
  );
}
