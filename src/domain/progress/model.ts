import type { QuizAnswer } from "@/domain/quiz";

export const LESSON_PROGRESS_STAGES = [
  "not-started",
  "theory-complete",
  "visualization-complete",
  "quiz-passed",
  "mastered",
] as const;

export type LessonProgressStage = (typeof LESSON_PROGRESS_STAGES)[number];

export const LESSON_PROGRESS_MILESTONES = [
  "theory-complete",
  "visualization-complete",
  "quiz-passed",
  "mastered",
] as const;

export type LessonProgressMilestone = (typeof LESSON_PROGRESS_MILESTONES)[number];

export interface LessonProgress {
  lessonId: string;
  stage: LessonProgressStage;
}

export type ProgressResetScope =
  | { kind: "all" }
  | { kind: "lessons"; lessonIds: readonly string[] };

export const PROGRESS_EXPORT_FORMAT = "system-design-visual-learning-lab-progress";
export const PROGRESS_EXPORT_VERSION = 3 as const;

export interface QuizAttempt {
  attemptId: string;
  quizId: string;
  lessonId: string;
  answers: QuizAnswer[];
  earnedPoints: number;
  possiblePoints: number;
  scorePercent: number;
  passed: boolean;
  incorrectConceptTags: string[];
}

export interface ProgressExport {
  format: typeof PROGRESS_EXPORT_FORMAT;
  schemaVersion: typeof PROGRESS_EXPORT_VERSION;
  lessons: LessonProgress[];
  quizAttempts: QuizAttempt[];
}
