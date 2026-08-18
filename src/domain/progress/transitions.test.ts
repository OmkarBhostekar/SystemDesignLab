import { describe, expect, it } from "vitest";

import {
  advanceLessonProgress,
  createLessonProgress,
  mergeLessonProgress,
  normalizeProgressResetScope,
  ProgressValidationError,
} from "@/domain/progress";

describe("lesson progress transitions", () => {
  it("starts a new lesson at not started", () => {
    expect(createLessonProgress("04-10-consistent-hashing")).toEqual({
      lessonId: "04-10-consistent-hashing",
      stage: "not-started",
    });
  });

  it("advances through explicit milestones", () => {
    const theory = advanceLessonProgress(null, "04-10-consistent-hashing", "theory-complete");
    const visualized = advanceLessonProgress(
      theory,
      "04-10-consistent-hashing",
      "visualization-complete",
    );
    expect(visualized.stage).toBe("visualization-complete");
  });

  it("is idempotent and never regresses a completed lesson", () => {
    const mastered = advanceLessonProgress(null, "04-10-consistent-hashing", "mastered");
    expect(advanceLessonProgress(mastered, mastered.lessonId, "mastered")).toEqual(mastered);
    expect(advanceLessonProgress(mastered, mastered.lessonId, "theory-complete")).toEqual(mastered);
    expect(
      mergeLessonProgress(mastered, { lessonId: mastered.lessonId, stage: "quiz-passed" }),
    ).toEqual(mastered);
  });

  it("rejects malformed IDs, stages, and cross-lesson transitions", () => {
    expect(() => createLessonProgress("Not valid")).toThrow(ProgressValidationError);
    expect(() =>
      advanceLessonProgress(
        { lessonId: "04-10-consistent-hashing", stage: "theory-complete" },
        "04-11-read-write-quorums",
        "quiz-passed",
      ),
    ).toThrow(/different lesson/);
  });

  it("normalizes selected reset IDs and rejects ambiguous scopes", () => {
    expect(
      normalizeProgressResetScope({
        kind: "lessons",
        lessonIds: [
          "04-11-read-write-quorums",
          "04-10-consistent-hashing",
          "04-10-consistent-hashing",
        ],
      }),
    ).toEqual({
      kind: "lessons",
      lessonIds: ["04-10-consistent-hashing", "04-11-read-write-quorums"],
    });
    expect(() =>
      normalizeProgressResetScope({ kind: "all", lessonIds: [] } as never),
    ).toThrow(ProgressValidationError);
  });
});
