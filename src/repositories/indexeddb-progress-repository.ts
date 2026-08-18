import {
  advanceLessonProgress,
  assertLessonId,
  assertLessonProgress,
  isLessonProgressMilestone,
  mergeLessonProgress,
  normalizeProgressResetScope,
  normalizeQuizAttempt,
  quizAttemptsEqual,
  ProgressStorageError,
  ProgressValidationError,
  type LessonProgress,
  type ProgressExport,
  type ProgressRepository,
  type ProgressResetScope,
  type QuizAttempt,
} from "@/domain/progress";
import { createProgressExport, normalizeProgressImport } from "@/repositories/progress-serialization";

/**
 * The initial database version reserves the earlier test/migration boundary.
 * IndexedDB versions evolve separately from the data envelope: a future
 * schema can be migrated in `onupgradeneeded` without changing the repository
 * contract or the exported format.
 */
export const INDEXED_DB_PROGRESS_DATABASE_NAME = "system-design-visual-learning-lab-progress";
export const INDEXED_DB_PROGRESS_DATABASE_VERSION = 3;
export const INDEXED_DB_PROGRESS_STORE_NAME = "lesson-progress";
export const INDEXED_DB_QUIZ_ATTEMPT_STORE_NAME = "quiz-attempts";

const LESSON_PROGRESS_KEY_PATH = "lessonId";
const QUIZ_ATTEMPT_KEY_PATH = "attemptId";

export interface IndexedDbProgressRepositoryOptions {
  /** Inject a factory in tests or browser integrations. Resolution is lazy. */
  indexedDB?: IDBFactory;
  /** Alias accepted for callers that name the dependency after its type. */
  idbFactory?: IDBFactory;
  /** Allows tests and embedded clients to isolate their local database. */
  databaseName?: string;
}

function isIdbFactory(value: unknown): value is IDBFactory {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { open?: unknown }).open === "function"
  );
}

function errorMessage(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message || cause.name || "Unknown error.";
  }
  if (typeof cause === "string" && cause.length > 0) return cause;
  return "Unknown IndexedDB error.";
}

function storageFailure(operation: string, phase: string, cause: unknown): ProgressStorageError {
  if (cause instanceof ProgressStorageError) return cause;
  return new ProgressStorageError(
    operation,
    `IndexedDB ${operation} failed during ${phase}: ${errorMessage(cause)}`,
    { cause },
  );
}

function rejectFailure(
  reject: (reason?: unknown) => void,
  operation: string,
  phase: string,
  cause: unknown,
): void {
  if (cause instanceof ProgressStorageError || cause instanceof ProgressValidationError) {
    reject(cause);
    return;
  }
  reject(storageFailure(operation, phase, cause));
}

function cloneProgress(progress: LessonProgress): LessonProgress {
  return { lessonId: progress.lessonId, stage: progress.stage };
}

function cloneProgressList(progress: readonly LessonProgress[]): LessonProgress[] {
  return progress.map(cloneProgress);
}

function sortProgress(progress: LessonProgress[]): LessonProgress[] {
  return progress.sort((left, right) => left.lessonId.localeCompare(right.lessonId));
}

function readStoredProgress(value: unknown): LessonProgress {
  assertLessonProgress(value);
  return cloneProgress(value);
}

function readStoredQuizAttempt(value: unknown): QuizAttempt {
  return normalizeQuizAttempt(value);
}

/**
 * IndexedDB-backed implementation of the local progress contract.
 *
 * No browser object is touched by construction. This matters for Next.js
 * server rendering and also makes a missing browser API an ordinary, testable
 * storage failure at the first repository operation.
 */
export class IndexedDbProgressRepository implements ProgressRepository {
  private readonly indexedDB?: IDBFactory;
  private readonly databaseName: string;

  constructor(options?: IndexedDbProgressRepositoryOptions | IDBFactory) {
    if (isIdbFactory(options)) {
      this.indexedDB = options;
      this.databaseName = INDEXED_DB_PROGRESS_DATABASE_NAME;
      return;
    }

    this.indexedDB = options?.indexedDB ?? options?.idbFactory;
    this.databaseName = options?.databaseName ?? INDEXED_DB_PROGRESS_DATABASE_NAME;
  }

