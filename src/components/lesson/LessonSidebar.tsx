import Link from "next/link";

import type { LessonNavigationGroup, LessonSummary } from "./lesson-types";

type LessonSidebarProps = {
  groups: LessonNavigationGroup[];
  activeLessonId?: string;
  activeModule?: string;
  routeForLesson?: (lesson: Pick<LessonSummary, "module" | "slug">) => string;
};

export function LessonSidebar({
  groups,
  activeLessonId,
  activeModule,
  routeForLesson = (lesson) => `/learn/${lesson.module}/${lesson.slug}`,
}: LessonSidebarProps) {
  return (
    <aside className="lesson-sidebar" aria-label="Curriculum">
      <div className="lesson-sidebar__heading">
        <span>Curriculum</span>
        <Link href="/learn">All modules</Link>
      </div>
      <nav>
        {groups.map((group) => {
          const isActiveModule = activeModule === group.slug;
          return (
            <section key={group.slug} aria-labelledby={`module-${group.slug}`}>
              <h2 id={`module-${group.slug}`}>
                <Link href={`/learn/${group.slug}`} aria-current={isActiveModule ? "page" : undefined}>
                  {group.title}
                </Link>
              </h2>
              <ol>
                {group.lessons.map((lesson) => {
                  const isActive = lesson.id === activeLessonId;
                  return (
                    <li key={lesson.id}>
                      <Link
                        href={routeForLesson(lesson)}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <span>{lesson.title}</span>
                        <small>{lesson.estimatedMinutes} min</small>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </nav>
    </aside>
  );
}
