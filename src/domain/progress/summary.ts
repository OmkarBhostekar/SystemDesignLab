import type { LessonProgress, LessonProgressStage } from "./model";
import { ProgressValidationError } from "./errors";
import { assertLessonId, compareLessonProgressStages } from "./transitions";

export interface CurriculumProgressSummary {
  completedTheoryLessons: number;
  totalLessons: number;
  percentComplete: number;
}

function indexKnownProgress(
  orderedLessonIds: readonly string[],
  progress: readonly LessonProgress[],
): Map<string, LessonProgressStage> {
  const knownIds = new Set<string>();
  for (const lessonId of orderedLessonIds) {
    assertLessonId(lessonId);
    if (knownIds.has(lessonId)) {
      throw new ProgressValidationError(`Curriculum contains duplicate lesson ID: ${lessonId}.`);
    }
    knownIds.add(lessonId);
  }

  const indexed = new Map<string, LessonProgressStage>();
  for (const record of progress) {
    if (!knownIds.has(record.lessonId)) {
      throw new ProgressValidationError(`Progress references unknown lesson ID: ${record.lessonId}.`);
    }
    if (indexed.has(record.lessonId)) {
      throw new ProgressValidationError(`Progress contains duplicate lesson ID: ${record.lessonId}.`);
    }
    indexed.set(record.lessonId, record.stage);
  }
  return indexed;
}

export function summarizeCurriculumProgress(
  orderedLessonIds: readonly string[],
  progress: readonly LessonProgress[],
): CurriculumProgressSummary {
  const indexed = indexKnownProgress(orderedLessonIds, progress);
  const completedTheoryLessons = orderedLessonIds.filter((lessonId) => {
    const stage = indexed.get(lessonId) ?? "not-started";
    return compareLessonProgressStages(stage, "theory-complete") >= 0;
  }).length;
  return {
    completedTheoryLessons,
    totalLessons: orderedLessonIds.length,
    percentComplete:
      orderedLessonIds.length === 0
        ? 0
        : Math.round((completedTheoryLessons / orderedLessonIds.length) * 100),
  };
}

export function findContinueLearningLessonId(
  orderedLessonIds: readonly string[],
  progress: readonly LessonProgress[],
): string | null {
  const indexed = indexKnownProgress(orderedLessonIds, progress);
  return (
    orderedLessonIds.find((lessonId) => {
      const stage = indexed.get(lessonId) ?? "not-started";
      return compareLessonProgressStages(stage, "theory-complete") < 0;
    }) ?? null
  );
}
