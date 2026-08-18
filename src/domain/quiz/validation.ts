import { QuizValidationError } from "./errors";
import type { QuizAnswer, QuizDefinition, QuizOption, QuizQuestion } from "./model";

const STABLE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertOnlyKeys(record: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(record);
  if (actual.length !== expected.length || actual.some((key) => !expected.includes(key))) {
    throw new QuizValidationError(`${label} must contain only: ${expected.join(", ")}.`);
  }
}

function assertStableId(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !STABLE_ID_PATTERN.test(value)) {
    throw new QuizValidationError(`${label} must be a lowercase, hyphen-delimited stable ID.`);
  }
}

function assertNonEmptyText(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new QuizValidationError(`${label} must be a non-empty string.`);
  }
}

function assertUniqueStrings(values: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new QuizValidationError(`${label} contains duplicate value: ${value}.`);
    seen.add(value);
  }
}

function assertOptions(options: unknown, questionId: string): asserts options is QuizOption[] {
  if (!Array.isArray(options) || options.length < 2) {
    throw new QuizValidationError(`Question ${questionId} must provide at least two options.`);
  }
  const ids: string[] = [];
  for (const option of options) {
    if (!isRecord(option)) throw new QuizValidationError(`Question ${questionId} has a malformed option.`);
    assertOnlyKeys(option, ["id", "label"], `Question ${questionId} option`);
    assertStableId(option.id, `Question ${questionId} option ID`);
    assertNonEmptyText(option.label, `Question ${questionId} option label`);
    ids.push(option.id);
  }
  assertUniqueStrings(ids, `Question ${questionId} option IDs`);
}

export function assertQuizQuestion(value: unknown): asserts value is QuizQuestion {
  if (!isRecord(value)) throw new QuizValidationError("Quiz question must be an object.");
  assertStableId(value.id, "Quiz question ID");
  assertStableId(value.lessonId, `Question ${value.id} lesson ID`);
  assertNonEmptyText(value.prompt, `Question ${value.id} prompt`);
  assertNonEmptyText(value.explanation, `Question ${value.id} explanation`);
  if (!Array.isArray(value.conceptTags) || value.conceptTags.length === 0) {
    throw new QuizValidationError(`Question ${value.id} must have at least one concept tag.`);
  }
  for (const tag of value.conceptTags) assertStableId(tag, `Question ${value.id} concept tag`);
  assertUniqueStrings(value.conceptTags, `Question ${value.id} concept tags`);

  if (value.type === "single-choice") {
    assertOnlyKeys(value, ["id", "lessonId", "type", "prompt", "options", "correctOptionId", "explanation", "conceptTags"], `Question ${value.id}`);
    assertOptions(value.options, value.id);
    assertStableId(value.correctOptionId, `Question ${value.id} correct option ID`);
    if (!value.options.some((option) => option.id === value.correctOptionId)) {
      throw new QuizValidationError(`Question ${value.id} correct option is not present in its options.`);
    }
    return;
  }

  if (value.type === "multiple-choice") {
    assertOnlyKeys(value, ["id", "lessonId", "type", "prompt", "options", "correctOptionIds", "explanation", "conceptTags"], `Question ${value.id}`);
    assertOptions(value.options, value.id);
    if (!Array.isArray(value.correctOptionIds) || value.correctOptionIds.length === 0) {
      throw new QuizValidationError(`Question ${value.id} must have at least one correct option.`);
    }
    for (const id of value.correctOptionIds) {
      assertStableId(id, `Question ${value.id} correct option ID`);
      if (!value.options.some((option) => option.id === id)) {
        throw new QuizValidationError(`Question ${value.id} correct option ${id} is not present in its options.`);
      }
    }
    assertUniqueStrings(value.correctOptionIds, `Question ${value.id} correct option IDs`);
    return;
  }

  if (value.type === "numeric-estimation") {
    assertOnlyKeys(value, ["id", "lessonId", "type", "prompt", "correctValue", "tolerance", "unit", "explanation", "conceptTags"], `Question ${value.id}`);
    if (typeof value.correctValue !== "number" || !Number.isFinite(value.correctValue)) {
      throw new QuizValidationError(`Question ${value.id} correct value must be finite.`);
    }
    if (!isRecord(value.tolerance) || value.tolerance.kind !== "absolute") {
      throw new QuizValidationError(`Question ${value.id} must use an absolute numeric tolerance.`);
    }
    if (
      typeof value.tolerance.value !== "number" ||
      !Number.isFinite(value.tolerance.value) ||
      value.tolerance.value < 0
    ) {
      throw new QuizValidationError(`Question ${value.id} tolerance must be a finite non-negative number.`);
    }
    assertNonEmptyText(value.unit, `Question ${value.id} unit`);
    return;
  }

  throw new QuizValidationError(`Question ${value.id} has unsupported type: ${String(value.type)}.`);
}