  async getLessonProgress(lessonId: string): Promise<LessonProgress | null> {
    assertLessonId(lessonId);
    return this.withDatabase("getLessonProgress", (database) =>
      this.runGetTransaction(database, "getLessonProgress", lessonId),
    );
  }

  async listLessonProgress(): Promise<LessonProgress[]> {
    return this.withDatabase("listLessonProgress", (database) =>
      this.runListTransaction(database, "listLessonProgress"),
    );
  }

  async saveLessonProgress(progress: LessonProgress): Promise<LessonProgress> {
    assertLessonProgress(progress);
    const incoming = cloneProgress(progress);
    return this.withDatabase("saveLessonProgress", (database) =>
      this.runMonotonicTransaction(database, "saveLessonProgress", incoming.lessonId, (current) =>
        mergeLessonProgress(current, incoming),
      ),
    );
  }

  async applyLessonMilestone(
    lessonId: string,
    milestone: Parameters<ProgressRepository["applyLessonMilestone"]>[1],
  ): Promise<LessonProgress> {
    assertLessonId(lessonId);
    if (!isLessonProgressMilestone(milestone)) {
      throw new ProgressValidationError(`Unknown lesson progress milestone: ${String(milestone)}.`);
    }

    return this.withDatabase("applyLessonMilestone", (database) =>
      this.runMonotonicTransaction(database, "applyLessonMilestone", lessonId, (current) =>
        advanceLessonProgress(current, lessonId, milestone),
      ),
    );
  }

  async getQuizAttempt(attemptId: string): Promise<QuizAttempt | null> {
    const normalizedId = normalizeQuizAttempt({
      attemptId,
      quizId: "attempt-id-probe",
      lessonId: "attempt-id-probe",
      answers: [],
      earnedPoints: 0,
      possiblePoints: 1,
      scorePercent: 0,
      passed: false,
      incorrectConceptTags: [],
    }).attemptId;
    return this.withDatabase("getQuizAttempt", (database) =>
      this.runGetAttemptTransaction(database, "getQuizAttempt", normalizedId),
    );
  }

  async listQuizAttempts(): Promise<QuizAttempt[]> {
    return this.withDatabase("listQuizAttempts", (database) =>
      this.runListAttemptsTransaction(database, "listQuizAttempts"),
    );
  }

  async saveQuizAttempt(attempt: QuizAttempt): Promise<QuizAttempt> {
    const normalized = normalizeQuizAttempt(attempt);
    return this.withDatabase("saveQuizAttempt", (database) =>
      this.runSaveAttemptTransaction(database, "saveQuizAttempt", normalized),
    );
  }

  async exportProgress(): Promise<ProgressExport> {
    return this.withDatabase("exportProgress", async (database) => {
      const [lessons, quizAttempts] = await Promise.all([
        this.runListTransaction(database, "exportProgress"),
        this.runListAttemptsTransaction(database, "exportProgress"),
      ]);
      return createProgressExport(lessons, quizAttempts);
    });
  }

  async importProgress(data: unknown): Promise<void> {
    // This must happen before opening IndexedDB or beginning a transaction.
    // Invalid data therefore cannot clear or partially replace existing data.
    const normalized = normalizeProgressImport(data);
    await this.withDatabase("importProgress", (database) =>
      this.runReplaceTransaction(
        database,
        "importProgress",
        normalized.lessons,
        normalized.quizAttempts,
      ),
    );
  }

  async resetProgress(scope: ProgressResetScope): Promise<void> {
    const normalizedScope = normalizeProgressResetScope(scope);
    await this.withDatabase("resetProgress", (database) =>
      this.runResetTransaction(database, "resetProgress", normalizedScope),
    );
  }

