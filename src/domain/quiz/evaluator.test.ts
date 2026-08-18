import { describe, expect, it } from "vitest";

import { QuizValidationError } from "./errors";
import { evaluateQuiz } from "./evaluator";
import type { QuizAnswer, QuizDefinition, QuizQuestion } from "./model";

function createQuiz(overrides: Partial<QuizDefinition> = {}): QuizDefinition {
  return {
    id: "estimation-quiz",
    lessonId: "00-03-estimation",
    title: "Estimation Quiz",
    passThresholdPercent: 80,
    questions: [
      {
        id: "q-single-choice",
        lessonId: "00-03-estimation",
        type: "single-choice",
        prompt: "Which signal best describes peak capacity?",
        options: [
          { id: "choice-fast", label: "Peak requests per second" },
          { id: "choice-late", label: "The number of product logos" },
        ],
        correctOptionId: "choice-fast",
        explanation: "Peak request rate is an input to capacity planning.",
        conceptTags: ["capacity", "trade-offs"],
      },
      {
        id: "q-multiple-choice",
        lessonId: "00-03-estimation",
        type: "multiple-choice",
        prompt: "Which estimates need explicit units?",
        options: [
          { id: "choice-consistency", label: "Retention" },
          { id: "choice-availability", label: "Bandwidth" },
          { id: "choice-unrelated", label: "Logo color" },
        ],
        correctOptionIds: ["choice-consistency", "choice-availability"],
        explanation: "Rates, sizes, and retention are only meaningful with units.",
        conceptTags: ["units", "capacity"],
      },
      {
        id: "q-numeric-estimation",
        lessonId: "00-03-estimation",
        type: "numeric-estimation",
        prompt: "What is the estimated peak QPS?",
        correctValue: 100,
        tolerance: { kind: "absolute", value: 5 },
        unit: "QPS",
        explanation: "The estimate is accepted within the stated absolute tolerance.",
        conceptTags: ["capacity", "qps"],
      },
      {
        id: "q-fallback-choice",
        lessonId: "00-03-estimation",
        type: "single-choice",
        prompt: "What should an estimate expose?",
        options: [
          { id: "choice-safe", label: "Its assumptions" },
          { id: "choice-hidden", label: "Only false precision" },
        ],
        correctOptionId: "choice-safe",
        explanation: "Visible assumptions make an estimate easy to revise.",
        conceptTags: ["capacity", "failure"],
      },
      {
        id: "q-storage-estimation",
        lessonId: "00-03-estimation",
        type: "numeric-estimation",
        prompt: "How many gigabytes are retained?",
        correctValue: 10,
        tolerance: { kind: "absolute", value: 1 },
        unit: "GB",
        explanation: "Retention multiplies daily writes by the retention window.",
        conceptTags: ["storage"],
      },
    ],
    ...overrides,
  };
}

function answer(
  questionId: string,
  selectedOptionId: string,
): QuizAnswer {
  return { questionId, type: "single-choice", selectedOptionId };
}

