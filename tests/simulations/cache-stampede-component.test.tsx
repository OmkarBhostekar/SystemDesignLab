/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CacheStampedeSimulation } from "@/components/simulations/CacheStampedeSimulation";
import { InMemoryProgressRepository } from "@/repositories/in-memory-progress-repository";

afterEach(() => cleanup());

describe("cache stampede simulation component", () => {
  it("renders an accessible control room with exact SVG/table alternatives", () => {
    const { container } = render(<CacheStampedeSimulation />);

    expect(screen.getByRole("img", { name: "Cache stampede control room" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Exact cache stampede metrics" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Mitigation comparison" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /^Reader arrival rate/ })).toHaveValue("1200");
    expect(screen.getByRole("combobox", { name: "Mitigation" })).toHaveValue("none");
    expect(container.querySelector('svg[viewBox="0 0 760 390"]')).toBeInTheDocument();
  });

  it("changes mitigation, injects source failure, and keeps the event timeline bounded", () => {
    render(<CacheStampedeSimulation />);

    fireEvent.change(screen.getByRole("combobox", { name: "Mitigation" }), { target: { value: "stale-while-revalidate" } });
    expect(screen.getByRole("combobox", { name: "Mitigation" })).toHaveValue("stale-while-revalidate");
    fireEvent.click(screen.getByRole("button", { name: "Inject source failure" }));
    expect(screen.getByRole("button", { name: "Recover source" })).toBeInTheDocument();
    const step = screen.getByRole("button", { name: "Step" });
    for (let index = 0; index < 20; index += 1) fireEvent.click(step);
    fireEvent.click(screen.getByText(/^Event timeline/));
    const timeline = screen.getByRole("list", { name: "Simulation event timeline" });
    expect(within(timeline).getAllByRole("listitem").length).toBeLessThanOrEqual(8);
  });

  it("persists completion after a mitigation is applied and its behavior is observed", async () => {
    const repository = new InMemoryProgressRepository();
    render(
      <CacheStampedeSimulation
        lessonId="05-07-cache-stampede"
        repository={repository}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Mitigation" }), {
      target: { value: "jitter" },
    });
    const step = screen.getByRole("button", { name: "Step" });
    for (let index = 0; index < 40; index += 1) fireEvent.click(step);
    const checkpoint = screen.getByRole("button", { name: "Mark visualization complete" });
    await waitFor(() => expect(checkpoint).toBeEnabled());
    fireEvent.click(checkpoint);
    await waitFor(() => expect(screen.getByRole("button", { name: "Visualization completed" })).toBeDisabled());
    expect(await repository.listSimulationCompletions()).toEqual([
      expect.objectContaining({
        visualizationId: "cache-stampede",
        lessonId: "05-07-cache-stampede",
        scenarioId: "synchronized-expiry",
      }),
    ]);
  });
});