  private resolveFactory(operation: string): IDBFactory {
    const globalObject =
      typeof globalThis === "undefined"
        ? undefined
        : (globalThis as typeof globalThis & { indexedDB?: IDBFactory });
    const factory = this.indexedDB ?? globalObject?.indexedDB;
    if (!factory || typeof factory.open !== "function") {
      throw new ProgressStorageError(
        operation,
        "IndexedDB is unavailable. Provide an IDBFactory or run this repository in a browser with IndexedDB enabled.",
      );
    }
    return factory;
  }

  private openDatabase(operation: string): Promise<IDBDatabase> {
    let factory: IDBFactory;
    try {
      factory = this.resolveFactory(operation);
    } catch (cause) {
      return Promise.reject(cause);
    }

    return new Promise<IDBDatabase>((resolve, reject) => {
      let settled = false;
      let request: IDBOpenDBRequest;

      const fail = (phase: string, cause: unknown) => {
        if (settled) return;
        settled = true;
        rejectFailure(reject, operation, phase, cause);
      };

      try {
        request = factory.open(this.databaseName, INDEXED_DB_PROGRESS_DATABASE_VERSION);
      } catch (cause) {
        fail("opening the database", cause);
        return;
      }

      request.onerror = () => {
        fail("opening the database", request.error ?? new Error("The open request failed."));
      };
      request.onblocked = () => {
        fail("opening the database", new Error("The open request was blocked by another connection."));
      };
      request.onupgradeneeded = () => {
        try {
          const database = request.result;
          if (!database.objectStoreNames.contains(INDEXED_DB_PROGRESS_STORE_NAME)) {
            database.createObjectStore(INDEXED_DB_PROGRESS_STORE_NAME, {
              keyPath: LESSON_PROGRESS_KEY_PATH,
            });
          }
          const transaction = request.transaction;
          const lessonStore = transaction?.objectStore(INDEXED_DB_PROGRESS_STORE_NAME);
          if (lessonStore && lessonStore.keyPath !== LESSON_PROGRESS_KEY_PATH) {
            throw new Error(
              `The ${INDEXED_DB_PROGRESS_STORE_NAME} store has an incompatible key path.`,
            );
          }
          if (!database.objectStoreNames.contains(INDEXED_DB_QUIZ_ATTEMPT_STORE_NAME)) {
            database.createObjectStore(INDEXED_DB_QUIZ_ATTEMPT_STORE_NAME, {
              keyPath: QUIZ_ATTEMPT_KEY_PATH,
            });
          }
          const attemptStore = transaction?.objectStore(INDEXED_DB_QUIZ_ATTEMPT_STORE_NAME);
          if (attemptStore && attemptStore.keyPath !== QUIZ_ATTEMPT_KEY_PATH) {
            throw new Error(
              `The ${INDEXED_DB_QUIZ_ATTEMPT_STORE_NAME} store has an incompatible key path.`,
            );
          }
        } catch (cause) {
          try {
            request.transaction?.abort();
          } catch {
            // The request's error/abort event is still the authoritative failure.
          }
          fail("upgrading the database", cause);
        }
      };
      request.onsuccess = () => {
        if (settled) {
          request.result.close();
          return;
        }
        settled = true;
        const database = request.result;
        database.onversionchange = () => database.close();
        resolve(database);
      };
    });
  }

  private async withDatabase<T>(
    operation: string,
    callback: (database: IDBDatabase) => Promise<T>,
  ): Promise<T> {
    let database: IDBDatabase | undefined;
    try {
      database = await this.openDatabase(operation);
      return await callback(database);
    } catch (cause) {
      if (cause instanceof ProgressStorageError || cause instanceof ProgressValidationError) {
        throw cause;
      }
      throw storageFailure(operation, "completing the operation", cause);
    } finally {
      try {
        database?.close();
      } catch {
        // Closing an already closed database is harmless and should not mask
        // the operation's actual result.
      }
    }
  }

