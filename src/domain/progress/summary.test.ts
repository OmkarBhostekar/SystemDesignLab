import { describe, expect, it } from "vitest";

import {
  findContinueLearningLessonId,
  ProgressValidationError,
  summarizeCurriculumProgress,
} from "@/domain/progress";

const lessonIds = ["00-01-first", "00-02-second", "00-03-third"];

describe("curriculum progress summaries", () => {
  it("counts theory-or-later stages and selects the first incomplete lesson", () => {
    const progress = [
      { lessonId: "00-01-first", stage: "theory-complete" },
      { lessonId: "00-03-third", stage: "mastered" },
    ] as const;
    expect(summarizeCurriculumProgress(lessonIds, progress)).toEqual({
      completedTheoryLessons: 2,
      totalLessons: 3,
      percentComplete: 67,
    });
    expect(findContinueLearningLessonId(lessonIds, progress)).toBe("00-02-second");
  });

  it("is deterministic for empty and fully completed curricula", () => {
    expect(summarizeCurriculumProgress([], [])).toEqual({
      completedTheoryLessons: 0,
      totalLessons: 0,
      percentComplete: 0,
    });
    expect(
      findContinueLearningLessonId(
        lessonIds,
        lessonIds.map((lessonId) => ({ lessonId, stage: "theory-complete" as const })),
      ),
    ).toBeNull();
  });

  it("reports unknown and duplicate lesson IDs", () => {
    expect(() =>
      summarizeCurriculumProgress(lessonIds, [
        { lessonId: "99-01-unknown", stage: "theory-complete" },
      ]),
    ).toThrow(ProgressValidationError);
    expect(() => summarizeCurriculumProgress([lessonIds[0], lessonIds[0]], [])).toThrow(
      /duplicate lesson ID/,
    );
  });
});
