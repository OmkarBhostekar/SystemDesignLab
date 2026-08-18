import { describe, expect, it } from "vitest";

import { ProgressValidationError, UnsupportedProgressVersionError } from "@/domain/progress";
import { createProgressExport, normalizeProgressImport } from "@/repositories/progress-serialization";

describe("progress export serialization", () => {
  it("creates deterministic version 2 exports", () => {
    expect(
      createProgressExport([
        { lessonId: "04-11-read-write-quorums", stage: "theory-complete" },
        { lessonId: "04-10-consistent-hashing", stage: "mastered" },
      ]),
    ).toEqual({
      format: "system-design-visual-learning-lab-progress",
      schemaVersion: 2,
      lessons: [
        { lessonId: "04-10-consistent-hashing", stage: "mastered" },
        { lessonId: "04-11-read-write-quorums", stage: "theory-complete" },
      ],
    });
  });

  it("migrates the documented version 1 record map", () => {
    expect(
      normalizeProgressImport({
        schemaVersion: 1,
        lessons: { "04-10-consistent-hashing": "quiz-passed" },
      }),
    ).toEqual([{ lessonId: "04-10-consistent-hashing", stage: "quiz-passed" }]);
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
    ).toEqual([]);
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
