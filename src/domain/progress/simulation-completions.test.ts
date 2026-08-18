import { describe, expect, it } from "vitest";

import { ProgressValidationError } from "./errors";
import {
  createSimulationCompletionId,
  normalizeSimulationCompletion,
  normalizeSimulationCompletionId,
  simulationCompletionsEqual,
} from "./simulation-completions";

describe("simulation completions", () => {
  const completion = {
    completionId: "consistent-hash-ring--vnode-ring",
    visualizationId: "consistent-hash-ring",
    lessonId: "04-10-consistent-hashing",
    scenarioId: "vnode-ring",
  };

  it("derives deterministic identities and normalizes cloned records", () => {
    expect(createSimulationCompletionId("consistent-hash-ring", "vnode-ring")).toBe(
      completion.completionId,
    );
    expect(normalizeSimulationCompletionId(completion.completionId)).toBe(
      completion.completionId,
    );
    const normalized = normalizeSimulationCompletion(completion);
    expect(normalized).toEqual(completion);
    expect(normalized).not.toBe(completion);
    expect(simulationCompletionsEqual(completion, { ...completion })).toBe(true);
  });

  it("rejects malformed, partial, extra, or conflicting identities", () => {
    expect(() => normalizeSimulationCompletion(null)).toThrow(ProgressValidationError);
    expect(() => normalizeSimulationCompletion({ ...completion, extra: true })).toThrow(
      /must contain only/,
    );
    expect(() => normalizeSimulationCompletion({
      ...completion,
      completionId: "horizontal-scaling--vnode-ring",
    })).toThrow(/must equal/);
    expect(() => normalizeSimulationCompletionId("not-valid")).toThrow(
      ProgressValidationError,
    );
    expect(() => createSimulationCompletionId("Not valid", "vnode-ring")).toThrow(
      ProgressValidationError,
    );
  });
});
