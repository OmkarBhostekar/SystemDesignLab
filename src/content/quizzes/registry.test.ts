import { describe, expect, it } from "vitest";

import { QuizValidationError, type QuizDefinition } from "@/domain/quiz";

import { assertQuizRegistryLessonIds, createQuizRegistry, getQuiz, listQuizIds } from "./registry";

describe("structured quiz registry", () => {
  it("resolves stable quiz IDs deterministically", () => {
    expect(listQuizIds()).toEqual(["consistent-hashing-quiz", "estimation-quiz"]);
    expect(getQuiz("estimation-quiz")?.lessonId).toBe("00-03-estimation");
    expect(getQuiz("missing-quiz")).toBeNull();
  });

  it("rejects duplicate quiz IDs", () => {
    const quiz = getQuiz("estimation-quiz") as QuizDefinition;
    expect(() => createQuizRegistry([quiz, quiz])).toThrow(QuizValidationError);
  });

  it("rejects quiz definitions that reference unknown lessons", () => {
    expect(() => assertQuizRegistryLessonIds(["00-03-estimation"])).toThrow(/unknown lesson ID/);
  });
});
