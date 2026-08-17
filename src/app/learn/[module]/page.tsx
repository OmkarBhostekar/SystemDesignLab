import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReadingFrame } from "@/components/layout/AppShell";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { CurriculumSidebar } from "@/components/navigation/CurriculumSidebar";

import { getReaderIndex, getReaderModules } from "../content";
import { breadcrumbsForModule, moduleNumber, moduleRoute } from "../route-helpers";

type ModulePageProps = {
  params: Promise<{ module: string }>;
};

export const dynamic = "force-static";

export function generateStaticParams() {
  return getReaderModules().map((module) => ({ module: module.id }));
}

export async function generateMetadata({ params }: ModulePageProps): Promise<Metadata> {
  const { module: moduleId } = await params;
  const moduleRecord = getReaderModules().find((candidate) => candidate.id === moduleId);
  return moduleRecord
    ? { title: moduleRecord.title, description: `${moduleRecord.title} lessons in the system-design theory curriculum.` }
    : { title: "Module not found" };
}

export default async function ModulePage({ params }: ModulePageProps) {
  const { module: moduleId } = await params;
  const index = getReaderIndex();
  const moduleRecord = getReaderModules(index).find((candidate) => candidate.id === moduleId);
  if (!moduleRecord) notFound();

  const navigation = getReaderModules(index).map(toSidebarModule);

  return (
    <ReadingFrame
      className="module-page"
      sidebar={<CurriculumSidebar modules={navigation} activeModuleId={moduleRecord.id} />}
      breadcrumbs={<Breadcrumbs items={breadcrumbsForModule(moduleRecord)} />}
    >
      <header className="module-page__header">
        <p className="eyebrow">Module {moduleNumber(moduleRecord)}</p>
        <h1>{moduleRecord.title}</h1>
        <p>{moduleRecord.description ?? "A dependency-ordered set of system-design lessons."}</p>
        <p className="module-page__count">{moduleRecord.lessons.length} lessons</p>
      </header>

      <section aria-labelledby="module-lessons-title" className="lesson-list">
        <div className="section-heading">
          <p className="eyebrow">Curriculum</p>
          <h2 id="module-lessons-title">Lessons in this module</h2>
        </div>
        <ol>
          {moduleRecord.lessons.map((lesson) => (
            <li key={lesson.id}>
              <Link href={`/learn/${lesson.module}/${lesson.slug}`}>
                <span className="lesson-list__order">{lesson.order}</span>
                <span className="lesson-list__content">
                  <strong>{lesson.title}</strong>
                  <span>{lesson.description}</span>
                </span>
                <span className="lesson-list__meta">
                  {lesson.estimatedMinutes} min
                  <span aria-hidden="true">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </ReadingFrame>
  );
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
      href: `/learn/${lesson.module}/${lesson.slug}`,
      description: lesson.description,
      difficulty: lesson.difficulty,
      estimatedMinutes: lesson.estimatedMinutes,
      order: lesson.order,
    })),
  };
}
