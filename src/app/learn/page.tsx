import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { CurriculumSidebar } from "@/components/navigation/CurriculumSidebar";
import { ReadingFrame } from "@/components/layout/AppShell";

import { getReaderIndex, getReaderModules, getReaderNavigation } from "./content";
import { moduleNumber, moduleRoute } from "./route-helpers";

export const metadata: Metadata = {
  title: "Learn",
  description: "Read the dependency-ordered system-design theory curriculum.",
};

export const dynamic = "force-static";

export default function LearnPage() {
  const index = getReaderIndex();
  const modules = getReaderModules(index);
  const navigation = getReaderNavigation(index);

  return (
    <ReadingFrame
      className="learn-index"
      sidebar={<CurriculumSidebar modules={navigation.map(toSidebarModule)} />}
      breadcrumbs={<Breadcrumbs items={[{ label: "Learn", current: true }]} />}
    >
      <header className="learn-index__header">
        <p className="eyebrow">Theory reader</p>
        <h1>Learn system design by following the pressure</h1>
        <p>
          Start with interview reasoning, then build the foundations that explain why each component appears in a
          real architecture. The curriculum is readable without visualizations or progress state.
        </p>
        <p className="learn-index__count">
          {index.lessons.length} lessons across {modules.length} modules
        </p>
      </header>

      <section className="module-grid" aria-labelledby="module-grid-title">
        <div className="section-heading">
          <p className="eyebrow">Dependency ordered</p>
          <h2 id="module-grid-title">Choose a starting point</h2>
        </div>
        <div className="module-grid__items">
          {modules.map((module) => (
            <article className="module-card" key={module.id}>
              <p className="module-card__index">Module {moduleNumber(module)}</p>
              <h3>
                <Link href={moduleRoute(module.id)}>{module.title}</Link>
              </h3>
              <p>{module.lessons.length} lessons</p>
              <ol>
                {module.lessons.slice(0, 3).map((lesson) => (
                  <li key={lesson.id}>
                    <Link href={`/learn/${lesson.module}/${lesson.slug}`}>{lesson.title}</Link>
                  </li>
                ))}
              </ol>
              {module.lessons.length > 3 ? <p className="module-card__more">And {module.lessons.length - 3} more…</p> : null}
              <Link className="text-link" href={moduleRoute(module.id)}>
                View module <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>
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
