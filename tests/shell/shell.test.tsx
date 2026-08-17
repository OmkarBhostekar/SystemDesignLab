/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import { AppShell } from "@/components/layout/AppShell";
import { SkipLink } from "@/components/layout/SkipLink";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { CurriculumSidebar } from "@/components/navigation/CurriculumSidebar";
import { LessonNavigation } from "@/components/navigation/LessonNavigation";

const modules = [
  {
    id: "foundations",
    title: "Foundations",
    href: "/learn/foundations",
    lessons: [
      {
        id: "latency",
        title: "Latency and throughput",
        href: "/learn/foundations/latency",
        progress: "in-progress" as const,
        difficulty: "core" as const,
        estimatedMinutes: 20,
      },
      {
        id: "availability",
        title: "Availability",
        href: "/learn/foundations/availability",
        progress: "locked" as const,
      },
    ],
  },
];

describe("reading shell", () => {
  afterEach(() => cleanup());

  it("exposes the skip target and a named primary navigation landmark", () => {
    render(
      <>
        <SkipLink />
        <AppShell>
          <p>Lesson content</p>
        </AppShell>
      </>,
    );

    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
  });

  it("marks the active lesson and keeps locked lessons out of the tab order", () => {
    render(<CurriculumSidebar modules={modules} activeLessonId="latency" />);

    expect(screen.getByRole("link", { name: /Latency and throughput/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Availability").closest("[aria-disabled='true']")).toBeTruthy();
    expect(screen.getByText("Availability").closest("a")).toBeNull();
  });

  it("renders current breadcrumbs and explicit adjacent lesson labels", () => {
    render(
      <>
        <Breadcrumbs
          items={[
            { label: "Learn", href: "/learn" },
            { label: "Foundations", href: "/learn/foundations" },
            { label: "Latency and throughput" },
          ]}
        />
        <LessonNavigation
          previous={{ href: "/learn/foundations/performance", title: "Performance" }}
          next={{ href: "/learn/foundations/availability", title: "Availability" }}
        />
      </>,
    );

    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByText("Latency and throughput")).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Previous lesson: Performance" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next lesson: Availability" })).toBeInTheDocument();
  });
});
