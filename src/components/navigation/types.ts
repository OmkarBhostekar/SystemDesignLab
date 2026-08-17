import type { ReactNode } from "react";

export type LessonDifficulty = "core" | "advanced" | "deep-dive";

export type LessonProgressState =
  | "not-started"
  | "available"
  | "in-progress"
  | "completed"
  | "mastered"
  | "locked";

/** The smallest shape the curriculum sidebar needs from the content index. */
export interface CurriculumLessonItem {
  id: string;
  title: string;
  href: string;
  description?: string;
  difficulty?: LessonDifficulty;
  estimatedMinutes?: number;
  order?: number;
  progress?: LessonProgressState;
}

/** A module is intentionally metadata-only; lesson prose never belongs here. */
export interface CurriculumModuleItem {
  id: string;
  title: string;
  href?: string;
  description?: string;
  lessons: readonly CurriculumLessonItem[];
  isExpanded?: boolean;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
  /** Allows callers to provide a tooltip/label without changing visible copy. */
  ariaLabel?: string;
}

export interface LessonNavigationItem {
  href: string;
  title: string;
  moduleTitle?: string;
  description?: string;
}

export interface PrimaryNavigationItem {
  href: string;
  label: string;
  active?: boolean;
  icon?: ReactNode;
}