  private runGetTransaction(
    database: IDBDatabase,
    operation: string,
    lessonId: string,
  ): Promise<LessonProgress | null> {
    return new Promise<LessonProgress | null>((resolve, reject) => {
      let transaction: IDBTransaction | undefined;
      let result: LessonProgress | null = null;
      let settled = false;

      const fail = (phase: string, cause: unknown) => {
        if (settled) return;
        settled = true;
        try {
          transaction?.abort();
        } catch {
          // The original failure is more useful than an abort-after-failure error.
        }
        rejectFailure(reject, operation, phase, cause);
      };

      try {
        transaction = database.transaction(INDEXED_DB_PROGRESS_STORE_NAME, "readonly");
        transaction.onerror = () => {
          fail("the transaction", transaction?.error ?? new Error("The transaction failed."));
        };
        transaction.onabort = () => {
          fail("the transaction", transaction?.error ?? new Error("The transaction was aborted."));
        };
        transaction.oncomplete = () => {
          if (settled) return;
          settled = true;
          resolve(result ? cloneProgress(result) : null);
        };

        const request = transaction.objectStore(INDEXED_DB_PROGRESS_STORE_NAME).get(lessonId);
        request.onerror = () => {
          fail("the read request", request.error ?? new Error("The read request failed."));
        };
        request.onsuccess = () => {
          try {
            result = request.result == null ? null : readStoredProgress(request.result);
          } catch (cause) {
            fail("reading the stored progress", cause);
          }
        };
      } catch (cause) {
        fail("creating the transaction", cause);
      }
    });
  }

  private runListTransaction(database: IDBDatabase, operation: string): Promise<LessonProgress[]> {
    return new Promise<LessonProgress[]>((resolve, reject) => {
      let transaction: IDBTransaction | undefined;
      let result: LessonProgress[] = [];
      let settled = false;

      const fail = (phase: string, cause: unknown) => {
        if (settled) return;
        settled = true;
        try {
          transaction?.abort();
        } catch {
          // Keep the original failure.
        }
        rejectFailure(reject, operation, phase, cause);
      };

      try {
        transaction = database.transaction(INDEXED_DB_PROGRESS_STORE_NAME, "readonly");
        transaction.onerror = () => {
          fail("the transaction", transaction?.error ?? new Error("The transaction failed."));
        };
        transaction.onabort = () => {
          fail("the transaction", transaction?.error ?? new Error("The transaction was aborted."));
        };
        transaction.oncomplete = () => {
          if (settled) return;
          settled = true;
          resolve(cloneProgressList(sortProgress(result)));
        };

        const request = transaction.objectStore(INDEXED_DB_PROGRESS_STORE_NAME).getAll();
        request.onerror = () => {
          fail("the read request", request.error ?? new Error("The read request failed."));
        };
        request.onsuccess = () => {
          try {
            const records = (request.result as unknown[] | undefined) ?? [];
            result = records.map(readStoredProgress);
          } catch (cause) {
            fail("reading stored progress", cause);
          }
        };
      } catch (cause) {
        fail("creating the transaction", cause);
      }
    });
  }

  private runMonotonicTransaction(
    database: IDBDatabase,
    operation: string,
    lessonId: string,
    transition: (current: LessonProgress | null) => LessonProgress,
  ): Promise<LessonProgress> {
    return new Promise<LessonProgress>((resolve, reject) => {
      let transaction: IDBTransaction | undefined;
      let result: LessonProgress | undefined;
      let settled = false;

      const fail = (phase: string, cause: unknown) => {
        if (settled) return;
        settled = true;
        try {
          transaction?.abort();
        } catch {
          // Keep the original failure.
        }
        rejectFailure(reject, operation, phase, cause);
      };

      try {
        transaction = database.transaction(INDEXED_DB_PROGRESS_STORE_NAME, "readwrite");
        transaction.onerror = () => {
          fail("the transaction", transaction?.error ?? new Error("The transaction failed."));
        };
        transaction.onabort = () => {
          fail("the transaction", transaction?.error ?? new Error("The transaction was aborted."));
        };
        transaction.oncomplete = () => {
          if (settled) return;
          if (!result) {
            fail("the transaction", new Error("The transaction completed without a result."));
            return;
          }
          settled = true;
          resolve(cloneProgress(result));
        };

        const store = transaction.objectStore(INDEXED_DB_PROGRESS_STORE_NAME);
        const getRequest = store.get(lessonId);
        getRequest.onerror = () => {
          fail("the read request", getRequest.error ?? new Error("The read request failed."));
        };
        getRequest.onsuccess = () => {
          try {
            const current =
              getRequest.result == null ? null : readStoredProgress(getRequest.result);
            const next = transition(current);
            assertLessonProgress(next);
            result = cloneProgress(next);
            const putRequest = store.put(cloneProgress(next));
            putRequest.onerror = () => {
              fail("the write request", putRequest.error ?? new Error("The write request failed."));
            };
          } catch (cause) {
            fail("applying progress", cause);
          }
        };
      } catch (cause) {
        fail("creating the transaction", cause);
      }
    });
  }

