import { describe, expect, it } from "vitest";

import {
  breadcrumbsForLesson,
  findLesson,
  lessonNeighbors,
  lessonRoute,
  moduleRoute,
  resolveLessonRoute,
  resolveModuleRoute,
  routeModuleGroups,
  toNavigationModules,
  type RouteModule,
} from "@/app/learn/route-helpers";

const modules: RouteModule[] = [
  {
    id: "traffic-and-services",
    order: 3,
    lessons: [
      {
        id: "03-02-load-balancing",
        slug: "load-balancing",
        title: "Load Balancing",
        description: "Distribute work.",
        module: "traffic-and-services",
        order: 2,
        estimatedMinutes: 20,
      },
      {
        id: "03-01-front-door",
        slug: "front-door",
        title: "The Front Door",
        description: "Mediate traffic.",
        module: "traffic-and-services",
        order: 1,
        estimatedMinutes: 20,
      },
    ],
  },
  {
    id: "interview-method",
    order: 0,
    lessons: [
      {
        id: "00-01-signals",
        slug: "signals",
        title: "Signals",
        description: "Read the interview.",
        module: "interview-method",
        order: 1,
        estimatedMinutes: 20,
      },
    ],
  },
  {
    id: "networking",
    order: 2,
    lessons: [],
  },
  {
    id: "foundations",
    order: 1,
    lessons: [],
  },
];

describe("lesson route helpers", () => {
  it("keeps the four completed modules in curriculum order", () => {
    expect(routeModuleGroups(modules).map((module) => module.id)).toEqual([
      "interview-method",
      "foundations",
      "networking",
      "traffic-and-services",
    ]);
  });

  it("builds canonical module and lesson routes", () => {
    expect(moduleRoute("traffic-and-services")).toBe("/learn/traffic-and-services");
    expect(lessonRoute("traffic-and-services", "front-door")).toBe(
      "/learn/traffic-and-services/front-door",
    );
  });

  it("resolves lessons and previous/next links after order sorting", () => {
    const resolved = resolveLessonRoute(modules, "traffic-and-services", "load-balancing");
    expect(resolved?.lesson?.id).toBe("03-02-load-balancing");
    expect(lessonNeighbors(modules[0], resolved!.lesson!).previous?.slug).toBe("front-door");
    expect(lessonNeighbors(modules[0], resolved!.lesson!).next).toBeUndefined();
    expect(findLesson(modules, "traffic-and-services", "missing")).toBeUndefined();
  });

  it("returns null for missing module and lesson routes", () => {
    expect(resolveModuleRoute(modules, "not-a-module")).toBeNull();
    expect(resolveLessonRoute(modules, "traffic-and-services", "not-a-lesson")).toBeNull();
  });

  it("maps route groups to the generic sidebar shape", () => {
    const navigation = toNavigationModules(modules);
    expect(navigation).toHaveLength(4);
    expect(navigation[0].lessons[0].href).toBe("/learn/interview-method/signals");
    expect(navigation[3].lessons.map((lesson) => lesson.href)).toEqual([
      "/learn/traffic-and-services/front-door",
      "/learn/traffic-and-services/load-balancing",
    ]);
  });

  it("creates breadcrumbs without duplicating lesson prose", () => {
    expect(breadcrumbsForLesson(modules[0], { title: "Load Balancing" })).toEqual([
      { label: "Learn", href: "/learn" },
      { label: "Traffic and services", href: "/learn/traffic-and-services" },
      { label: "Load Balancing", current: true },
    ]);
  });
});
