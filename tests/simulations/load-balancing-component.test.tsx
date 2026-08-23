/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LoadBalancingSimulation } from "@/components/simulations/LoadBalancingSimulation";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("load-balancing simulation component", () => {
  it("renders an accessible diagram, exact node table, and same-trace comparison", () => {
    render(<LoadBalancingSimulation />);

    expect(screen.getByRole("img", { name: "Load-balancing policy routing the request trace" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Per-node assignments and work for the selected policy" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Same-trace policy comparison" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Step" }));
    expect(screen.getByText(/12\/120/)).toBeInTheDocument();
    expect(screen.getByText(/Requests 1–12 replayed/)).toBeInTheDocument();
  });

  it("switches policy and scenario, then exposes failure and recovery in text", () => {
    render(<LoadBalancingSimulation />);

    fireEvent.change(screen.getByLabelText("Balancing policy"), { target: { value: "key-hash" } });
    expect(screen.getByLabelText("Balancing policy")).toHaveValue("key-hash");
    fireEvent.change(screen.getByLabelText("Scenario"), { target: { value: "celebrity-cache-key" } });
    expect(screen.getByLabelText("Scenario")).toHaveValue("celebrity-cache-key");

    const table = screen.getByRole("table", { name: "Per-node assignments and work for the selected policy" });
    fireEvent.click(screen.getByRole("button", { name: "Fail node" }));
    expect(within(table).getByText("Failed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Recover node" }));
    expect(within(table).getAllByText("Active").length).toBeGreaterThan(0);
  });
});
