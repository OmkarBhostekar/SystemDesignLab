import {
  QuizValidationError,
  assertQuizDefinition,
  type QuizDefinition,
} from "@/domain/quiz";

import { quizzes } from "./quizzes";

const registry = createQuizRegistry(quizzes);

export function createQuizRegistry(definitions: readonly QuizDefinition[]): ReadonlyMap<string, QuizDefinition> {
  const next = new Map<string, QuizDefinition>();
  const questionIds = new Set<string>();
  for (const definition of definitions) {
    assertQuizDefinition(definition);
    if (next.has(definition.id)) throw new QuizValidationError(`Duplicate quiz ID: ${definition.id}.`);
    for (const question of definition.questions) {
      if (questionIds.has(question.id)) {
        throw new QuizValidationError(`Duplicate question ID across quiz registry: ${question.id}.`);
      }
      questionIds.add(question.id);
    }
    next.set(definition.id, definition);
  }
  return next;
}
export function assertQuizRegistryLessonIds(lessonIds: Iterable<string>): void {
  const known = new Set(lessonIds);
  for (const quiz of registry.values()) {
    if (!known.has(quiz.lessonId)) {
      throw new QuizValidationError(`Quiz ${quiz.id} references unknown lesson ID: ${quiz.lessonId}.`);
    }
  }
}

export function getQuiz(quizId: string | null | undefined): QuizDefinition | null {
  return quizId ? registry.get(quizId) ?? null : null;
}

export function listQuizIds(): string[] {
  return [...registry.keys()].sort();
}

export function listQuizzes(): QuizDefinition[] {
  return [...registry.values()].sort((left, right) => left.id.localeCompare(right.id));
}
