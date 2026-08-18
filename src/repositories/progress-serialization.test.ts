import { describe, expect, it } from "vitest";

import { ProgressValidationError, UnsupportedProgressVersionError } from "@/domain/progress";
import { createProgressExport, normalizeProgressImport } from "@/repositories/progress-serialization";

describe("progress export serialization", () => {
  it("creates deterministic version 3 exports", () => {
    expect(
      createProgressExport([
        { lessonId: "04-11-read-write-quorums", stage: "theory-complete" },
        { lessonId: "04-10-consistent-hashing", stage: "mastered" },
      ], []),
    ).toEqual({
      format: "system-design-visual-learning-lab-progress",
      schemaVersion: 3,
      lessons: [
        { lessonId: "04-10-consistent-hashing", stage: "mastered" },
        { lessonId: "04-11-read-write-quorums", stage: "theory-complete" },
      ],
      quizAttempts: [],
    });
  });

  it("migrates the documented version 1 record map", () => {
    expect(
      normalizeProgressImport({
        schemaVersion: 1,
        lessons: { "04-10-consistent-hashing": "quiz-passed" },
      }),
    ).toEqual({
      lessons: [{ lessonId: "04-10-consistent-hashing", stage: "quiz-passed" }],
      quizAttempts: [],
    });
  });

  it("migrates M3 version 2 exports with an empty attempt set", () => {
    expect(normalizeProgressImport({
      format: "system-design-visual-learning-lab-progress",
      schemaVersion: 2,
      lessons: [{ lessonId: "00-03-estimation", stage: "theory-complete" }],
    })).toEqual({
      lessons: [{ lessonId: "00-03-estimation", stage: "theory-complete" }],
      quizAttempts: [],
    });
  });

  it("normalizes and round-trips quiz attempts without hidden answer keys", () => {
    const attempt = {
      attemptId: "attempt-one",
      quizId: "estimation-quiz",
      lessonId: "00-03-estimation",
      answers: [{ questionId: "estimation-capacity-inputs", type: "multiple-choice" as const, selectedOptionIds: ["retry-amplification", "peak-multiplier"] }],
      earnedPoints: 0,
      possiblePoints: 1,
      scorePercent: 0,
      passed: false,
      incorrectConceptTags: ["peak-load", "capacity-headroom", "peak-load"],
    };
    const exported = createProgressExport([], [attempt]);
    expect(exported.quizAttempts[0]).toEqual({
      ...attempt,
      answers: [{ ...attempt.answers[0], selectedOptionIds: ["peak-multiplier", "retry-amplification"] }],
      incorrectConceptTags: ["capacity-headroom", "peak-load"],
    });
    expect(normalizeProgressImport(exported)).toEqual({ lessons: [], quizAttempts: exported.quizAttempts });
    expect(JSON.stringify(exported)).not.toContain("correctOption");
  });

  it("rejects malformed or duplicate attempts before import", () => {
    const attempt = {
      attemptId: "attempt-one", quizId: "estimation-quiz", lessonId: "00-03-estimation",
      answers: [], earnedPoints: 0, possiblePoints: 1, scorePercent: 0, passed: false,
      incorrectConceptTags: [],
    };
    expect(() => normalizeProgressImport({
      format: "system-design-visual-learning-lab-progress", schemaVersion: 3, lessons: [],
      quizAttempts: [attempt, attempt],
    })).toThrow(/duplicate quiz attempt ID/);
    expect(() => normalizeProgressImport({
      format: "system-design-visual-learning-lab-progress", schemaVersion: 3, lessons: [],
      quizAttempts: [{ ...attempt, possiblePoints: 0 }],
    })).toThrow(ProgressValidationError);
  });

  it("accepts JSON text and rejects partial, duplicate, or unsupported data", () => {
    expect(
      normalizeProgressImport(
        JSON.stringify({
          format: "system-design-visual-learning-lab-progress",
          schemaVersion: 2,
          lessons: [],
        }),
      ),
    ).toEqual({ lessons: [], quizAttempts: [] });
    expect(() => normalizeProgressImport({ schemaVersion: 2 })).toThrow(ProgressValidationError);
    expect(() =>
      normalizeProgressImport({
        format: "system-design-visual-learning-lab-progress",
        schemaVersion: 2,
        lessons: [
          { lessonId: "04-10-consistent-hashing", stage: "theory-complete" },
          { lessonId: "04-10-consistent-hashing", stage: "mastered" },
        ],
      }),
    ).toThrow(/duplicate lesson ID/);
    expect(() => normalizeProgressImport({ schemaVersion: 99 })).toThrow(
      UnsupportedProgressVersionError,
    );
  });
});
