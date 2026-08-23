import type {
  CacheStampedeConfig,
  CacheStampedeMitigation,
  CacheStampedePresetDefinition,
  CacheStampedePresetId,
} from "./types";

const BASE_CONFIG: CacheStampedeConfig = {
  arrivalRatePerSecond: 1_200,
  burstReaders: 120,
  loaderLatencyMs: 250,
  ttlMs: 1_000,
  ttlJitterMs: 0,
  processCount: 4,
  lockLeaseMs: 500,
  waiterTimeoutMs: 500,
  staleGraceMs: 2_000,
};

export const CACHE_STAMPEDE_PRESETS = [
  {
    id: "synchronized-expiry",
    label: "Synchronized expiry",
    description: "A hot key expires for everyone together: the naive path fans one miss into a reader burst of source calls.",
    config: { ...BASE_CONFIG, ttlMs: 1_000, ttlJitterMs: 0, staleGraceMs: 1_500 },
    mitigation: "none",
    initialCache: "cold",
  },
  {
    id: "cold-start-burst",
    label: "Cold-start burst",
    description: "A restart leaves the key cold while a large reader cohort arrives before the source can fill it.",
    config: {
      ...BASE_CONFIG,
      arrivalRatePerSecond: 2_000,
      burstReaders: 300,
      loaderLatencyMs: 450,
      ttlMs: 2_500,
      staleGraceMs: 1_000,
    },
    mitigation: "distributed-lock",
    initialCache: "cold",
  },
  {
    id: "failure-and-stale",
    label: "Source failure + stale grace",
    description: "Serve a bounded stale value while one refresh fails; availability improves, freshness budget is spent.",
    config: {
      ...BASE_CONFIG,
      arrivalRatePerSecond: 1_500,
      burstReaders: 80,
      loaderLatencyMs: 300,
      ttlMs: 800,
      lockLeaseMs: 600,
      staleGraceMs: 2_500,
    },
    mitigation: "stale-while-revalidate",
    initialCache: "warm",
    sourceFailed: false,
  },
] as const satisfies readonly CacheStampedePresetDefinition[];

export const CACHE_STAMPEDE_PRESET_BY_ID: ReadonlyMap<
  CacheStampedePresetId,
  CacheStampedePresetDefinition
> = new Map(CACHE_STAMPEDE_PRESETS.map((preset) => [preset.id, preset]));

export function getCacheStampedePreset(
  presetId: CacheStampedePresetId,
): CacheStampedePresetDefinition {
  const preset = CACHE_STAMPEDE_PRESET_BY_ID.get(presetId);
  if (!preset) throw new Error(`Unknown cache-stampede preset: ${String(presetId)}.`);
  return {
    ...preset,
    config: { ...preset.config },
    mitigation: preset.mitigation as CacheStampedeMitigation,
  };
}
