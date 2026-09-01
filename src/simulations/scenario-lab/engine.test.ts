import { describe, expect, it } from "vitest";

import {
  SCENARIO_LABS,
  SCENARIO_LAB_IDS,
  createScenarioLabState,
  currentScenarioLabFrame,
  transitionScenarioLab,
} from ".";

describe("scenario lab engine", () => {
  it("defines two complete deterministic scenarios for every selected lab", () => {
    expect(SCENARIO_LABS.map((lab) => lab.id)).toEqual(SCENARIO_LAB_IDS);
    for (const lab of SCENARIO_LABS) {
      expect(lab.nodes).toHaveLength(4);
      expect(lab.presets).toHaveLength(2);
      for (const preset of lab.presets) {
        expect(preset.frames).toHaveLength(4);
        for (const frame of preset.frames) {
          expect(Object.keys(frame.nodeTones)).toHaveLength(lab.nodes.length);
          expect(frame.links).toHaveLength(lab.nodes.length - 1);
          expect(frame.metrics).toHaveLength(3);
        }
      }
    }
  });

  it("steps to a bounded completion and never advances past the final frame", () => {
    for (const labId of SCENARIO_LAB_IDS) {
      let state = createScenarioLabState(labId);
      for (let index = 0; index < 10; index += 1) {
        state = transitionScenarioLab(state, { type: "step" }).state;
      }
      expect(state.completed).toBe(true);
      expect(state.frameIndex).toBe(3);
      expect(state.events).toHaveLength(3);
      expect(currentScenarioLabFrame(state).event.type).toBe("outcome");
    }
  });

  it("resets the selected preset exactly", () => {
    const initial = createScenarioLabState("distributed-locks", "fenced");
    const stepped = transitionScenarioLab(initial, { type: "step" }).state;
    const reset = transitionScenarioLab(stepped, { type: "reset" }).state;
    expect(reset).toEqual(initial);
  });
});
