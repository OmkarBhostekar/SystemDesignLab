import { QuizValidationError } from "./errors";
import {
  assertQuizAnswer,
  assertQuizDefinition,
} from "./validation";
import type {
  MultipleChoiceQuestion,
  NumericEstimationAnswer,
  NumericEstimationQuestion,
  QuizAnswer,
  QuizDefinition,
  QuizEvaluation,
  QuizQuestion,
  QuizQuestionResult,
  SingleChoiceQuestion,
} from "./model";

/**
 * Evaluate a quiz without depending on React, browser APIs, or persistence.
 *
 * Answers are normalized only for persistence/replay concerns: answer records
 * are returned in question-ID order and multiple-choice option IDs are sorted.
 * Numeric unit normalization is used for comparison, but the submitted unit
 * is retained in the normalized answer so the learner's input remains visible
 * to a caller that wants to render or store it.
 */
export function evaluateQuiz(
  quiz: QuizDefinition,
  answers: readonly QuizAnswer[],
): QuizEvaluation {
  // Validate the complete quiz before inspecting answers. This prevents a
  // malformed definition from producing a misleading partial evaluation.
  assertQuizDefinition(quiz);
  assertAnswerList(answers);

  const questionsById = new Map(quiz.questions.map((question) => [question.id, question]));
  const answersByQuestionId = new Map<string, QuizAnswer>();

  for (const rawAnswer of answers) {
    assertQuizAnswer(rawAnswer);
    const answer = rawAnswer;

    if (answersByQuestionId.has(answer.questionId)) {
      throw new QuizValidationError(
        `Quiz answers contain a duplicate answer for question ${answer.questionId}.`,
      );
    }

    const question = questionsById.get(answer.questionId);
    if (!question) {
      throw new QuizValidationError(
        `Quiz answer references unknown question ID: ${answer.questionId}.`,
      );
    }

    assertAnswerMatchesQuestion(question, answer);
    answersByQuestionId.set(answer.questionId, answer);
  }

  const questionResults = quiz.questions.map((question) =>
    evaluateQuestion(question, answersByQuestionId.get(question.id)),
  );
  const earnedPoints = questionResults.reduce(
    (total, result) => total + result.earnedPoints,
    0,
  );
  const possiblePoints = quiz.questions.length;
  const scorePercent = (earnedPoints / possiblePoints) * 100;

  return {
    quizId: quiz.id,
    lessonId: quiz.lessonId,
    earnedPoints,
    possiblePoints,
    scorePercent,
    passThresholdPercent: quiz.passThresholdPercent,
    passed: scorePercent >= quiz.passThresholdPercent,
    questionResults,
    incorrectConceptTags: collectIncorrectConceptTags(quiz.questions, questionResults),
    normalizedAnswers: [...answersByQuestionId.values()]
      .map(normalizeAnswer)
      .sort(compareAnswers),
  };
}

function assertAnswerList(value: unknown): asserts value is readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new QuizValidationError("Quiz answers must be an array.");
  }
}

function assertAnswerMatchesQuestion(question: QuizQuestion, answer: QuizAnswer): void {
  if (question.type !== answer.type) {
    throw new QuizValidationError(
      `Answer for question ${question.id} has type ${answer.type}, expected ${question.type}.`,
    );
  }

  if (question.type === "single-choice" && answer.type === "single-choice") {
    assertOptionExists(question, answer.selectedOptionId);
    return;
  }

  if (question.type === "multiple-choice" && answer.type === "multiple-choice") {
    for (const optionId of answer.selectedOptionIds) assertOptionExists(question, optionId);
    return;
  }
}

function assertOptionExists(
  question: SingleChoiceQuestion | MultipleChoiceQuestion,
  optionId: string,
): void {
  if (!question.options.some((option) => option.id === optionId)) {
    throw new QuizValidationError(
      `Answer for question ${question.id} references unknown option ID: ${optionId}.`,
    );
  }
}

function evaluateQuestion(
  question: QuizQuestion,
  answer: QuizAnswer | undefined,
): QuizQuestionResult {
  const correct = answer !== undefined && isCorrectAnswer(question, answer);
  return {
    questionId: question.id,
    correct,
    earnedPoints: correct ? 1 : 0,
    explanation: question.explanation,
    conceptTags: [...question.conceptTags],
  };
}

function isCorrectAnswer(question: QuizQuestion, answer: QuizAnswer): boolean {
  if (question.type === "single-choice" && answer.type === "single-choice") {
    return question.correctOptionId === answer.selectedOptionId;
  }

  if (question.type === "multiple-choice" && answer.type === "multiple-choice") {
    return areExactSetsEqual(question.correctOptionIds, answer.selectedOptionIds);
  }

  if (question.type === "numeric-estimation" && answer.type === "numeric-estimation") {
    return isNumericAnswerCorrect(question, answer);
  }

  // `assertAnswerMatchesQuestion` rejects this combination before evaluation.
  return false;
}

function areExactSetsEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function isNumericAnswerCorrect(
  question: NumericEstimationQuestion,
  answer: NumericEstimationAnswer,
): boolean {
  const unitMatches = normalizeUnit(question.unit) === normalizeUnit(answer.unit);
  const withinTolerance =
    Math.abs(answer.value - question.correctValue) <= question.tolerance.value;
  return unitMatches && withinTolerance;
}

function normalizeUnit(unit: string): string {
  return unit.trim().toLowerCase();
}

function normalizeAnswer(answer: QuizAnswer): QuizAnswer {
  if (answer.type === "multiple-choice") {
    return {
      ...answer,
      selectedOptionIds: [...answer.selectedOptionIds].sort(compareStrings),
    };
  }
  return { ...answer };
}

function compareAnswers(left: QuizAnswer, right: QuizAnswer): number {
  return compareStrings(left.questionId, right.questionId);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function collectIncorrectConceptTags(
  questions: readonly QuizQuestion[],
  results: readonly QuizQuestionResult[],
): string[] {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const tags = new Set<string>();

  for (const result of results) {
    if (result.correct) continue;
    const question = questionById.get(result.questionId);
    if (!question) continue;
    for (const tag of question.conceptTags) tags.add(tag);
  }

  return [...tags].sort(compareStrings);
}
