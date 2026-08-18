/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LessonProgressControl, ProgressOverview } from "@/components/progress";
import { InMemoryProgressRepository } from "@/repositories/in-memory-progress-repository";

afterEach(cleanup);

describe("local progress client boundaries", () => {
  it("marks theory complete idempotently and reads it after remount", async () => {
    const repository = new InMemoryProgressRepository();
    const view = render(
      <LessonProgressControl lessonId="04-10-consistent-hashing" repository={repository} />,
    );

    const markButton = await screen.findByRole("button", { name: "Mark theory complete" });
    fireEvent.click(markButton);
    expect(await screen.findByRole("button", { name: "Theory completed" })).toBeDisabled();

    view.unmount();
    render(<LessonProgressControl lessonId="04-10-consistent-hashing" repository={repository} />);
    expect(await screen.findByRole("button", { name: "Theory completed" })).toBeDisabled();
  });

  it("shows a deterministic curriculum summary and continue-learning link", async () => {
    const repository = new InMemoryProgressRepository();
    await repository.applyLessonMilestone("00-01-first", "theory-complete");
    render(
      <ProgressOverview
        repository={repository}
        lessons={[
          { id: "00-01-first", title: "First", href: "/learn/first" },
          { id: "00-02-second", title: "Second", href: "/learn/second" },
        ]}
      />,
    );

    expect(await screen.findByText("1 of 2 lessons marked complete (50%).")).toBeVisible();
    expect(screen.getByRole("link", { name: /Continue with Second/ })).toHaveAttribute(
      "href",
      "/learn/second",
    );
  });

  it("requires reset confirmation and reports the explicit reset scope", async () => {
    const repository = new InMemoryProgressRepository();
    await repository.applyLessonMilestone("00-01-first", "theory-complete");
    render(
      <ProgressOverview
        repository={repository}
        confirmReset={() => true}
        lessons={[{ id: "00-01-first", title: "First", href: "/learn/first" }]}
      />,
    );

    await screen.findByText("1 of 1 lessons marked complete (100%).");
    fireEvent.click(screen.getByRole("button", { name: "Reset progress" }));
    expect(
      await screen.findByText("All lesson progress and quiz attempts were reset. Display preferences were not changed."),
    ).toBeVisible();
    await waitFor(async () => expect(repository.listLessonProgress()).resolves.toEqual([]));
  });
});
