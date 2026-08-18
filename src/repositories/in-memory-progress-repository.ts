import {
  advanceLessonProgress,
  assertLessonId,
  assertLessonProgress,
  mergeLessonProgress,
  normalizeProgressResetScope,
  normalizeQuizAttempt,
  quizAttemptsEqual,
  ProgressValidationError,
  type LessonProgress,
  type LessonProgressMilestone,
  type ProgressRepository,
  type ProgressResetScope,
  type QuizAttempt,
} from "@/domain/progress";
import { createProgressExport, normalizeProgressImport } from "./progress-serialization";

function cloneLessonProgress(progress: LessonProgress): LessonProgress {
  return { lessonId: progress.lessonId, stage: progress.stage };
}

function compareLessonIds(left: LessonProgress, right: LessonProgress): number {
  return left.lessonId.localeCompare(right.lessonId);
}

function cloneQuizAttempt(attempt: QuizAttempt): QuizAttempt {
  return normalizeQuizAttempt(attempt);
}

/**
 * A deterministic, process-local ProgressRepository implementation.
 *
 * The adapter deliberately keeps the repository boundary asynchronous so it
 * can stand in for IndexedDB (or a future remote adapter) in domain and
 * component tests. Every value crossing the boundary is cloned, preventing a
 * caller from mutating the repository by retaining an input or return value.
 */
export class InMemoryProgressRepository implements ProgressRepository {
  private lessons = new Map<string, LessonProgress>();
  private quizAttempts = new Map<string, QuizAttempt>();

  async getLessonProgress(lessonId: string): Promise<LessonProgress | null> {
    assertLessonId(lessonId);
    const progress = this.lessons.get(lessonId);
    return progress === undefined ? null : cloneLessonProgress(progress);
  }

  async listLessonProgress(): Promise<LessonProgress[]> {
    return [...this.lessons.values()]
      .sort(compareLessonIds)
      .map((progress) => cloneLessonProgress(progress));
  }

  async saveLessonProgress(progress: LessonProgress): Promise<LessonProgress> {
    // Validate before looking up the current record so malformed runtime
    // input cannot produce a misleading Map lookup or a partial write.
    assertLessonProgress(progress);
    const current = this.lessons.get(progress.lessonId) ?? null;
    const merged = mergeLessonProgress(current, progress);
    this.lessons.set(merged.lessonId, cloneLessonProgress(merged));
    return cloneLessonProgress(merged);
  }

  async applyLessonMilestone(
    lessonId: string,
    milestone: LessonProgressMilestone,
  ): Promise<LessonProgress> {
    const current = this.lessons.get(lessonId) ?? null;
    const next = advanceLessonProgress(current, lessonId, milestone);
    this.lessons.set(next.lessonId, cloneLessonProgress(next));
    return cloneLessonProgress(next);
  }

  async getQuizAttempt(attemptId: string): Promise<QuizAttempt | null> {
    const normalized = normalizeQuizAttemptId(attemptId);
    const attempt = this.quizAttempts.get(normalized);
    return attempt ? cloneQuizAttempt(attempt) : null;
  }

  async listQuizAttempts(): Promise<QuizAttempt[]> {
    return [...this.quizAttempts.values()]
      .sort((left, right) => left.attemptId.localeCompare(right.attemptId))
      .map(cloneQuizAttempt);
  }

  async saveQuizAttempt(attempt: QuizAttempt): Promise<QuizAttempt> {
    const normalized = normalizeQuizAttempt(attempt);
    const existing = this.quizAttempts.get(normalized.attemptId);
    if (existing) {
      if (!quizAttemptsEqual(existing, normalized)) {
        throw new ProgressValidationError(
          `Quiz attempt ID ${normalized.attemptId} is already used by different attempt data.`,
        );
      }
      return cloneQuizAttempt(existing);
    }

    this.quizAttempts.set(normalized.attemptId, cloneQuizAttempt(normalized));
    if (normalized.passed) {
      const current = this.lessons.get(normalized.lessonId) ?? null;
      const next = advanceLessonProgress(current, normalized.lessonId, "quiz-passed");
      this.lessons.set(next.lessonId, cloneLessonProgress(next));
    }
    return cloneQuizAttempt(normalized);
  }

  async exportProgress() {
    // createProgressExport validates and sorts a fresh array, and therefore
    // never exposes the Map or any of its records.
    return createProgressExport(
      [...this.lessons.values()].map(cloneLessonProgress),
      [...this.quizAttempts.values()].map(cloneQuizAttempt),
    );
  }

  async importProgress(data: unknown): Promise<void> {
    // Validation and normalization happen before touching this.lessons. Build
    // a replacement Map as a second step so malformed input cannot partially
    // replace an existing repository.
    const normalized = normalizeProgressImport(data);
    const replacement = new Map<string, LessonProgress>();
    for (const progress of normalized.lessons) {
      replacement.set(progress.lessonId, cloneLessonProgress(progress));
    }
    const replacementAttempts = new Map<string, QuizAttempt>();
    for (const attempt of normalized.quizAttempts) {
      replacementAttempts.set(attempt.attemptId, cloneQuizAttempt(attempt));
    }
    this.lessons = replacement;
    this.quizAttempts = replacementAttempts;
  }

  async resetProgress(scope: ProgressResetScope): Promise<void> {
    const normalizedScope = normalizeProgressResetScope(scope);

    if (normalizedScope.kind === "all") {
      this.lessons.clear();
      this.quizAttempts.clear();
      return;
    }

    const selected = new Set(normalizedScope.lessonIds);
    for (const lessonId of selected) this.lessons.delete(lessonId);
    for (const [attemptId, attempt] of this.quizAttempts) {
      if (selected.has(attempt.lessonId)) this.quizAttempts.delete(attemptId);
    }
  }
}


function normalizeQuizAttemptId(attemptId: unknown): string {
  const probe = normalizeQuizAttempt({
    attemptId,
    quizId: "attempt-id-probe",
    lessonId: "attempt-id-probe",
    answers: [],
    earnedPoints: 0,
    possiblePoints: 1,
    scorePercent: 0,
    passed: false,
    incorrectConceptTags: [],
  });
  return probe.attemptId;
}
