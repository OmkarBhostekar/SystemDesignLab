import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReadingFrame } from "@/components/layout/AppShell";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { CurriculumSidebar } from "@/components/navigation/CurriculumSidebar";
import { LessonNavigation as GenericLessonNavigation } from "@/components/navigation/LessonNavigation";
import type { LessonNavigationItem } from "@/components/navigation/types";
import { LessonMetadata, LessonStepper, TheoryOnlyState } from "@/components/lesson";
import { MdxContent } from "@/components/mdx";
import { LessonProgressControl } from "@/components/progress";

import {
  getAdjacentLessons,
  getPrerequisiteLessons,
  getReaderIndex,
  getReaderLesson,
  getReaderModules,
} from "../../content";
import {
  breadcrumbsForLesson,
  lessonRoute,
  moduleTitle,
  moduleRoute,
  toLessonSummary,
} from "../../route-helpers";

type LessonPageProps = {
  params: Promise<{ module: string; lesson: string }>;
};

export const dynamic = "force-static";

export function generateStaticParams() {
  return getReaderModules().flatMap((module) =>
    module.lessons.flatMap((lesson) =>
      [lesson.slug, ...(lesson.aliases ?? [])].map((lessonSlug) => ({ module: module.id, lesson: lessonSlug })),
    ),
  );
}

export async function generateMetadata({ params }: LessonPageProps): Promise<Metadata> {
  const { module: moduleId, lesson: slug } = await params;
  const resolved = getReaderLesson(moduleId, slug);
  return resolved
    ? { title: resolved.lesson.title, description: resolved.lesson.description }
    : { title: "Lesson not found" };
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { module: moduleId, lesson: slug } = await params;
  const index = getReaderIndex();
  const resolved = getReaderLesson(moduleId, slug, index);
  if (!resolved) notFound();

  const { module: moduleRecord, lesson, source } = resolved;
  const sourceRecord = index.lessonById[lesson.id];
  const summary = toLessonSummary(lesson);
  const prerequisites = getPrerequisiteLessons(lesson, index);
  const adjacent = getAdjacentLessons(sourceRecord, index);
  const navigation = getReaderModules(index).map(toSidebarModule);
  const lessonSummaries = index.lessons.map(toLessonSummary);

  // Registries are intentionally not part of this milestone. A future route
  // can pass true here once it has a real enhancement without changing MDX or
  // lesson composition.
  const visualizationAvailable = false;
  const quizAvailable = false;

  return (
    <ReadingFrame
      className="lesson-page"
      sidebar={<CurriculumSidebar modules={navigation} activeLessonId={lesson.id} activeModuleId={moduleRecord.id} />}
      breadcrumbs={<Breadcrumbs items={breadcrumbsForLesson(moduleRecord, lesson)} />}
      rail={<LessonRail lesson={summary} prerequisites={prerequisites} />}
    >
      <article className="lesson-article">
        <header className="lesson-article__header">
          <p className="eyebrow">{moduleRecord.title}</p>
          <h1>{lesson.title}</h1>
          <p className="lesson-article__description">{lesson.description}</p>
          <LessonMetadata lesson={summary} />
          <LessonStepper
            visualizationAvailable={visualizationAvailable}
            quizAvailable={quizAvailable}
          />
          <LessonProgressControl lessonId={lesson.id} />
        </header>

        <TheoryOnlyState
          visualizationId={lesson.visualizationId}
          quizId={lesson.quizId}
          visualizationAvailable={visualizationAvailable}
          quizAvailable={quizAvailable}
        />

        <MdxContent
          source={source}
          title={lesson.title}
          sourcePath={sourceRecord.sourcePath}
          lessons={lessonSummaries}
        />

        <GenericLessonNavigation
          previous={adjacent.previous ? toNavigationItem(adjacent.previous) : undefined}
          next={adjacent.next ? toNavigationItem(adjacent.next) : undefined}
        />
      </article>
    </ReadingFrame>
  );
}

function LessonRail({
  lesson,
  prerequisites,
}: {
  lesson: ReturnType<typeof toLessonSummary>;
  prerequisites: ReturnType<typeof getPrerequisiteLessons>;
}) {
  return (
    <div className="lesson-rail">
      <section aria-labelledby="lesson-takeaway-title">
        <p className="eyebrow">Keep in mind</p>
        <h2 id="lesson-takeaway-title">Why this exists</h2>
        <p>{lesson.description}</p>
      </section>
      {prerequisites.length > 0 ? (
        <section aria-labelledby="lesson-prerequisites-title">
          <p className="eyebrow">Build from here</p>
          <h2 id="lesson-prerequisites-title">Prerequisites</h2>
          <ul>
            {prerequisites.map((prerequisite) => (
              <li key={prerequisite.id}>
                <Link href={lessonRoute(prerequisite.module, prerequisite.slug)}>{prerequisite.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function toNavigationItem(lesson: ReturnType<typeof getReaderModules>[number]["lessons"][number]): LessonNavigationItem {
  return {
    href: lessonRoute(lesson.module, lesson.slug),
    title: lesson.title,
    moduleTitle: moduleTitle(lesson.module),
    description: lesson.description,
  };
}

function toSidebarModule(module: ReturnType<typeof getReaderModules>[number]) {
  return {
    id: module.id,
    title: module.title ?? module.id,
    href: moduleRoute(module.id),
    description: module.description,
    lessons: module.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      href: lessonRoute(lesson.module, lesson.slug),
      description: lesson.description,
      difficulty: lesson.difficulty,
      estimatedMinutes: lesson.estimatedMinutes,
      order: lesson.order,
    })),
  };
}
