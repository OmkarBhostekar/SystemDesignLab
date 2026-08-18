import {
  PROGRESS_EXPORT_FORMAT,
  PROGRESS_EXPORT_VERSION,
  ProgressValidationError,
  UnsupportedProgressVersionError,
  assertLessonId,
  assertLessonProgress,
  isLessonProgressStage,
  type LessonProgress,
  type ProgressExport,
  type QuizAttempt,
  normalizeQuizAttempt,
} from "@/domain/progress";

interface LegacyProgressExportV1 {
  schemaVersion: 1;
  lessons: Record<string, unknown>;
}

interface LegacyProgressExportV2 {
  format: typeof PROGRESS_EXPORT_FORMAT;
  schemaVersion: 2;
  lessons: LessonProgress[];
}

export interface NormalizedProgressImport {
  lessons: LessonProgress[];
  quizAttempts: QuizAttempt[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertOnlyKeys(record: Record<string, unknown>, expected: readonly string[]): void {
  const actual = Object.keys(record);
  if (actual.length !== expected.length || actual.some((key) => !expected.includes(key))) {
    throw new ProgressValidationError(
      `Progress export must contain only: ${expected.join(", ")}.`,
    );
  }
}

function parseJsonInput(data: unknown): unknown {
  if (typeof data !== "string") return data;
  try {
    return JSON.parse(data) as unknown;
  } catch (error) {
    throw new ProgressValidationError("Progress import is not valid JSON.", { cause: error });
  }
}

function normalizeLessons(lessons: unknown): LessonProgress[] {
  if (!Array.isArray(lessons)) {
    throw new ProgressValidationError("Progress export lessons must be an array.");
  }

  const seenLessonIds = new Set<string>();
  const normalized = lessons.map((lesson) => {
    assertLessonProgress(lesson);
    if (seenLessonIds.has(lesson.lessonId)) {
      throw new ProgressValidationError(
        `Progress export contains duplicate lesson ID: ${lesson.lessonId}.`,
      );
    }
    seenLessonIds.add(lesson.lessonId);
    return { ...lesson };
  });
  return normalized.sort((left, right) => left.lessonId.localeCompare(right.lessonId));
}

function migrateVersionOne(data: Record<string, unknown>): LessonProgress[] {
  assertOnlyKeys(data, ["schemaVersion", "lessons"]);
  const legacy = data as unknown as LegacyProgressExportV1;
  if (!isRecord(legacy.lessons)) {
    throw new ProgressValidationError("Version 1 progress lessons must be an object.");
  }

  const migrated: LessonProgress[] = [];
  for (const [lessonId, stage] of Object.entries(legacy.lessons)) {
    assertLessonId(lessonId);
    if (!isLessonProgressStage(stage)) {
      throw new ProgressValidationError(
        `Version 1 progress contains an unknown stage for ${lessonId}.`,
      );
    }
    migrated.push({ lessonId, stage });
  }
  return migrated.sort((left, right) => left.lessonId.localeCompare(right.lessonId));
}

function normalizeQuizAttempts(attempts: unknown): QuizAttempt[] {
  if (!Array.isArray(attempts)) {
    throw new ProgressValidationError("Progress export quizAttempts must be an array.");
  }
  const seenAttemptIds = new Set<string>();
  return attempts.map((attempt) => {
    const normalized = normalizeQuizAttempt(attempt);
    if (seenAttemptIds.has(normalized.attemptId)) {
      throw new ProgressValidationError(
        `Progress export contains duplicate quiz attempt ID: ${normalized.attemptId}.`,
      );
    }
    seenAttemptIds.add(normalized.attemptId);
    return normalized;
  }).sort((left, right) => left.attemptId.localeCompare(right.attemptId));
}

export function createProgressExport(
  lessons: readonly LessonProgress[],
  quizAttempts: readonly QuizAttempt[],
): ProgressExport {
  return {
    format: PROGRESS_EXPORT_FORMAT,
    schemaVersion: PROGRESS_EXPORT_VERSION,
    lessons: normalizeLessons(lessons),
    quizAttempts: normalizeQuizAttempts(quizAttempts),
  };
}

export function normalizeProgressImport(data: unknown): NormalizedProgressImport {
  const parsed = parseJsonInput(data);
  if (!isRecord(parsed)) {
    throw new ProgressValidationError("Progress import must be a JSON object.");
  }

  if (parsed.schemaVersion === 1) {
    return { lessons: migrateVersionOne(parsed), quizAttempts: [] };
  }
  if (parsed.schemaVersion === 2) {
    assertOnlyKeys(parsed, ["format", "schemaVersion", "lessons"]);
    const legacy = parsed as unknown as LegacyProgressExportV2;
    if (legacy.format !== PROGRESS_EXPORT_FORMAT) {
      throw new ProgressValidationError("Progress export format is not recognized.");
    }
    return { lessons: normalizeLessons(legacy.lessons), quizAttempts: [] };
  }
  if (parsed.schemaVersion !== PROGRESS_EXPORT_VERSION) {
    throw new UnsupportedProgressVersionError(parsed.schemaVersion);
  }

  assertOnlyKeys(parsed, ["format", "schemaVersion", "lessons", "quizAttempts"]);
  if (parsed.format !== PROGRESS_EXPORT_FORMAT) {
    throw new ProgressValidationError("Progress export format is not recognized.");
  }
  return {
    lessons: normalizeLessons(parsed.lessons),
    quizAttempts: normalizeQuizAttempts(parsed.quizAttempts),
  };
}