describe("evaluateQuiz", () => {
  it("evaluates every supported type and returns stable normalized answers", () => {
    const answers: QuizAnswer[] = [
      {
        questionId: "q-storage-estimation",
        type: "numeric-estimation",
        value: 10,
        unit: "GB",
      },
      {
        questionId: "q-multiple-choice",
        type: "multiple-choice",
        selectedOptionIds: ["choice-availability", "choice-consistency"],
      },
      answer("q-fallback-choice", "choice-safe"),
      {
        questionId: "q-numeric-estimation",
        type: "numeric-estimation",
        value: 100,
        unit: "QPS",
      },
      answer("q-single-choice", "choice-fast"),
    ];
    const originalAnswers = structuredClone(answers);

    const first = evaluateQuiz(createQuiz(), answers);
    const second = evaluateQuiz(createQuiz(), answers);

    expect(first).toEqual(second);
    expect(answers).toEqual(originalAnswers);
    expect(first).toMatchObject({
      quizId: "estimation-quiz",
      lessonId: "00-03-estimation",
      earnedPoints: 5,
      possiblePoints: 5,
      scorePercent: 100,
      passThresholdPercent: 80,
      passed: true,
      incorrectConceptTags: [],
    });
    expect(first.normalizedAnswers.map((item) => item.questionId)).toEqual([
      "q-fallback-choice",
      "q-multiple-choice",
      "q-numeric-estimation",
      "q-single-choice",
      "q-storage-estimation",
    ]);
    expect(first.normalizedAnswers[1]).toEqual({
      questionId: "q-multiple-choice",
      type: "multiple-choice",
      selectedOptionIds: ["choice-availability", "choice-consistency"],
    });
    expect(first.questionResults.every((result) => result.correct)).toBe(true);
    expect(first.questionResults.every((result) => result.explanation.length > 0)).toBe(true);
  });

  it("marks wrong and missing answers incorrect and deduplicates tags in sorted order", () => {
    const result = evaluateQuiz(createQuiz(), [
      answer("q-single-choice", "choice-late"),
      {
        questionId: "q-multiple-choice",
        type: "multiple-choice",
        selectedOptionIds: ["choice-consistency"],
      },
      {
        questionId: "q-numeric-estimation",
        type: "numeric-estimation",
        value: 90,
        unit: "QPS",
      },
      {
        questionId: "q-storage-estimation",
        type: "numeric-estimation",
        value: 10,
        unit: "GB",
      },
    ]);

    expect(result.earnedPoints).toBe(1);
    expect(result.scorePercent).toBe(20);
    expect(result.passed).toBe(false);
    expect(result.questionResults).toEqual([
      {
        questionId: "q-single-choice",
        correct: false,
        earnedPoints: 0,
        explanation: "Peak request rate is an input to capacity planning.",
        conceptTags: ["capacity", "trade-offs"],
      },
      {
        questionId: "q-multiple-choice",
        correct: false,
        earnedPoints: 0,
        explanation: "Rates, sizes, and retention are only meaningful with units.",
        conceptTags: ["units", "capacity"],
      },
      {
        questionId: "q-numeric-estimation",
        correct: false,
        earnedPoints: 0,
        explanation: "The estimate is accepted within the stated absolute tolerance.",
        conceptTags: ["capacity", "qps"],
      },
      {
        questionId: "q-fallback-choice",
        correct: false,
        earnedPoints: 0,
        explanation: "Visible assumptions make an estimate easy to revise.",
        conceptTags: ["capacity", "failure"],
      },
      {
        questionId: "q-storage-estimation",
        correct: true,
        earnedPoints: 1,
        explanation: "Retention multiplies daily writes by the retention window.",
        conceptTags: ["storage"],
      },
    ]);
    expect(result.normalizedAnswers.map((item) => item.questionId)).toEqual([
      "q-multiple-choice",
      "q-numeric-estimation",
      "q-single-choice",
      "q-storage-estimation",
    ]);
    expect(result.incorrectConceptTags).toEqual([
      "capacity",
      "failure",
      "qps",
      "trade-offs",
      "units",
    ]);
  });

  it("treats multiple-choice answers as exact unordered sets with no partial credit", () => {
    const correct = evaluateQuiz(createQuiz(), [
      {
        questionId: "q-multiple-choice",
        type: "multiple-choice",
        selectedOptionIds: ["choice-availability", "choice-consistency"],
      },
    ]);
    const partial = evaluateQuiz(createQuiz(), [
      {
        questionId: "q-multiple-choice",
        type: "multiple-choice",
        selectedOptionIds: ["choice-consistency"],
      },
    ]);
    const extra = evaluateQuiz(createQuiz(), [
      {
        questionId: "q-multiple-choice",
        type: "multiple-choice",
        selectedOptionIds: ["choice-availability", "choice-consistency", "choice-unrelated"],
      },
    ]);

    expect(correct.questionResults[1]).toMatchObject({ correct: true, earnedPoints: 1 });
    expect(partial.questionResults[1]).toMatchObject({ correct: false, earnedPoints: 0 });
    expect(extra.questionResults[1]).toMatchObject({ correct: false, earnedPoints: 0 });
  });

  it("uses inclusive absolute numeric tolerance and normalized exact units", () => {
    const atLowerBoundary = evaluateQuiz(createQuiz(), [
      {
        questionId: "q-numeric-estimation",
        type: "numeric-estimation",
        value: 95,
        unit: " qPs ",
      },
    ]);
    const atUpperBoundary = evaluateQuiz(createQuiz(), [
      {
        questionId: "q-numeric-estimation",
        type: "numeric-estimation",
        value: 105,
        unit: "QPS",
      },
    ]);
    const outsideBoundary = evaluateQuiz(createQuiz(), [
      {
        questionId: "q-numeric-estimation",
        type: "numeric-estimation",
        value: 105.01,
        unit: "QPS",
      },
    ]);
    const wrongUnit = evaluateQuiz(createQuiz(), [
      {
        questionId: "q-numeric-estimation",
        type: "numeric-estimation",
        value: 100,
        unit: "ms",
      },
    ]);

    expect(atLowerBoundary.questionResults[2]).toMatchObject({ correct: true, earnedPoints: 1 });
    expect(atUpperBoundary.questionResults[2]).toMatchObject({ correct: true, earnedPoints: 1 });
    expect(outsideBoundary.questionResults[2]).toMatchObject({ correct: false, earnedPoints: 0 });
    expect(wrongUnit.questionResults[2]).toMatchObject({ correct: false, earnedPoints: 0 });
  });

  it("passes exactly at the configured 80 percent boundary", () => {
    const result = evaluateQuiz(createQuiz(), [
      answer("q-single-choice", "choice-fast"),
      {
        questionId: "q-multiple-choice",
        type: "multiple-choice",
        selectedOptionIds: ["choice-consistency", "choice-availability"],
      },
      {
        questionId: "q-numeric-estimation",
        type: "numeric-estimation",
        value: 100,
        unit: "QPS",
      },
      answer("q-fallback-choice", "choice-safe"),
    ]);

    expect(result.earnedPoints).toBe(4);
    expect(result.possiblePoints).toBe(5);
    expect(result.scorePercent).toBe(80);
    expect(result.passThresholdPercent).toBe(80);
    expect(result.passed).toBe(true);
    expect(result.incorrectConceptTags).toEqual(["storage"]);
  });

  it("rejects malformed, duplicate, unknown, and mismatched answers", () => {
    expect(() => evaluateQuiz(createQuiz(), null as unknown as readonly QuizAnswer[])).toThrow(
      QuizValidationError,
    );
    expect(() =>
      evaluateQuiz(createQuiz(), [
        { questionId: "q-numeric-estimation", type: "numeric-estimation", value: Number.NaN, unit: "QPS" },
      ]),
    ).toThrow(QuizValidationError);
    expect(() =>
      evaluateQuiz(createQuiz(), [
        { questionId: "q-unknown", type: "single-choice", selectedOptionId: "choice-fast" },
      ]),
    ).toThrow(/unknown question ID/);
    expect(() =>
      evaluateQuiz(createQuiz(), [
        answer("q-single-choice", "choice-fast"),
        answer("q-single-choice", "choice-fast"),
      ]),
    ).toThrow(/duplicate answer/);
    expect(() =>
      evaluateQuiz(createQuiz(), [
        { questionId: "q-single-choice", type: "multiple-choice", selectedOptionIds: [] },
      ] as QuizAnswer[]),
    ).toThrow(/expected single-choice/);
    expect(() =>
      evaluateQuiz(createQuiz(), [answer("q-single-choice", "choice-unknown")]),
    ).toThrow(/unknown option ID/);
    expect(() =>
      evaluateQuiz(createQuiz(), [
        {
          questionId: "q-multiple-choice",
          type: "multiple-choice",
          selectedOptionIds: ["choice-consistency", "choice-consistency"],
        },
      ]),
    ).toThrow(QuizValidationError);
  });

  it("rejects invalid quiz definitions before evaluation", () => {
    const noQuestions = createQuiz({ questions: [] });
    expect(() => evaluateQuiz(noQuestions, [])).toThrow(/at least one question/);

    const missingExplanation = createQuiz();
    missingExplanation.questions[0] = {
      ...missingExplanation.questions[0],
      explanation: "",
    } as QuizQuestion;
    expect(() => evaluateQuiz(missingExplanation, [])).toThrow(/explanation/);

    const duplicateQuestionIds = createQuiz();
    duplicateQuestionIds.questions[1] = {
      ...duplicateQuestionIds.questions[1],
      id: duplicateQuestionIds.questions[0]!.id,
    } as QuizQuestion;
    expect(() => evaluateQuiz(duplicateQuestionIds, [])).toThrow(/duplicate value/);

    const duplicateConceptTags = createQuiz();
    duplicateConceptTags.questions[0] = {
      ...duplicateConceptTags.questions[0],
      conceptTags: ["capacity", "capacity"],
    } as QuizQuestion;
    expect(() => evaluateQuiz(duplicateConceptTags, [])).toThrow(/duplicate value/);
  });
});
