/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ScenarioLabSimulation } from "@/components/simulations/ScenarioLabSimulation";
import { InMemoryProgressRepository } from "@/repositories/in-memory-progress-repository";
import { SCENARIO_LABS } from "@/simulations/scenario-lab";

afterEach(() => cleanup());

describe("scenario lab component contract", () => {
  it.each(SCENARIO_LABS)(
    "$id supports scenario switching, step, reset, completion, and persistence",
    async (lab) => {
      const repository = new InMemoryProgressRepository();
      const lessonId = `test-${lab.id}`;
      const { container } = render(
        <ScenarioLabSimulation
          labId={lab.id}
          lessonId={lessonId}
          repository={repository}
        />,
      );
      const scenario = screen.getByRole("combobox", { name: "Scenario" });
      const step = screen.getByRole("button", { name: "Step" });
      const reset = screen.getByRole("button", { name: "Reset" });
      const summary = () => container.querySelector(".simulation-shell__summary");

      expect(scenario).toHaveValue(lab.presets[0]!.id);
      expect(summary()).toHaveTextContent("Step 1 of 4");

      fireEvent.click(step);
      expect(summary()).toHaveTextContent("Step 2 of 4");
      expect(screen.getByText("Event timeline (1)")).toBeInTheDocument();

      fireEvent.click(reset);
      expect(summary()).toHaveTextContent("Step 1 of 4");
      expect(screen.getByText("Event timeline (0)")).toBeInTheDocument();

      const alternate = lab.presets[1]!;
      fireEvent.change(scenario, { target: { value: alternate.id } });
      expect(scenario).toHaveValue(alternate.id);
      expect(summary()).toHaveTextContent(`Step 1 of 4: ${alternate.frames[0]!.title}`);

      for (let index = 0; index < 3; index += 1) fireEvent.click(step);
      expect(summary()).toHaveTextContent(`Step 4 of 4: ${alternate.frames[3]!.title}`);
      const checkpoint = screen.getByRole("button", { name: "Mark visualization complete" });
      expect(checkpoint).toBeEnabled();
      fireEvent.click(checkpoint);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Visualization completed" })).toBeDisabled();
      });
      expect(await repository.listSimulationCompletions()).toEqual([
        expect.objectContaining({
          visualizationId: lab.id,
          lessonId,
          scenarioId: alternate.id,
        }),
      ]);
    },
  );
});
