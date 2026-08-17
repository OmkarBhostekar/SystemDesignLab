import { cache } from "react";

import {
  getNextLesson,
  getPreviousLesson,
  loadContentIndex,
  loadLessonSource,
  resolveModule,
} from "@/content/pipeline";
import type { ContentIndex, LessonRecord, ModuleRecord } from "@/content/types";

import {
  findLesson,
  routeModuleGroups,
  toLessonSummary,
  type RouteLesson,
  type RouteModule,
} from "./route-helpers";

/**
 * Content is authored on disk and indexed deterministically at build time.
 * React's request/build cache prevents each route segment from reparsing the
 * same 29 records while preserving a synchronous, testable loader contract.
 */
export const getReaderIndex = cache((): ContentIndex => loadContentIndex());

export function getReaderModules(index: ContentIndex = getReaderIndex()): RouteModule[] {
  return routeModuleGroups(index.modules.map(asRouteModule));
}

export function getReaderLessons(index: ContentIndex = getReaderIndex()): RouteLesson[] {
  return index.lessons.map(asRouteLesson);
}

export function getReaderNavigation(index: ContentIndex = getReaderIndex()) {
  return getReaderModules(index);
}

export function getReaderLesson(
  moduleId: string,
  slug: string,
  index: ContentIndex = getReaderIndex(),
): { module: RouteModule; lesson: RouteLesson; source: string } | null {
  const moduleRecord = resolveModule(index, moduleId);
  const routeLesson = moduleRecord
    ? findLesson([asRouteModule(moduleRecord)], moduleId, slug)
    : undefined;
  const lessonRecord = routeLesson ? index.lessonById[routeLesson.id] : undefined;
  if (!moduleRecord || !lessonRecord) return null;
  return {
    module: asRouteModule(moduleRecord),
    lesson: asRouteLesson(lessonRecord),
    source: loadLessonSource(lessonRecord).body,
  };
}

export function getLessonById(id: string, index: ContentIndex = getReaderIndex()): RouteLesson | undefined {
  const record = index.lessonById[id];
  return record ? asRouteLesson(record) : undefined;
}

export function getPrerequisiteLessons(
  lesson: Pick<RouteLesson, "prerequisites">,
  index: ContentIndex = getReaderIndex(),
): RouteLesson[] {
  return (lesson.prerequisites ?? [])
    .map((id) => index.lessonById[id])
    .filter((record): record is LessonRecord => Boolean(record))
    .map(asRouteLesson);
}

export function getAdjacentLessons(
  lesson: Pick<LessonRecord, "id" | "module" | "order">,
  index: ContentIndex = getReaderIndex(),
): { previous?: RouteLesson; next?: RouteLesson } {
  const previous = getPreviousLesson(index, lesson);
  const next = getNextLesson(index, lesson);
  return {
    previous: previous ? asRouteLesson(previous) : undefined,
    next: next ? asRouteLesson(next) : undefined,
  };
}

export function getModuleRecord(moduleId: string, index: ContentIndex = getReaderIndex()): ModuleRecord | undefined {
  return resolveModule(index, moduleId);
}

function asRouteModule(module: ModuleRecord): RouteModule {
  return {
    id: module.id,
    directory: module.directory,
    title: module.title,
    order: module.order,
    lessons: module.lessons.map(asRouteLesson),
  };
}

function asRouteLesson(lesson: LessonRecord): RouteLesson {
  return {
    ...toLessonSummary(lesson),
    aliases: lesson.aliases,
    sourcePath: lesson.sourcePath,
    relativeSourcePath: lesson.relativeSourcePath,
    route: lesson.route,
  };
}
