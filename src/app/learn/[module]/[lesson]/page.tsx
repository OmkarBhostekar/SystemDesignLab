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
import { QuizPanel } from "@/components/quiz";
import { VisualizationPanel } from "@/components/simulations";
import { getQuiz } from "@/content/quizzes";
import { getVisualization } from "@/content/visualizations";

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

  const visualization = getVisualization(lesson.visualizationId);
  const visualizationAvailable = visualization?.lessonId === lesson.id;
  const quiz = getQuiz(lesson.quizId);
  const quizAvailable = quiz?.lessonId === lesson.id;
  const lessonContent = splitSourceAroundVisualization(source);

  return (
    <ReadingFrame
      className="lesson-page"
      sidebar={<CurriculumSidebar modules={navigation} activeLessonId={lesson.id} activeModuleId={moduleRecord.id} />}
      breadcrumbs={<Breadcrumbs items={breadcrumbsForLesson(moduleRecord, lesson)} />}
    >
      <article className="lesson-article">
        <header className="lesson-article__header">
          <div className="lesson-article__heading">
            <p className="eyebrow">{moduleRecord.title}</p>
            <h1>{lesson.title}</h1>
            <p className="lesson-article__description">{lesson.description}</p>
            <LessonMetadata lesson={summary} />
          </div>
          <aside className="lesson-article__setup" aria-label="Lesson setup">
            <LessonPrerequisites prerequisites={prerequisites} />
            <LessonProgressControl lessonId={lesson.id} />
          </aside>
          <LessonStepper
            visualizationAvailable={visualizationAvailable}
            quizAvailable={quizAvailable}
          />
        </header>

        <section id="theory" className="lesson-stage lesson-stage--theory" aria-label="Theory">
          <MdxContent
            source={lessonContent.beforeVisualization}
            title={lesson.title}
            sourcePath={sourceRecord.sourcePath}
            lessons={lessonSummaries}
          />
        </section>

        {visualizationAvailable && visualization ? (
          <section id="visualization" className="lesson-stage lesson-stage--visualization" aria-label="Visualization">
            <VisualizationPanel visualization={visualization} />
          </section>
        ) : null}

        {lessonContent.afterVisualization ? (
          <section className="lesson-stage lesson-stage--deep-dive" aria-label="Theory continued">
            <MdxContent
              source={lessonContent.afterVisualization}
              sourcePath={sourceRecord.sourcePath}
              lessons={lessonSummaries}
            />
          </section>
        ) : null}

        <section id="practice" className="lesson-stage lesson-stage--practice" aria-label="Practice">
          {quizAvailable && quiz ? <QuizPanel quiz={quiz} /> : (
            <TheoryOnlyState
              visualizationId={lesson.visualizationId}
              quizId={lesson.quizId}
              visualizationAvailable={visualizationAvailable}
              quizAvailable={quizAvailable}
            />
          )}
        </section>

        <GenericLessonNavigation
          previous={adjacent.previous ? toNavigationItem(adjacent.previous) : undefined}
          next={adjacent.next ? toNavigationItem(adjacent.next) : undefined}
        />
      </article>
    </ReadingFrame>
  );
}

function LessonPrerequisites({
  prerequisites,
}: {
  prerequisites: ReturnType<typeof getPrerequisiteLessons>;
}) {
  if (prerequisites.length === 0) return null;

  return (
    <section className="lesson-prerequisites" aria-labelledby="lesson-prerequisites-title">
      <p className="eyebrow">Before you start</p>
      <h2 id="lesson-prerequisites-title">Prerequisites</h2>
      <ul>
        {prerequisites.map((prerequisite) => (
          <li key={prerequisite.id}>
            <Link href={lessonRoute(prerequisite.module, prerequisite.slug)}>{prerequisite.title}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function splitSourceAroundVisualization(source: string): {
  beforeVisualization: string;
  afterVisualization: string;
} {
  const marker = /^## Visualization We Eventually Want\s*$/m;
  const markerMatch = marker.exec(source);
  if (!markerMatch || markerMatch.index === undefined) {
    return { beforeVisualization: source, afterVisualization: "" };
  }

  const afterMarkerStart = markerMatch.index + markerMatch[0].length;
  const nextHeading = /^##\s+/m.exec(source.slice(afterMarkerStart));
  const afterVisualization = nextHeading
    ? source.slice(afterMarkerStart + nextHeading.index)
    : "";

  return {
    beforeVisualization: source.slice(0, markerMatch.index).trimEnd(),
    afterVisualization: afterVisualization.trimStart(),
  };
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
