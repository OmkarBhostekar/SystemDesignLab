"use client";

import dynamic from "next/dynamic";

import { isScenarioLabId, type VisualizationDefinition } from "@/simulations";

const HorizontalScalingSimulation = dynamic(
  () => import("./HorizontalScalingSimulation").then((module) => module.HorizontalScalingSimulation),
  { ssr: false, loading: SimulationLoadingState },
);

const ConsistentHashingSimulation = dynamic(
  () => import("./ConsistentHashingSimulation").then((module) => module.ConsistentHashingSimulation),
  { ssr: false, loading: SimulationLoadingState },
);

const TailLatencySimulation = dynamic(
  () => import("./TailLatencySimulation").then((module) => module.TailLatencySimulation),
  { ssr: false, loading: SimulationLoadingState },
);

const CapSimulation = dynamic(
  () => import("./CapSimulation").then((module) => module.CapSimulation),
  { ssr: false, loading: SimulationLoadingState },
);

const LoadBalancingSimulation = dynamic(
  () => import("./LoadBalancingSimulation").then((module) => module.LoadBalancingSimulation),
  { ssr: false, loading: SimulationLoadingState },
);

const TransactionIsolationSimulation = dynamic(
  () => import("./TransactionIsolationSimulation").then((module) => module.TransactionIsolationSimulation),
  { ssr: false, loading: SimulationLoadingState },
);

const CacheStampedeSimulation = dynamic(
  () => import("./CacheStampedeSimulation").then((module) => module.CacheStampedeSimulation),
  { ssr: false, loading: SimulationLoadingState },
);

const BackpressureSimulation = dynamic(
  () => import("./BackpressureSimulation").then((module) => module.BackpressureSimulation),
  { ssr: false, loading: SimulationLoadingState },
);

const ScenarioLabSimulation = dynamic(
  () => import("./ScenarioLabSimulation").then((module) => module.ScenarioLabSimulation),
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
  if (visualization.kind === "tail-latency") {
    return <TailLatencySimulation lessonId={visualization.lessonId} />;
  }
  if (visualization.kind === "cap") {
    return <CapSimulation lessonId={visualization.lessonId} />;
  }
  if (visualization.kind === "load-balancing") {
    return <LoadBalancingSimulation lessonId={visualization.lessonId} />;
  }
  if (visualization.kind === "transaction-isolation") {
    return <TransactionIsolationSimulation lessonId={visualization.lessonId} />;
  }
  if (visualization.kind === "cache-stampede") {
    return <CacheStampedeSimulation lessonId={visualization.lessonId} />;
  }
  if (visualization.kind === "backpressure") {
    return <BackpressureSimulation lessonId={visualization.lessonId} />;
  }
  if (visualization.kind === "scenario-lab" && isScenarioLabId(visualization.id)) {
    return <ScenarioLabSimulation labId={visualization.id} lessonId={visualization.lessonId} />;
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
