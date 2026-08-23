/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TailLatencySimulation } from "@/components/simulations/TailLatencySimulation";
import { InMemoryProgressRepository } from "@/repositories/in-memory-progress-repository";

afterEach(() => cleanup());

describe("tail latency simulation component", () => {
  it("renders a histogram, bounded history, and text alternatives with bounded controls", () => {
    const { container } = render(<TailLatencySimulation />);

    expect(screen.getByRole("img", { name: "Latency distribution with percentile markers" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Bounded latency history" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Exact latency and fan-out summary" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /^Parallel fan-out/ })).toHaveValue("1");
    expect(screen.getByText(/Average 70 ms/)).toBeInTheDocument();
    expect(container.querySelector('svg[viewBox="0 0 760 300"]')).toBeInTheDocument();
  });

  it("updates fan-out, shows a slowdown action in text, and persists the checkpoint", async () => {
    const repository = new InMemoryProgressRepository();
    render(<TailLatencySimulation lessonId="01-04-percentiles-tail-latency" repository={repository} />);

    fireEvent.change(screen.getByRole("slider", { name: /^Parallel fan-out/ }), { target: { value: "20" } });
    expect(screen.getByRole("slider", { name: /^Parallel fan-out/ })).toHaveValue("20");
    expect(screen.getByText(/parallel dependencies give a/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Inject slowdown" }));
    expect(screen.getByRole("button", { name: "Recover slowdown" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Step" }));
    const checkpoint = screen.getByRole("button", { name: "Mark visualization complete" });
    await waitFor(() => expect(checkpoint).toBeEnabled());

    fireEvent.click(checkpoint);
    await waitFor(() => expect(screen.getByRole("button", { name: "Visualization completed" })).toBeDisabled());
    expect(await repository.listSimulationCompletions()).toEqual([
      expect.objectContaining({
        visualizationId: "tail-latency",
        lessonId: "01-04-percentiles-tail-latency",
        scenarioId: "average-hides-tail",
      }),
    ]);
  });

  it("keeps the event timeline bounded after repeated deterministic steps", () => {
    render(<TailLatencySimulation />);
    fireEvent.click(screen.getByRole("button", { name: "Inject slowdown" }));
    const step = screen.getByRole("button", { name: "Step" });
    for (let index = 0; index < 20; index += 1) fireEvent.click(step);
    fireEvent.click(screen.getByText(/^Event timeline/));
    const timeline = screen.getByRole("list", { name: "Simulation event timeline" });
    expect(within(timeline).getAllByRole("listitem").length).toBeLessThanOrEqual(8);
  });
});