  private runGetAttemptTransaction(
    database: IDBDatabase,
    operation: string,
    attemptId: string,
  ): Promise<QuizAttempt | null> {
    return new Promise<QuizAttempt | null>((resolve, reject) => {
      let transaction: IDBTransaction | undefined;
      let result: QuizAttempt | null = null;
      let settled = false;
      const fail = (phase: string, cause: unknown) => {
        if (settled) return;
        settled = true;
        try { transaction?.abort(); } catch { /* Keep the original failure. */ }
        rejectFailure(reject, operation, phase, cause);
      };
      try {
        transaction = database.transaction(INDEXED_DB_QUIZ_ATTEMPT_STORE_NAME, "readonly");
        transaction.onerror = () => fail("the transaction", transaction?.error ?? new Error("The transaction failed."));
        transaction.onabort = () => fail("the transaction", transaction?.error ?? new Error("The transaction was aborted."));
        transaction.oncomplete = () => {
          if (settled) return;
          settled = true;
          resolve(result ? normalizeQuizAttempt(result) : null);
        };
        const request = transaction.objectStore(INDEXED_DB_QUIZ_ATTEMPT_STORE_NAME).get(attemptId);
        request.onerror = () => fail("the read request", request.error ?? new Error("The read request failed."));
        request.onsuccess = () => {
          try {
            result = request.result == null ? null : readStoredQuizAttempt(request.result);
          } catch (cause) {
            fail("reading the stored quiz attempt", cause);
          }
        };
      } catch (cause) {
        fail("creating the transaction", cause);
      }
    });
  }

  private runListAttemptsTransaction(
    database: IDBDatabase,
    operation: string,
  ): Promise<QuizAttempt[]> {
    return new Promise<QuizAttempt[]>((resolve, reject) => {
      let transaction: IDBTransaction | undefined;
      let result: QuizAttempt[] = [];
      let settled = false;
      const fail = (phase: string, cause: unknown) => {
        if (settled) return;
        settled = true;
        try { transaction?.abort(); } catch { /* Keep the original failure. */ }
        rejectFailure(reject, operation, phase, cause);
      };
      try {
        transaction = database.transaction(INDEXED_DB_QUIZ_ATTEMPT_STORE_NAME, "readonly");
        transaction.onerror = () => fail("the transaction", transaction?.error ?? new Error("The transaction failed."));
        transaction.onabort = () => fail("the transaction", transaction?.error ?? new Error("The transaction was aborted."));
        transaction.oncomplete = () => {
          if (settled) return;
          settled = true;
          resolve(result.map(normalizeQuizAttempt).sort((left, right) => left.attemptId.localeCompare(right.attemptId)));
        };
        const request = transaction.objectStore(INDEXED_DB_QUIZ_ATTEMPT_STORE_NAME).getAll();
        request.onerror = () => fail("the read request", request.error ?? new Error("The read request failed."));
        request.onsuccess = () => {
          try {
            result = ((request.result as unknown[] | undefined) ?? []).map(readStoredQuizAttempt);
          } catch (cause) {
            fail("reading stored quiz attempts", cause);
          }
        };
      } catch (cause) {
        fail("creating the transaction", cause);
      }
    });
  }

