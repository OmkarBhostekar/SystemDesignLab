/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConsistentHashingSimulation } from "@/components/simulations/ConsistentHashingSimulation";
import { HorizontalScalingSimulation } from "@/components/simulations/HorizontalScalingSimulation";
import { InMemoryProgressRepository } from "@/repositories/in-memory-progress-repository";

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: originalMatchMedia,
  });
});

describe("simulation component boundaries", () => {
  it("renders horizontal scaling with native controls, text alternatives, and a bounded timeline", () => {
    const { container } = render(
      <HorizontalScalingSimulation
        lessonId="01-02-horizontal-vs-vertical-scaling"
        repository={new InMemoryProgressRepository()}
      />,
    );

    const demand = screen.getByRole("slider", { name: /^Demand/ });
    demand.focus();
    expect(document.activeElement).toBe(demand);
    fireEvent.change(demand, { target: { value: "5_000".replace("_", "") } });
    expect(demand).toHaveValue("5000");

    expect(screen.getByRole("img", { name: "Horizontal scaling request fleet" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Replica state and assigned traffic" })).toBeInTheDocument();
    expect(screen.getByText("Capacity after one node failure")).toBeInTheDocument();
    expect(container.querySelector(".simulation-table-wrap")).toBeInTheDocument();

    const step = screen.getByRole("button", { name: "Step" });
    for (let index = 0; index < 12; index += 1) fireEvent.click(step);
    expect(screen.getByText(/^Event timeline \(8\)$/)).toBeInTheDocument();
  });

  it("loads a selected horizontal preset immediately and exposes failure/recovery actions", () => {
    render(<HorizontalScalingSimulation />);

    fireEvent.change(screen.getByLabelText("Scenario"), {
      target: { value: "small-internal-tool" },
    });
    expect(screen.getByRole("slider", { name: /^Demand/ })).toHaveValue("300");

    const table = screen.getByRole("table", { name: "Replica state and assigned traffic" });
    fireEvent.click(screen.getByRole("button", { name: "Fail replica" }));
    expect(within(table).getByText("Failed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Recover replica" }));
    expect(within(table).getByText("Warming")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("slider", { name: /^Demand/ })).toHaveValue("300");
    expect(screen.queryByText("Failed")).not.toBeInTheDocument();
  });

  it("keeps playback keyboard-safe, honors reduced motion, and leaves Step functional", async () => {
    const mediaQuery = {
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => mediaQuery),
    });

    render(<HorizontalScalingSimulation />);
    await waitFor(() => expect(screen.getByText(/Reduced motion is on/, { selector: "p" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(screen.getByText(/Use Step to advance without autoplay/, { selector: "p" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("slider", { name: /^Demand/ }), {
      target: { value: "20_000".replace("_", "") },
    });
    fireEvent.click(screen.getByRole("button", { name: "Step" }));
    expect(screen.getByText(/^Event timeline \([1-9]\d*\)$/)).toBeInTheDocument();
  });

  it("clears autoplay timers on unmount", () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    const { unmount } = render(<HorizontalScalingSimulation />);

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    act(() => {
      vi.advanceTimersByTime(800);
    });
    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(2_400);
      });
    }).not.toThrow();
  });

  it("pauses autoplay when the engine reports completion", () => {
    vi.useFakeTimers();
    render(<HorizontalScalingSimulation />);

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    act(() => {
      vi.advanceTimersByTime(800);
    });
    fireEvent.click(screen.getByRole("button", { name: "Add replica" }));
    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1_600);
    });
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("enables explicit horizontal completion only after the engine completes, then saves the domain record", async () => {
    const repository = new InMemoryProgressRepository();
    render(
      <HorizontalScalingSimulation
        lessonId="01-02-horizontal-vs-vertical-scaling"
        repository={repository}
      />,
    );

    const step = screen.getByRole("button", { name: "Step" });
    const addReplica = screen.getByRole("button", { name: "Add replica" });
    const completion = screen.getByRole("button", { name: "Mark visualization complete" });
    expect(completion).toBeDisabled();

    fireEvent.click(step);
    fireEvent.click(addReplica);
    fireEvent.click(step);

    await waitFor(() => expect(screen.getByRole("button", { name: "Mark visualization complete" })).toBeEnabled());
    expect(screen.getByText(/Scenario complete\. Record the visualization milestone/)).toBeInTheDocument();
    expect(await repository.listSimulationCompletions()).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Mark visualization complete" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Visualization completed" })).toBeDisabled());
    expect(await repository.listSimulationCompletions()).toEqual([
      expect.objectContaining({
        visualizationId: "horizontal-scaling",
        lessonId: "01-02-horizontal-vs-vertical-scaling",
        scenarioId: "stateless-scale-out",
      }),
    ]);
  });

  it("surfaces completion storage failure and keeps retry available", async () => {
    const repository = {
      getSimulationCompletion: vi.fn(async () => null),
      saveSimulationCompletion: vi.fn(async () => {
        throw new Error("storage unavailable");
      }),
    };
    render(
      <HorizontalScalingSimulation
        lessonId="01-02-horizontal-vs-vertical-scaling"
        repository={repository}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Step" }));
    fireEvent.click(screen.getByRole("button", { name: "Add replica" }));
    fireEvent.click(screen.getByRole("button", { name: "Step" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Mark visualization complete" })).toBeEnabled());

    fireEvent.click(screen.getByRole("button", { name: "Mark visualization complete" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("storage unavailable"));
    expect(screen.getByRole("button", { name: "Mark visualization complete" })).toBeEnabled();
    expect(repository.saveSimulationCompletion).toHaveBeenCalledTimes(1);
  });

  it("renders consistent hashing as an accessible ring plus a color-independent ownership table", () => {
    const { container } = render(
      <ConsistentHashingSimulation
        lessonId="04-10-consistent-hashing"
        repository={new InMemoryProgressRepository()}
      />,
    );

    expect(screen.getByRole("img", { name: "Consistent hash ring" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Physical ownership and node status" })).toBeInTheDocument();
    expect(screen.getByText(/tokens, .* replica factor/)).toBeInTheDocument();
    expect(container.querySelector('svg[viewBox="0 0 760 390"]')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Placement strategy"), {
      target: { value: "modulo" },
    });
    expect(screen.getByLabelText("Placement strategy")).toHaveValue("modulo");
    fireEvent.click(screen.getByRole("button", { name: "Add server" }));
    expect(screen.getByRole("button", { name: "Pause rollout" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Fail owner" }));
    expect(screen.getAllByText("Failed").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Recover owner" }));
    expect(screen.getAllByText(/Active|Warming/).length).toBeGreaterThan(0);
  });

  it("supports consistent-hashing failure observation, reset, and explicit completion persistence", async () => {
    const repository = new InMemoryProgressRepository();
    render(
      <ConsistentHashingSimulation
        lessonId="04-10-consistent-hashing"
        repository={repository}
      />,
    );

    fireEvent.change(screen.getByLabelText("Scenario"), {
      target: { value: "node-failure-migration" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Fail owner" }));
    fireEvent.click(screen.getByRole("button", { name: "Step" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Mark visualization complete" })).toBeEnabled());
    expect(await repository.listSimulationCompletions()).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("button", { name: "Mark visualization complete" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Fail owner" }));
    fireEvent.click(screen.getByRole("button", { name: "Step" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Mark visualization complete" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Mark visualization complete" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Visualization completed" })).toBeDisabled());

    expect(await repository.listSimulationCompletions()).toEqual([
      expect.objectContaining({
        visualizationId: "consistent-hash-ring",
        lessonId: "04-10-consistent-hashing",
        scenarioId: "node-failure-migration",
      }),
    ]);
  });

  it("keeps the event timeline text bounded for a hash-ring rollout", () => {
    render(<ConsistentHashingSimulation />);
    const step = screen.getByRole("button", { name: "Step" });
    for (let index = 0; index < 14; index += 1) fireEvent.click(step);
    fireEvent.click(screen.getByText(/^Event timeline/));
    const timeline = screen.getByRole("list", { name: "Simulation event timeline" });
    expect(within(timeline).getAllByRole("listitem").length).toBeLessThanOrEqual(8);
  });
});
