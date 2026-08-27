/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BackpressureSimulation } from "@/components/simulations/BackpressureSimulation";
import { InMemoryProgressRepository } from "@/repositories/in-memory-progress-repository";

afterEach(() => cleanup());

describe("backpressure simulation component", () => {
  it("renders the flow diagram, exact text alternative, and native controls", () => {
    const { container } = render(<BackpressureSimulation />);

    expect(screen.getByRole("img", { name: "Queue and backpressure flow" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Exact queue and backpressure metrics" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /^Arrival rate/ })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /^Service rate per consumer/ })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Admission / shedding" })).toBeInTheDocument();
    expect(container.querySelector('svg[viewBox="0 0 960 360"]')).toBeInTheDocument();
    expect(screen.getByText(/queue depth history/i)).toBeInTheDocument();
  });

  it("exposes outage, retry, and recovery in text while persisting completion", async () => {
    const repository = new InMemoryProgressRepository();
    render(<BackpressureSimulation lessonId="06-09-backpressure" repository={repository} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Admission / shedding" }), {
      target: { value: "shed-low-priority" },
    });
    fireEvent.change(screen.getByRole("slider", { name: /^Arrival rate/ }), { target: { value: "24" } });
    fireEvent.click(screen.getByRole("button", { name: "Inject outage" }));
    expect(screen.getByRole("button", { name: "Recover outage" })).toBeInTheDocument();

    const step = screen.getByRole("button", { name: "Step" });
    for (let index = 0; index < 6; index += 1) fireEvent.click(step);
    expect(screen.getAllByText(/outage|dependency is unavailable/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Retries/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Recover outage" }));
    for (let index = 0; index < 6; index += 1) fireEvent.click(step);
    const checkpoint = screen.getByRole("button", { name: "Mark visualization complete" });
    await waitFor(() => expect(checkpoint).toBeEnabled());
    fireEvent.click(checkpoint);
    await waitFor(() => expect(screen.getByRole("button", { name: "Visualization completed" })).toBeDisabled());
    expect(await repository.listSimulationCompletions()).toEqual([
      expect.objectContaining({
        visualizationId: "backpressure",
        lessonId: "06-09-backpressure",
        scenarioId: "steady-capacity",
      }),
    ]);
  });

  it("keeps the event timeline bounded after repeated deterministic steps", () => {
    render(<BackpressureSimulation />);
    const step = screen.getByRole("button", { name: "Step" });
    for (let index = 0; index < 40; index += 1) fireEvent.click(step);
    fireEvent.click(screen.getByText(/^Event timeline/));
    const timeline = screen.getByRole("list", { name: "Simulation event timeline" });
    expect(within(timeline).getAllByRole("listitem").length).toBeLessThanOrEqual(8);
  });
});