export function assertQuizDefinition(value: unknown): asserts value is QuizDefinition {
  if (!isRecord(value)) throw new QuizValidationError("Quiz definition must be an object.");
  assertOnlyKeys(value, ["id", "lessonId", "title", "passThresholdPercent", "questions"], "Quiz definition");
  assertStableId(value.id, "Quiz ID");
  assertStableId(value.lessonId, `Quiz ${value.id} lesson ID`);
  assertNonEmptyText(value.title, `Quiz ${value.id} title`);
  if (
    typeof value.passThresholdPercent !== "number" ||
    !Number.isFinite(value.passThresholdPercent) ||
    value.passThresholdPercent < 0 ||
    value.passThresholdPercent > 100
  ) {
    throw new QuizValidationError(`Quiz ${value.id} pass threshold must be between 0 and 100.`);
  }
  if (!Array.isArray(value.questions) || value.questions.length === 0) {
    throw new QuizValidationError(`Quiz ${value.id} must contain at least one question.`);
  }
  const questionIds: string[] = [];
  for (const question of value.questions) {
    assertQuizQuestion(question);
    if (question.lessonId !== value.lessonId) {
      throw new QuizValidationError(
        `Question ${question.id} belongs to ${question.lessonId}, not quiz lesson ${value.lessonId}.`,
      );
    }
    questionIds.push(question.id);
  }
  assertUniqueStrings(questionIds, `Quiz ${value.id} question IDs`);
}

export function assertQuizAnswer(value: unknown): asserts value is QuizAnswer {
  if (!isRecord(value)) throw new QuizValidationError("Quiz answer must be an object.");
  assertStableId(value.questionId, "Quiz answer question ID");
  if (value.type === "single-choice") {
    assertOnlyKeys(value, ["questionId", "type", "selectedOptionId"], `Answer for ${value.questionId}`);
    assertStableId(value.selectedOptionId, `Answer for ${value.questionId} selected option`);
    return;
  }
  if (value.type === "multiple-choice") {
    assertOnlyKeys(value, ["questionId", "type", "selectedOptionIds"], `Answer for ${value.questionId}`);
    if (!Array.isArray(value.selectedOptionIds)) {
      throw new QuizValidationError(`Answer for ${value.questionId} must contain selected option IDs.`);
    }
    for (const id of value.selectedOptionIds) assertStableId(id, `Answer for ${value.questionId} selected option`);
    assertUniqueStrings(value.selectedOptionIds, `Answer for ${value.questionId} selected option IDs`);
    return;
  }
  if (value.type === "numeric-estimation") {
    assertOnlyKeys(value, ["questionId", "type", "value", "unit"], `Answer for ${value.questionId}`);
    if (typeof value.value !== "number" || !Number.isFinite(value.value)) {
      throw new QuizValidationError(`Answer for ${value.questionId} must contain a finite numeric value.`);
    }
    assertNonEmptyText(value.unit, `Answer for ${value.questionId} unit`);
    return;
  }
  throw new QuizValidationError(`Answer for ${value.questionId} has unsupported type: ${String(value.type)}.`);
}
