import { assertQuizAnswer, type QuizAnswer } from "@/domain/quiz";

import { ProgressValidationError } from "./errors";
import type { QuizAttempt } from "./model";
import { assertLessonId } from "./transitions";

const STABLE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertStableId(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !STABLE_ID_PATTERN.test(value)) {
    throw new ProgressValidationError(`${label} must be a lowercase, hyphen-delimited stable ID.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeAnswer(answer: QuizAnswer): QuizAnswer {
  if (answer.type === "multiple-choice") {
    return { ...answer, selectedOptionIds: [...answer.selectedOptionIds].sort() };
  }
  return { ...answer };
}

export function normalizeQuizAttempt(value: unknown): QuizAttempt {
  if (!isRecord(value)) throw new ProgressValidationError("Quiz attempt must be an object.");
  const expectedKeys = [
    "attemptId",
    "quizId",
    "lessonId",
    "answers",
    "earnedPoints",
    "possiblePoints",
    "scorePercent",
    "passed",
    "incorrectConceptTags",
  ];
  const keys = Object.keys(value);
  if (keys.length !== expectedKeys.length || keys.some((key) => !expectedKeys.includes(key))) {
    throw new ProgressValidationError(`Quiz attempt must contain only: ${expectedKeys.join(", ")}.`);
  }

  assertStableId(value.attemptId, "Quiz attempt ID");
  assertStableId(value.quizId, "Quiz ID");
  assertLessonId(value.lessonId);
  if (!Array.isArray(value.answers)) throw new ProgressValidationError("Quiz attempt answers must be an array.");
  const seenQuestionIds = new Set<string>();
  const answers = value.answers.map((answer) => {
    try {
      assertQuizAnswer(answer);
    } catch (cause) {
      throw new ProgressValidationError(
        `Quiz attempt contains a malformed answer: ${cause instanceof Error ? cause.message : String(cause)}`,
        { cause },
      );
    }
    if (seenQuestionIds.has(answer.questionId)) {
      throw new ProgressValidationError(`Quiz attempt contains duplicate answer for ${answer.questionId}.`);
    }
    seenQuestionIds.add(answer.questionId);
    return normalizeAnswer(answer);
  }).sort((left, right) => left.questionId.localeCompare(right.questionId));

  if (!Number.isInteger(value.earnedPoints) || (value.earnedPoints as number) < 0) {
    throw new ProgressValidationError("Quiz attempt earned points must be a non-negative integer.");
  }
  if (!Number.isInteger(value.possiblePoints) || (value.possiblePoints as number) <= 0) {
    throw new ProgressValidationError("Quiz attempt possible points must be a positive integer.");
  }
  if ((value.earnedPoints as number) > (value.possiblePoints as number)) {
    throw new ProgressValidationError("Quiz attempt earned points cannot exceed possible points.");
  }
  const expectedScore = ((value.earnedPoints as number) / (value.possiblePoints as number)) * 100;
  if (
    typeof value.scorePercent !== "number" ||
    !Number.isFinite(value.scorePercent) ||
    Math.abs(value.scorePercent - expectedScore) > Number.EPSILON * 100
  ) {
    throw new ProgressValidationError("Quiz attempt score percent does not match its points.");
  }
  if (typeof value.passed !== "boolean") {
    throw new ProgressValidationError("Quiz attempt passed must be boolean.");
  }
  if (!Array.isArray(value.incorrectConceptTags)) {
    throw new ProgressValidationError("Quiz attempt incorrect concept tags must be an array.");
  }
  const incorrectConceptTags = new Set<string>();
  for (const tag of value.incorrectConceptTags) {
    assertStableId(tag, "Incorrect concept tag");
    incorrectConceptTags.add(tag);
  }

  return {
    attemptId: value.attemptId,
    quizId: value.quizId,
    lessonId: value.lessonId,
    answers,
    earnedPoints: value.earnedPoints as number,
    possiblePoints: value.possiblePoints as number,
    scorePercent: value.scorePercent,
    passed: value.passed,
    incorrectConceptTags: [...incorrectConceptTags].sort(),
  };
}

export function quizAttemptsEqual(left: QuizAttempt, right: QuizAttempt): boolean {
  return JSON.stringify(normalizeQuizAttempt(left)) === JSON.stringify(normalizeQuizAttempt(right));
}
