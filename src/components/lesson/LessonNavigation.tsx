import Link from "next/link";

import type { LessonSummary } from "./lesson-types";

type LessonNavigationProps = {
  previous?: LessonSummary;
  next?: LessonSummary;
  prerequisites?: LessonSummary[];
  routeFor: (lesson: Pick<LessonSummary, "module" | "slug">) => string;
};

export function LessonNavigation({ previous, next, prerequisites = [], routeFor }: LessonNavigationProps) {
  return (
    <footer className="lesson-navigation">
      {prerequisites.length > 0 ? (
        <section aria-labelledby="prerequisite-heading">
          <h2 id="prerequisite-heading">Prerequisites</h2>
          <ul>
            {prerequisites.map((lesson) => (
              <li key={lesson.id}>
                <Link href={routeFor(lesson)}>{lesson.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <nav aria-label="Lesson navigation" className="lesson-navigation__adjacent">
        {previous ? (
          <Link href={routeFor(previous)} rel="prev">
            <span aria-hidden="true">← </span>
            <span>
              <small>Previous lesson</small>
              {previous.title}
            </span>
          </Link>
        ) : (
          <span aria-hidden="true" />
        )}
        {next ? (
          <Link href={routeFor(next)} rel="next">
            <span>
              <small>Next lesson</small>
              {next.title}
            </span>
            <span aria-hidden="true"> →</span>
          </Link>
        ) : null}
      </nav>
    </footer>
  );
}
