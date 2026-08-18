import {
  LESSON_PROGRESS_MILESTONES,
  LESSON_PROGRESS_STAGES,
  type LessonProgress,
  type LessonProgressMilestone,
  type LessonProgressStage,
} from "./model";
import { ProgressValidationError } from "./errors";

const LESSON_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function assertLessonId(lessonId: unknown): asserts lessonId is string {
  if (typeof lessonId !== "string" || !LESSON_ID_PATTERN.test(lessonId)) {
    throw new ProgressValidationError(
      "Lesson progress requires a lowercase, hyphen-delimited stable lesson ID.",
    );
  }
}

export function isLessonProgressStage(value: unknown): value is LessonProgressStage {
  return typeof value === "string" && LESSON_PROGRESS_STAGES.includes(value as LessonProgressStage);
}

export function isLessonProgressMilestone(value: unknown): value is LessonProgressMilestone {
  return (
    typeof value === "string" &&
    LESSON_PROGRESS_MILESTONES.includes(value as LessonProgressMilestone)
  );
}

export function createLessonProgress(lessonId: string): LessonProgress {
  assertLessonId(lessonId);
  return { lessonId, stage: "not-started" };
}

export function assertLessonProgress(value: unknown): asserts value is LessonProgress {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ProgressValidationError("Lesson progress must be an object.");
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 2 || !keys.includes("lessonId") || !keys.includes("stage")) {
    throw new ProgressValidationError("Lesson progress must contain only lessonId and stage.");
  }

  assertLessonId(record.lessonId);
  if (!isLessonProgressStage(record.stage)) {
    throw new ProgressValidationError(`Unknown lesson progress stage: ${String(record.stage)}.`);
  }
}

export function compareLessonProgressStages(
  left: LessonProgressStage,
  right: LessonProgressStage,
): number {
  return LESSON_PROGRESS_STAGES.indexOf(left) - LESSON_PROGRESS_STAGES.indexOf(right);
}

export function advanceLessonProgress(
  current: LessonProgress | null,
  lessonId: string,
  milestone: LessonProgressMilestone,
): LessonProgress {
  assertLessonId(lessonId);
  if (!isLessonProgressMilestone(milestone)) {
    throw new ProgressValidationError(`Unknown lesson progress milestone: ${String(milestone)}.`);
  }
  if (current !== null) {
    assertLessonProgress(current);
    if (current.lessonId !== lessonId) {
      throw new ProgressValidationError("Cannot apply a lesson transition to a different lesson.");
    }
  }

  const currentStage = current?.stage ?? "not-started";
  return {
    lessonId,
    stage: compareLessonProgressStages(currentStage, milestone) >= 0 ? currentStage : milestone,
  };
}

export function mergeLessonProgress(
  current: LessonProgress | null,
  incoming: LessonProgress,
): LessonProgress {
  assertLessonProgress(incoming);
  if (current === null) return { ...incoming };
  assertLessonProgress(current);
  if (current.lessonId !== incoming.lessonId) {
    throw new ProgressValidationError("Cannot merge progress for different lessons.");
  }
  return compareLessonProgressStages(current.stage, incoming.stage) >= 0
    ? { ...current }
    : { ...incoming };
}
