import { ProgressValidationError } from "./errors";
import type { ProgressResetScope } from "./model";
import { assertLessonId } from "./transitions";

export type NormalizedProgressResetScope =
  | { kind: "all" }
  | { kind: "lessons"; lessonIds: string[] };

export function normalizeProgressResetScope(
  scope: ProgressResetScope,
): NormalizedProgressResetScope {
  if (typeof scope !== "object" || scope === null || Array.isArray(scope)) {
    throw new ProgressValidationError("Progress reset scope must be an object.");
  }

  const keys = Object.keys(scope);
  if (scope.kind === "all") {
    if (keys.length !== 1) {
      throw new ProgressValidationError('The "all" progress reset scope cannot select lessons.');
    }
    return { kind: "all" };
  }

  if (
    scope.kind !== "lessons" ||
    keys.length !== 2 ||
    !keys.includes("lessonIds") ||
    !Array.isArray(scope.lessonIds)
  ) {
    throw new ProgressValidationError(
      'Progress reset scope must be { kind: "all" } or { kind: "lessons", lessonIds }.',
    );
  }

  const lessonIds = new Set<string>();
  for (const lessonId of scope.lessonIds) {
    assertLessonId(lessonId);
    lessonIds.add(lessonId);
  }
  return { kind: "lessons", lessonIds: [...lessonIds].sort() };
}
