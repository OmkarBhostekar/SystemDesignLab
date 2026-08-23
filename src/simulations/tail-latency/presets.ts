import type { TailLatencyPresetDefinition, TailLatencyPresetId } from "./types";

const BASE_MITIGATIONS = {
  hedgingEnabled: false,
  timeoutEnabled: false,
  timeoutMs: 350,
  gracefulDegradationEnabled: false,
  correlatedSlowdownEnabled: false,
} as const;

/**
 * Authored scenarios keep the lesson's main claims reproducible. In
 * particular, 98 fast observations at 53.1 ms and two 900 ms observations
 * produce an average near 70 ms and p99 of 900 ms with the nearest-rank
 * percentile definition used by the engine. The extra observation makes the
 * p99 marker unambiguous in a deliberately small 100-request teaching window.
 */
export const TAIL_LATENCY_PRESETS = [
  {
    id: "average-hides-tail",
    label: "Average hides the tail",
    description: "An average near 70 ms still leaves one in 100 requests near 900 ms.",
    config: {
      averageServiceMs: 53.1,
      slowRequestProbability: 0.02,
      slowRequestLatencyMs: 900,
      fanOutCount: 1,
      queueUtilization: 0,
      sampleWindow: 100,
    },
    mitigations: { ...BASE_MITIGATIONS },
  },
  {
    id: "fan-out-amplification",
    label: "20-way fan-out",
    description: "Parallel dependencies make at least one slow call much more likely.",
    config: {
      averageServiceMs: 40,
      slowRequestProbability: 0.01,
      slowRequestLatencyMs: 300,
      fanOutCount: 20,
      queueUtilization: 0.15,
      sampleWindow: 200,
    },
    mitigations: { ...BASE_MITIGATIONS },
  },
  {
    id: "queue-and-mitigation",
    label: "Queue, timeout, and degradation",
    description: "High utilization stretches the tail; deadlines and partial results trade completeness for responsiveness.",
    config: {
      averageServiceMs: 55,
      slowRequestProbability: 0.02,
      slowRequestLatencyMs: 800,
      fanOutCount: 8,
      queueUtilization: 0.72,
      sampleWindow: 200,
    },
    mitigations: {
      ...BASE_MITIGATIONS,
      timeoutEnabled: true,
      timeoutMs: 350,
      gracefulDegradationEnabled: true,
    },
  },
] as const satisfies readonly TailLatencyPresetDefinition[];

export const TAIL_LATENCY_PRESET_BY_ID: ReadonlyMap<
  TailLatencyPresetId,
  TailLatencyPresetDefinition
> = new Map(TAIL_LATENCY_PRESETS.map((preset) => [preset.id, preset]));

export function getTailLatencyPreset(
  presetId: TailLatencyPresetId,
): TailLatencyPresetDefinition {
  const preset = TAIL_LATENCY_PRESET_BY_ID.get(presetId);
  if (!preset) throw new Error(`Unknown tail-latency preset: ${String(presetId)}.`);
  return {
    ...preset,
    config: { ...preset.config },
    mitigations: { ...preset.mitigations },
  };
}
