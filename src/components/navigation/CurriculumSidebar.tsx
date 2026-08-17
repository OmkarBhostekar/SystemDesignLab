import Link from "next/link";

import type {
  CurriculumLessonItem,
  CurriculumModuleItem,
  LessonDifficulty,
  LessonProgressState,
} from "@/components/navigation/types";

export interface CurriculumSidebarProps {
  modules: readonly CurriculumModuleItem[];
  activeLessonId?: string;
  activeModuleId?: string;
  heading?: string;
  ariaLabel?: string;
  className?: string;
}

const DIFFICULTY_LABELS: Record<LessonDifficulty, string> = {
  core: "Core",
  advanced: "Advanced",
  "deep-dive": "Deep dive",
};

const PROGRESS_LABELS: Record<LessonProgressState, string> = {
  "not-started": "Not started",
  available: "Available",
  "in-progress": "In progress",
  completed: "Complete",
  mastered: "Mastered",
  locked: "Locked",
};

function LessonStatus({ lesson }: { lesson: CurriculumLessonItem }) {
  if (!lesson.progress) {
    return null;
  }

  return (
    <span className={`curriculum-sidebar__status curriculum-sidebar__status--${lesson.progress}`}>
      {PROGRESS_LABELS[lesson.progress]}
    </span>
  );
}

function LessonLink({ lesson, isCurrent }: { lesson: CurriculumLessonItem; isCurrent: boolean }) {
  const metadata = [
    lesson.difficulty ? DIFFICULTY_LABELS[lesson.difficulty] : null,
    lesson.estimatedMinutes ? `${lesson.estimatedMinutes} min` : null,
  ].filter(Boolean);
  const isLocked = lesson.progress === "locked";

  if (isLocked) {
    return (
      <span className="curriculum-sidebar__lesson is-locked" aria-disabled="true">
        <span className="curriculum-sidebar__lesson-title">{lesson.title}</span>
        <span className="curriculum-sidebar__lesson-meta">
          <LessonStatus lesson={lesson} />
          {metadata.length ? <span>{metadata.join(" · ")}</span> : null}
        </span>
      </span>
    );
  }

  return (
    <Link
      className={`curriculum-sidebar__lesson${isCurrent ? " is-current" : ""}`}
      href={lesson.href}
      aria-current={isCurrent ? "page" : undefined}
      title={lesson.description}
    >
      <span className="curriculum-sidebar__lesson-title">{lesson.title}</span>
      <span className="curriculum-sidebar__lesson-meta">
        <LessonStatus lesson={lesson} />
        {metadata.length ? <span>{metadata.join(" · ")}</span> : null}
      </span>
    </Link>
  );
}

function ModuleSection({
  module,
  activeLessonId,
  activeModuleId,
  moduleIndex,
}: {
  module: CurriculumModuleItem;
  activeLessonId?: string;
  activeModuleId?: string;
  moduleIndex: number;
}) {
  const hasCurrentLesson = module.lessons.some((lesson) => lesson.id === activeLessonId);
  const isCurrentModule = module.id === activeModuleId || hasCurrentLesson;
  const isExpanded = module.isExpanded ?? (isCurrentModule || (!activeLessonId && !activeModuleId && moduleIndex === 0));

  return (
    <div className={`curriculum-sidebar__module${isCurrentModule ? " is-current" : ""}`}>
      {module.href ? (
        <Link className="curriculum-sidebar__overview" href={module.href}>
          Module overview
        </Link>
      ) : null}
      <details open={isExpanded}>
        <summary>
          <span className="curriculum-sidebar__module-title">{module.title}</span>
          <span className="curriculum-sidebar__module-count">
            {module.lessons.length} {module.lessons.length === 1 ? "lesson" : "lessons"}
          </span>
        </summary>
        {module.description ? <p className="curriculum-sidebar__module-description">{module.description}</p> : null}
        <ol className="curriculum-sidebar__lessons">
          {module.lessons.map((lesson) => (
            <li key={lesson.id}>
              <LessonLink lesson={lesson} isCurrent={lesson.id === activeLessonId} />
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

export function CurriculumSidebar({
  modules,
  activeLessonId,
  activeModuleId,
  heading = "Curriculum",
  ariaLabel = "Curriculum navigation",
  className = "",
}: CurriculumSidebarProps) {
  return (
    <nav className={`curriculum-sidebar${className ? ` ${className}` : ""}`} aria-label={ariaLabel}>
      <div className="curriculum-sidebar__heading-row">
        <h2>{heading}</h2>
        <span className="curriculum-sidebar__total">
          {modules.reduce((total, module) => total + module.lessons.length, 0)} lessons
        </span>
      </div>
      {modules.length > 0 ? (
        <div className="curriculum-sidebar__modules">
          {modules.map((module, moduleIndex) => (
            <ModuleSection
              key={module.id}
              module={module}
              activeLessonId={activeLessonId}
              activeModuleId={activeModuleId}
              moduleIndex={moduleIndex}
            />
          ))}
        </div>
      ) : (
        <p className="curriculum-sidebar__empty">Curriculum navigation will appear here when lessons are indexed.</p>
      )}
    </nav>
  );
}

export { CurriculumSidebar as CurriculumNavigation };
