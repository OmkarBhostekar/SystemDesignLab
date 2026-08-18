import {
  advanceLessonProgress,
  assertLessonId,
  assertLessonProgress,
  mergeLessonProgress,
  normalizeProgressResetScope,
  type LessonProgress,
  type LessonProgressMilestone,
  type ProgressRepository,
  type ProgressResetScope,
} from "@/domain/progress";
import { createProgressExport, normalizeProgressImport } from "./progress-serialization";

function cloneLessonProgress(progress: LessonProgress): LessonProgress {
  return { lessonId: progress.lessonId, stage: progress.stage };
}

function compareLessonIds(left: LessonProgress, right: LessonProgress): number {
  return left.lessonId.localeCompare(right.lessonId);
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

  async exportProgress() {
    // createProgressExport validates and sorts a fresh array, and therefore
    // never exposes the Map or any of its records.
    return createProgressExport([...this.lessons.values()].map(cloneLessonProgress));
  }

  async importProgress(data: unknown): Promise<void> {
    // Validation and normalization happen before touching this.lessons. Build
    // a replacement Map as a second step so malformed input cannot partially
    // replace an existing repository.
    const normalized = normalizeProgressImport(data);
    const replacement = new Map<string, LessonProgress>();
    for (const progress of normalized) {
      replacement.set(progress.lessonId, cloneLessonProgress(progress));
    }
    this.lessons = replacement;
  }

  async resetProgress(scope: ProgressResetScope): Promise<void> {
    const normalizedScope = normalizeProgressResetScope(scope);

    if (normalizedScope.kind === "all") {
      this.lessons.clear();
      return;
    }

    for (const lessonId of normalizedScope.lessonIds) this.lessons.delete(lessonId);
  }
}