  private runSaveAttemptTransaction(
    database: IDBDatabase,
    operation: string,
    attempt: QuizAttempt,
  ): Promise<QuizAttempt> {
    return new Promise<QuizAttempt>((resolve, reject) => {
      let transaction: IDBTransaction | undefined;
      let result: QuizAttempt | undefined;
      let settled = false;
      const fail = (phase: string, cause: unknown) => {
        if (settled) return;
        settled = true;
        try { transaction?.abort(); } catch { /* Keep the original failure. */ }
        rejectFailure(reject, operation, phase, cause);
      };
      try {
        transaction = database.transaction(
          [INDEXED_DB_QUIZ_ATTEMPT_STORE_NAME, INDEXED_DB_PROGRESS_STORE_NAME],
          "readwrite",
        );
        transaction.onerror = () => fail("the transaction", transaction?.error ?? new Error("The transaction failed."));
        transaction.onabort = () => fail("the transaction", transaction?.error ?? new Error("The transaction was aborted."));
        transaction.oncomplete = () => {
          if (settled) return;
          if (!result) {
            fail("the transaction", new Error("The transaction completed without a result."));
            return;
          }
          settled = true;
          resolve(normalizeQuizAttempt(result));
        };

        const attemptStore = transaction.objectStore(INDEXED_DB_QUIZ_ATTEMPT_STORE_NAME);
        const getAttempt = attemptStore.get(attempt.attemptId);
        getAttempt.onerror = () => fail("the attempt read request", getAttempt.error ?? new Error("The read request failed."));
        getAttempt.onsuccess = () => {
          try {
            if (getAttempt.result != null) {
              const existing = readStoredQuizAttempt(getAttempt.result);
              if (!quizAttemptsEqual(existing, attempt)) {
                throw new ProgressValidationError(
                  `Quiz attempt ID ${attempt.attemptId} is already used by different attempt data.`,
                );
              }
              result = existing;
              return;
            }
            result = normalizeQuizAttempt(attempt);
            const putAttempt = attemptStore.put(result);
            putAttempt.onerror = () => fail("the attempt write request", putAttempt.error ?? new Error("The write request failed."));
            if (!attempt.passed) return;

            const lessonStore = transaction?.objectStore(INDEXED_DB_PROGRESS_STORE_NAME);
            if (!lessonStore) throw new Error("Lesson progress store is unavailable.");
            const getLesson = lessonStore.get(attempt.lessonId);
            getLesson.onerror = () => fail("the lesson read request", getLesson.error ?? new Error("The read request failed."));
            getLesson.onsuccess = () => {
              try {
                const current = getLesson.result == null ? null : readStoredProgress(getLesson.result);
                const next = advanceLessonProgress(current, attempt.lessonId, "quiz-passed");
                const putLesson = lessonStore.put(next);
                putLesson.onerror = () => fail("the lesson write request", putLesson.error ?? new Error("The write request failed."));
              } catch (cause) {
                fail("advancing lesson progress", cause);
              }
            };
          } catch (cause) {
            fail("saving the quiz attempt", cause);
          }
        };
      } catch (cause) {
        fail("creating the transaction", cause);
      }
    });
  }

