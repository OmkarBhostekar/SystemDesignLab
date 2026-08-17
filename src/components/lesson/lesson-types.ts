import type { ReactNode } from "react";

export type LessonDifficulty = "core" | "advanced" | "deep-dive";

/**
 * The route layer deliberately depends on this small, serializable view of a
 * lesson. The content index can grow fields without forcing the reader to
 * know about its parser internals.
 */
export type LessonSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  module: string;
  moduleTitle?: string;
  order: number;
  difficulty: LessonDifficulty;
  estimatedMinutes: number;
  prerequisites: string[];
  tags: string[];
  objectives?: string[];
  visualizationId?: string | null;
  quizId?: string | null;
  relatedLessons?: string[];
  aliases?: string[];
  sourcePath?: string;
  source?: string;
  body?: string;
  content?: string;
};

export type LessonNavigationGroup = {
  slug: string;
  title: string;
  description?: string;
  lessons: LessonSummary[];
};

export type LessonLink = {
  href: string;
  label: string;
};

export type BreadcrumbItem = LessonLink & { current?: boolean };

export type LessonEnhancementState = {
  visualizationAvailable?: boolean;
  quizAvailable?: boolean;
};

export type MdxRendererProps = {
  source: string;
  /** Optional page title used to suppress a duplicate authored leading H1. */
  title?: string;
  sourcePath?: string;
  lessons?: LessonSummary[];
  className?: string;
};

export type LessonContentProps = {
  children: ReactNode;
  className?: string;
};
