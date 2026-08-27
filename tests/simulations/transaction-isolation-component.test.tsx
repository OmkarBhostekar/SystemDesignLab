/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TransactionIsolationSimulation } from "@/components/simulations/TransactionIsolationSimulation";
import { InMemoryProgressRepository } from "@/repositories/in-memory-progress-repository";

afterEach(() => cleanup());

describe("transaction isolation simulation component", () => {
  it("renders an accessible scheduler graphic and text alternatives", () => {
    render(<TransactionIsolationSimulation repository={new InMemoryProgressRepository()} />);

    expect(screen.getByRole("img", { name: "Transaction isolation scheduler" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Shared table state and committed versions" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Transaction lanes, snapshots, and observations" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Versions, locks, and active waits" })).toBeInTheDocument();
    expect(screen.getByLabelText("Isolation level")).toHaveValue("read-uncommitted");
    expect(screen.getByLabelText("Conflict protection")).toHaveValue("none");
    expect(screen.getByRole("button", { name: "Read T1" })).toBeEnabled();
  });

  it("supports native lane controls, isolation changes, scenario changes, and bounded timeline", () => {
    render(<TransactionIsolationSimulation />);

    fireEvent.change(screen.getByLabelText("Scenario"), { target: { value: "doctor-write-skew" } });
    fireEvent.change(screen.getByLabelText("Isolation level"), { target: { value: "serializable" } });
    fireEvent.click(screen.getByRole("button", { name: "Step" }));
    fireEvent.click(screen.getByRole("button", { name: "Read T2" }));
    fireEvent.click(screen.getByRole("button", { name: "Replay after abort" }));

    expect(screen.getByLabelText("Isolation level")).toHaveValue("serializable");
    expect(screen.getAllByText(/snapshot/).length).toBeGreaterThan(0);
    for (let index = 0; index < 15; index += 1) fireEvent.click(screen.getByRole("button", { name: "Step" }));
    expect(screen.getByText(/^Event timeline \(8\)$/)).toBeInTheDocument();
  });

  it("persists an explicit completion milestone after the authored schedule finishes", async () => {
    const repository = new InMemoryProgressRepository();
    render(
      <TransactionIsolationSimulation
        lessonId="04-05-transaction-isolation"
        repository={repository}
      />,
    );

    for (let index = 0; index < 6; index += 1) fireEvent.click(screen.getByRole("button", { name: "Step" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Mark visualization complete" })).toBeEnabled());
    expect(await repository.listSimulationCompletions()).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Mark visualization complete" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Visualization completed" })).toBeDisabled());
    expect(await repository.listSimulationCompletions()).toEqual([
      expect.objectContaining({
        visualizationId: "transaction-isolation",
        lessonId: "04-05-transaction-isolation",
        scenarioId: "dirty-read",
      }),
    ]);
  });

  it("shows waits and a constraint abort in the seat scenario", () => {
    render(<TransactionIsolationSimulation />);
    fireEvent.change(screen.getByLabelText("Scenario"), { target: { value: "seat-uniqueness" } });
    fireEvent.change(screen.getByLabelText("Conflict protection"), { target: { value: "unique-constraint" } });
    for (let index = 0; index < 8; index += 1) fireEvent.click(screen.getByRole("button", { name: "Step" }));

    expect(screen.getAllByText(/unique constraint/i).length).toBeGreaterThan(0);
    const versions = screen.getByRole("table", { name: "Versions, locks, and active waits" });
    expect(within(versions).getAllByText(/seat-42/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/aborts/i).length).toBeGreaterThan(0);
  });
});