  private runReplaceTransaction(
    database: IDBDatabase,
    operation: string,
    lessons: readonly LessonProgress[],
    quizAttempts: readonly QuizAttempt[],
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let transaction: IDBTransaction | undefined;
      let settled = false;

      const fail = (phase: string, cause: unknown) => {
        if (settled) return;
        settled = true;
        try {
          transaction?.abort();
        } catch {
          // Keep the original failure.
        }
        rejectFailure(reject, operation, phase, cause);
      };

      try {
        transaction = database.transaction(
          [INDEXED_DB_PROGRESS_STORE_NAME, INDEXED_DB_QUIZ_ATTEMPT_STORE_NAME],
          "readwrite",
        );
        transaction.onerror = () => {
          fail("the transaction", transaction?.error ?? new Error("The transaction failed."));
        };
        transaction.onabort = () => {
          fail("the transaction", transaction?.error ?? new Error("The transaction was aborted."));
        };
        transaction.oncomplete = () => {
          if (settled) return;
          settled = true;
          resolve();
        };

        const store = transaction.objectStore(INDEXED_DB_PROGRESS_STORE_NAME);
        const clearRequest = store.clear();
        clearRequest.onerror = () => {
          fail("the clear request", clearRequest.error ?? new Error("The clear request failed."));
        };

        for (const lesson of lessons) {
          const putRequest = store.put(cloneProgress(lesson));
          putRequest.onerror = () => {
            fail("the write request", putRequest.error ?? new Error("The write request failed."));
          };
        }
        const attemptStore = transaction.objectStore(INDEXED_DB_QUIZ_ATTEMPT_STORE_NAME);
        const clearAttempts = attemptStore.clear();
        clearAttempts.onerror = () => {
          fail("the quiz-attempt clear request", clearAttempts.error ?? new Error("The clear request failed."));
        };
        for (const attempt of quizAttempts) {
          const putAttempt = attemptStore.put(normalizeQuizAttempt(attempt));
          putAttempt.onerror = () => {
            fail("the quiz-attempt write request", putAttempt.error ?? new Error("The write request failed."));
          };
        }
      } catch (cause) {
        fail("creating the replacement transaction", cause);
      }
    });
  }

  private runResetTransaction(
    database: IDBDatabase,
    operation: string,
    scope: ReturnType<typeof normalizeProgressResetScope>,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let transaction: IDBTransaction | undefined;
      let settled = false;

      const fail = (phase: string, cause: unknown) => {
        if (settled) return;
        settled = true;
        try {
          transaction?.abort();
        } catch {
          // Keep the original failure.
        }
        rejectFailure(reject, operation, phase, cause);
      };

      try {
        transaction = database.transaction(
          [INDEXED_DB_PROGRESS_STORE_NAME, INDEXED_DB_QUIZ_ATTEMPT_STORE_NAME],
          "readwrite",
        );
        transaction.onerror = () => {
          fail("the transaction", transaction?.error ?? new Error("The transaction failed."));
        };
        transaction.onabort = () => {
          fail("the transaction", transaction?.error ?? new Error("The transaction was aborted."));
        };
        transaction.oncomplete = () => {
          if (settled) return;
          settled = true;
          resolve();
        };

        const store = transaction.objectStore(INDEXED_DB_PROGRESS_STORE_NAME);
        const attemptStore = transaction.objectStore(INDEXED_DB_QUIZ_ATTEMPT_STORE_NAME);
        if (scope.kind === "all") {
          const clearRequest = store.clear();
          clearRequest.onerror = () => {
            fail("the clear request", clearRequest.error ?? new Error("The clear request failed."));
          };
          const clearAttempts = attemptStore.clear();
          clearAttempts.onerror = () => {
            fail("the quiz-attempt clear request", clearAttempts.error ?? new Error("The clear request failed."));
          };
        } else {
          for (const lessonId of scope.lessonIds) {
            const deleteRequest = store.delete(lessonId);
            deleteRequest.onerror = () => {
              fail(
                "the delete request",
                deleteRequest.error ?? new Error("The delete request failed."),
              );
            };
          }
          const selected = new Set(scope.lessonIds);
          const getAttempts = attemptStore.getAll();
          getAttempts.onerror = () => {
            fail("the quiz-attempt read request", getAttempts.error ?? new Error("The read request failed."));
          };
          getAttempts.onsuccess = () => {
            try {
              for (const raw of (getAttempts.result as unknown[] | undefined) ?? []) {
                const attempt = readStoredQuizAttempt(raw);
                if (!selected.has(attempt.lessonId)) continue;
                const deleteAttempt = attemptStore.delete(attempt.attemptId);
                deleteAttempt.onerror = () => {
                  fail("the quiz-attempt delete request", deleteAttempt.error ?? new Error("The delete request failed."));
                };
              }
            } catch (cause) {
              fail("reading quiz attempts for reset", cause);
            }
          };
        }
      } catch (cause) {
        fail("creating the reset transaction", cause);
      }
    });
  }
}
