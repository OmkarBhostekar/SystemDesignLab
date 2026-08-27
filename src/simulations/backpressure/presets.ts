import type { BackpressurePresetDefinition, BackpressurePresetId } from "./types";

const BASE_CONFIG = {
  arrivalRate: 6,
  burstRate: 6,
  burstStartTick: 3,
  burstDurationTicks: 4,
  serviceRate: 4,
  queueCapacity: 24,
  prefetch: 2,
  consumerCount: 2,
  downstreamLimit: 8,
  retryLimit: 2,
  retryBackoffTicks: 1,
  partitionCount: 3,
  priorityPolicy: "fifo",
  admissionPolicy: "buffer",
} as const;

/**
 * Presets use whole logical jobs per model tick so the difference between a
 * burst and steady-state capacity can be inspected one Step at a time.
 */
export const BACKPRESSURE_PRESETS = [
  {
    id: "steady-capacity",
    label: "Steady state",
    description: "Arrival stays below worker and dependency capacity; observe a bounded, draining buffer.",
    config: {
      ...BASE_CONFIG,
      arrivalRate: 5,
      burstRate: 5,
      serviceRate: 4,
      queueCapacity: 24,
      prefetch: 2,
      consumerCount: 2,
      downstreamLimit: 8,
    },
  },
  {
    id: "burst-absorption",
    label: "Burst absorption",
    description: "A finite producer burst fills the broker; the bounded buffer buys time but cannot raise steady-state service rate.",
    config: {
      ...BASE_CONFIG,
      arrivalRate: 4,
      burstRate: 18,
      burstStartTick: 3,
      burstDurationTicks: 5,
      serviceRate: 3,
      queueCapacity: 18,
      prefetch: 2,
      consumerCount: 2,
      downstreamLimit: 6,
      admissionPolicy: "buffer",
    },
  },
  {
    id: "downstream-outage",
    label: "Dependency outage",
    description: "A failing downstream turns retries into extra traffic; compare an open buffer with safe throttling or shedding.",
    config: {
      ...BASE_CONFIG,
      arrivalRate: 3,
      burstRate: 10,
      burstStartTick: 2,
      burstDurationTicks: 6,
      serviceRate: 4,
      queueCapacity: 20,
      prefetch: 3,
      consumerCount: 2,
      downstreamLimit: 4,
      retryLimit: 3,
      retryBackoffTicks: 1,
      admissionPolicy: "buffer",
    },
  },
  {
    id: "priority-shedding",
    label: "Priority-aware shedding",
    description: "Reserved critical capacity and low-priority shedding keep optional work from starving important jobs.",
    config: {
      ...BASE_CONFIG,
      arrivalRate: 12,
      burstRate: 24,
      burstStartTick: 2,
      burstDurationTicks: 7,
      serviceRate: 3,
      queueCapacity: 14,
      prefetch: 2,
      consumerCount: 2,
      downstreamLimit: 5,
      retryLimit: 1,
      priorityPolicy: "reserved-critical",
      admissionPolicy: "shed-low-priority",
    },
  },
] as const satisfies readonly BackpressurePresetDefinition[];

export const BACKPRESSURE_PRESET_BY_ID: ReadonlyMap<
  BackpressurePresetId,
  BackpressurePresetDefinition
> = new Map(BACKPRESSURE_PRESETS.map((preset) => [preset.id, preset]));

export function getBackpressurePreset(
  presetId: BackpressurePresetId,
): BackpressurePresetDefinition {
  const preset = BACKPRESSURE_PRESET_BY_ID.get(presetId);
  if (!preset) throw new Error(`Unknown backpressure preset: ${String(presetId)}.`);
  return {
    ...preset,
    config: { ...preset.config },
  };
}
