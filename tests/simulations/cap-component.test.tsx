/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CapSimulation } from "@/components/simulations/CapSimulation";
import { InMemoryProgressRepository } from "@/repositories/in-memory-progress-repository";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CAP simulation component", () => {
  it("renders an accessible partition graphic, replica table, and operation table", () => {
    render(<CapSimulation repository={new InMemoryProgressRepository()} />);

    expect(screen.getByRole("img", { name: /Three-replica CAP partition diagram/ })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Replica state and partition visibility" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Recent acknowledged operations and responses" })).toBeInTheDocument();
    expect(screen.getByLabelText("Partition-time write policy")).toHaveValue("reject-writes");
    expect(screen.getByRole("button", { name: "Partition network" })).toBeEnabled();
  });

  it("exposes both-side AP operations, stale reads, healing, and repair with native controls", () => {
    render(<CapSimulation repository={new InMemoryProgressRepository()} />);

    fireEvent.change(screen.getByLabelText("Scenario"), { target: { value: "profile-edits" } });
    fireEvent.change(screen.getByLabelText("Partition-time write policy"), { target: { value: "accept-both" } });
    fireEvent.click(screen.getByRole("button", { name: "Partition network" }));
    fireEvent.click(screen.getByRole("button", { name: "Write on left side" }));
    fireEvent.click(screen.getByRole("button", { name: "Write on right side" }));
    fireEvent.click(screen.getByRole("button", { name: "Read on left side" }));

    expect(screen.getByText("Concurrent conflict detected")).toBeInTheDocument();
    expect(screen.getByText("Stale reads")).toBeInTheDocument();
    expect(screen.getByText("Linearizability violations")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Heal network" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Heal network" }));
    fireEvent.click(screen.getByRole("button", { name: "Repair & converge" }));
    expect(screen.getByText("Converged")).toBeInTheDocument();
    const operations = screen.getByRole("table", { name: "Recent acknowledged operations and responses" });
    expect(within(operations).getAllByText("Acknowledged").length).toBeGreaterThan(0);
  });
});
