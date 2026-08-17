import type { BreadcrumbItem } from "@/components/navigation/types";
import type { LessonSummary } from "@/components/lesson/lesson-types";

/** Canonical module order and display names are derived from the theory tree. */
export const MODULE_LABELS: Readonly<Record<string, string>> = {
  "interview-method": "Interview method",
  foundations: "Foundations",
  networking: "Networking",
  "traffic-and-services": "Traffic and services",
  databases: "Databases",
  caching: "Caching",
  messaging: "Messaging",
  "distributed-coordination": "Distributed coordination",
  reliability: "Reliability",
  observability: "Observability",
  security: "Security",
  "building-blocks": "Building blocks",
  "architecture-archetypes": "Architecture archetypes",
  "design-labs": "Design labs",
};

export type RouteLesson = Pick<
  LessonSummary,
  "id" | "slug" | "title" | "module" | "order" | "estimatedMinutes" | "description"
> &
  Partial<Pick<LessonSummary, "difficulty" | "prerequisites" | "tags" | "objectives" | "visualizationId" | "quizId">> & {
    aliases?: string[];
    sourcePath?: string;
    relativeSourcePath?: string;
    route?: string;
  };

export type RouteModule = {
  id: string;
  directory?: string;
  title?: string;
  description?: string;
  order?: number;
  lessons: readonly RouteLesson[];
};

export function moduleTitle(id: string, fallback?: string): string {
  return fallback ?? MODULE_LABELS[id] ?? id
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function moduleRoute(module: string): string {
  return `/learn/${encodeURIComponent(module)}`;
}

export function moduleNumber(module: Pick<RouteModule, "directory" | "order">): string {
  const directoryNumber = module.directory?.match(/^(\d{2})-/)?.[1];
  return directoryNumber ?? String(module.order ?? 0).padStart(2, "0");
}

export function lessonRoute(module: string, slug: string): string {
  return `${moduleRoute(module)}/${encodeURIComponent(slug)}`;
}

export function routeForLesson(lesson: Pick<RouteLesson, "module" | "slug">): string {
  return lessonRoute(lesson.module, lesson.slug);
}

export function sortLessons<T extends Pick<RouteLesson, "order" | "title">>(lessons: readonly T[]): T[] {
  return [...lessons].sort((left, right) => left.order - right.order || left.title.localeCompare(right.title));
}

export function sortModules<T extends Pick<RouteModule, "id" | "order">>(modules: readonly T[]): T[] {
  return [...modules].sort((left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER) || left.id.localeCompare(right.id));
}

export function routeModuleGroups(modules: readonly RouteModule[]): RouteModule[] {
  return sortModules(modules).map((module) => ({
    ...module,
    title: moduleTitle(module.id, module.title),
    lessons: sortLessons(module.lessons),
  }));
}

export function findModule(modules: readonly RouteModule[], moduleId: string): RouteModule | undefined {
  return modules.find((module) => module.id === moduleId);
}

export function findLesson(
  modules: readonly RouteModule[],
  moduleId: string,
  lessonSlug: string,
): RouteLesson | undefined {
  const moduleRecord = findModule(modules, moduleId);
  return moduleRecord?.lessons.find(
    (lesson) => lesson.slug === lessonSlug || lesson.aliases?.includes(lessonSlug),
  );
}

export function lessonNeighbors(module: RouteModule, lesson: RouteLesson): {
  previous?: RouteLesson;
  next?: RouteLesson;
} {
  const lessons = sortLessons(module.lessons);
  const index = lessons.findIndex((candidate) => candidate.id === lesson.id);
  return {
    previous: index > 0 ? lessons[index - 1] : undefined,
    next: index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : undefined,
  };
}

export function breadcrumbsForModule(module: Pick<RouteModule, "id" | "title">): BreadcrumbItem[] {
  return [
    { label: "Learn", href: "/learn" },
    { label: moduleTitle(module.id, module.title), href: moduleRoute(module.id), current: true },
  ];
}

export function breadcrumbsForLesson(
  module: Pick<RouteModule, "id" | "title">,
  lesson: Pick<RouteLesson, "title">,
): BreadcrumbItem[] {
  return [
    { label: "Learn", href: "/learn" },
    { label: moduleTitle(module.id, module.title), href: moduleRoute(module.id) },
    { label: lesson.title, current: true },
  ];
}

export type NavigationModule = {
  id: string;
  title: string;
  href: string;
  description?: string;
  lessons: Array<{
    id: string;
    title: string;
    href: string;
    description: string;
    difficulty: RouteLesson["difficulty"];
    estimatedMinutes: number;
    order: number;
  }>;
};

/** Adapt content-index records to Agent 2's generic navigation contract. */
export function toNavigationModules(modules: readonly RouteModule[]): NavigationModule[] {
  return routeModuleGroups(modules).map((module) => ({
    id: module.id,
    title: moduleTitle(module.id, module.title),
    href: moduleRoute(module.id),
    description: module.description,
    lessons: sortLessons(module.lessons).map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      href: lessonRoute(lesson.module, lesson.slug),
      description: lesson.description,
      difficulty: lesson.difficulty,
      estimatedMinutes: lesson.estimatedMinutes,
      order: lesson.order,
    })),
  }));
}

export function toLessonSummary(lesson: RouteLesson): LessonSummary {
  return {
    id: lesson.id,
    slug: lesson.slug,
    title: lesson.title,
    description: lesson.description,
    module: lesson.module,
    order: lesson.order,
    difficulty: lesson.difficulty ?? "core",
    estimatedMinutes: lesson.estimatedMinutes,
    prerequisites: lesson.prerequisites ?? [],
    tags: lesson.tags ?? [],
    objectives: lesson.objectives,
    visualizationId: lesson.visualizationId,
    quizId: lesson.quizId,
    aliases: lesson.aliases,
    sourcePath: lesson.sourcePath ?? lesson.relativeSourcePath,
  };
}

export type ResolvedRoute = {
  module: RouteModule;
  lesson?: RouteLesson;
};

export function resolveModuleRoute(modules: readonly RouteModule[], moduleId: string): ResolvedRoute | null {
  const moduleRecord = findModule(modules, moduleId);
  return moduleRecord ? { module: moduleRecord } : null;
}

export function resolveLessonRoute(
  modules: readonly RouteModule[],
  moduleId: string,
  lessonSlug: string,
): ResolvedRoute | null {
  const moduleRecord = findModule(modules, moduleId);
  const lesson = moduleRecord ? findLesson(modules, moduleId, lessonSlug) : undefined;
  return moduleRecord && lesson ? { module: moduleRecord, lesson } : null;
}
