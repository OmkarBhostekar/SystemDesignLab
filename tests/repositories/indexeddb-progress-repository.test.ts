import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { indexedDB as fakeIndexedDB } from "fake-indexeddb";

import {
  ProgressValidationError,
  type LessonProgress,
} from "@/domain/progress";
import {
  INDEXED_DB_PROGRESS_DATABASE_VERSION,
  INDEXED_DB_PROGRESS_STORE_NAME,
  INDEXED_DB_QUIZ_ATTEMPT_STORE_NAME,
  INDEXED_DB_SIMULATION_COMPLETION_STORE_NAME,
  IndexedDbProgressRepository,
} from "@/repositories/indexeddb-progress-repository";
import { defineProgressRepositoryContract } from "./progress-repository.contract";

const idbFactory = fakeIndexedDB as unknown as IDBFactory;
let databaseSequence = 0;

function deleteDatabase(databaseName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = fakeIndexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Failed to delete test database."));
    request.onblocked = () => reject(new Error("Test database deletion was blocked."));
  });
}

function openM3Database(databaseName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = fakeIndexedDB.open(databaseName, 2);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(INDEXED_DB_PROGRESS_STORE_NAME, { keyPath: "lessonId" });
    };
    request.onerror = () => reject(request.error ?? new Error("Failed to create legacy database."));
    request.onblocked = () => reject(new Error("Legacy database creation was blocked."));
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(INDEXED_DB_PROGRESS_STORE_NAME, "readwrite");
      transaction.objectStore(INDEXED_DB_PROGRESS_STORE_NAME).put({
        lessonId: "04-10-consistent-hashing",
        stage: "theory-complete",
      });
      transaction.onerror = () => reject(transaction.error ?? new Error("Legacy write failed."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Legacy write aborted."));
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
    };
  });
}

function openM4Database(databaseName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = fakeIndexedDB.open(databaseName, 3);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(INDEXED_DB_PROGRESS_STORE_NAME, {
        keyPath: "lessonId",
      });
      request.result.createObjectStore(INDEXED_DB_QUIZ_ATTEMPT_STORE_NAME, {
        keyPath: "attemptId",
      });
    };
    request.onerror = () => reject(request.error ?? new Error("Failed to create M4 database."));
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(
        [INDEXED_DB_PROGRESS_STORE_NAME, INDEXED_DB_QUIZ_ATTEMPT_STORE_NAME],
        "readwrite",
      );
      transaction.objectStore(INDEXED_DB_PROGRESS_STORE_NAME).put({
        lessonId: "04-10-consistent-hashing",
        stage: "quiz-passed",
      });
      transaction.objectStore(INDEXED_DB_QUIZ_ATTEMPT_STORE_NAME).put({
        attemptId: "attempt-from-m4",
        quizId: "consistent-hashing-quiz",
        lessonId: "04-10-consistent-hashing",
        answers: [],
        earnedPoints: 0,
        possiblePoints: 1,
        scorePercent: 0,
        passed: false,
        incorrectConceptTags: ["remapping"],
      });
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error ?? new Error("M4 seed failed."));
    };
  });
}

function openBrokenM5Database(databaseName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = fakeIndexedDB.open(databaseName, INDEXED_DB_PROGRESS_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(INDEXED_DB_PROGRESS_STORE_NAME, { keyPath: "lessonId" });
      request.result.createObjectStore(INDEXED_DB_QUIZ_ATTEMPT_STORE_NAME, { keyPath: "attemptId" });
      request.result.createObjectStore(INDEXED_DB_SIMULATION_COMPLETION_STORE_NAME, {
        keyPath: "wrongKey",
      });
    };
    request.onerror = () => reject(request.error ?? new Error("Failed to create broken database."));
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(INDEXED_DB_PROGRESS_STORE_NAME, "readwrite");
      transaction.objectStore(INDEXED_DB_PROGRESS_STORE_NAME).put({ lessonId: "04-10-consistent-hashing", stage: "mastered" });
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error ?? new Error("Seed transaction failed."));
    };
  });
}

function putRaw(databaseName: string, storeName: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = fakeIndexedDB.open(databaseName, INDEXED_DB_PROGRESS_DATABASE_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Failed to open test database."));
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).put(value);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error ?? new Error("Raw write failed."));
    };
  });
}

describe("IndexedDbProgressRepository", () => {
  let databaseName: string;

  beforeEach(() => {
    databaseName = `system-design-progress-test-${databaseSequence++}`;
  });

  afterEach(async () => {
    await deleteDatabase(databaseName);
  });

  function createRepository(): IndexedDbProgressRepository {
    return new IndexedDbProgressRepository({ indexedDB: idbFactory, databaseName });
  }

  it("persists across repository instances and returns cloned records", async () => {
    const first = createRepository();
    const saved = await first.saveLessonProgress({
      lessonId: "04-10-consistent-hashing",
      stage: "mastered",
    });
    saved.stage = "not-started";

    const second = createRepository();
    const loaded = await second.getLessonProgress("04-10-consistent-hashing");
    expect(loaded).toEqual({ lessonId: "04-10-consistent-hashing", stage: "mastered" });

    const listed = await second.listLessonProgress();
    listed[0].stage = "not-started";
    expect(await second.getLessonProgress("04-10-consistent-hashing")).toEqual({
      lessonId: "04-10-consistent-hashing",
      stage: "mastered",
    });
  });

  it("merges saves and milestone application monotonically in the stored record", async () => {
    const repository = createRepository();
    await repository.saveLessonProgress({
      lessonId: "04-11-read-write-quorums",
      stage: "quiz-passed",
    });

    expect(
      await repository.saveLessonProgress({
        lessonId: "04-11-read-write-quorums",
        stage: "theory-complete",
      }),
    ).toEqual({ lessonId: "04-11-read-write-quorums", stage: "quiz-passed" });

    expect(
      await repository.applyLessonMilestone("04-11-read-write-quorums", "mastered"),
    ).toEqual({ lessonId: "04-11-read-write-quorums", stage: "mastered" });
    expect(
      await repository.applyLessonMilestone("04-11-read-write-quorums", "theory-complete"),
    ).toEqual({ lessonId: "04-11-read-write-quorums", stage: "mastered" });
  });

  it("lists and exports lessons in deterministic order", async () => {
    const repository = createRepository();
    await repository.saveLessonProgress({
      lessonId: "04-11-read-write-quorums",
      stage: "theory-complete",
    });
    await repository.saveLessonProgress({
      lessonId: "04-10-consistent-hashing",
      stage: "visualization-complete",
    });

    expect(await repository.listLessonProgress()).toEqual([
      { lessonId: "04-10-consistent-hashing", stage: "visualization-complete" },
      { lessonId: "04-11-read-write-quorums", stage: "theory-complete" },
    ]);
    expect(await repository.exportProgress()).toEqual({
      format: "system-design-visual-learning-lab-progress",
      schemaVersion: 4,
      lessons: [
        { lessonId: "04-10-consistent-hashing", stage: "visualization-complete" },
        { lessonId: "04-11-read-write-quorums", stage: "theory-complete" },
      ],
      quizAttempts: [],
      simulationCompletions: [],
    });
  });

  it("validates imports before atomically replacing existing progress", async () => {
    const repository = createRepository();
    await repository.saveLessonProgress({
      lessonId: "04-10-consistent-hashing",
      stage: "mastered",
    });

    await expect(
      repository.importProgress({
        format: "system-design-visual-learning-lab-progress",
        schemaVersion: 2,
        lessons: [
          { lessonId: "04-11-read-write-quorums", stage: "theory-complete" },
          { lessonId: "04-11-read-write-quorums", stage: "mastered" },
        ],
      }),
    ).rejects.toThrow(ProgressValidationError);
    expect(await repository.exportProgress()).toEqual({
      format: "system-design-visual-learning-lab-progress",
      schemaVersion: 4,
      lessons: [{ lessonId: "04-10-consistent-hashing", stage: "mastered" }],
      quizAttempts: [],
      simulationCompletions: [],
    });

    await repository.importProgress({
      schemaVersion: 1,
      lessons: { "04-11-read-write-quorums": "quiz-passed" },
    });
    expect(await repository.listLessonProgress()).toEqual([
      { lessonId: "04-11-read-write-quorums", stage: "quiz-passed" },
    ]);
  });

  it("resets selected lessons or the complete progress store", async () => {
    const repository = createRepository();
    const records: LessonProgress[] = [
      { lessonId: "04-10-consistent-hashing", stage: "mastered" },
      { lessonId: "04-11-read-write-quorums", stage: "quiz-passed" },
      { lessonId: "04-12-replication", stage: "theory-complete" },
    ];
    for (const record of records) await repository.saveLessonProgress(record);

    await repository.resetProgress({
      kind: "lessons",
      lessonIds: ["04-11-read-write-quorums", "04-11-read-write-quorums"],
    });
    expect(await repository.listLessonProgress()).toEqual([
      records[0],
      records[2],
    ]);

    await repository.resetProgress({ kind: "all" });
    expect(await repository.listLessonProgress()).toEqual([]);
  });

  it("migrates the M3 database version while preserving lesson progress", async () => {
    await openM3Database(databaseName);

    const repository = createRepository();
    expect(await repository.getLessonProgress("04-10-consistent-hashing")).toEqual({
      lessonId: "04-10-consistent-hashing",
      stage: "theory-complete",
    });
    expect(await repository.listQuizAttempts()).toEqual([]);
  });

  it("migrates the M4 database version while preserving lessons and quiz attempts", async () => {
    await openM4Database(databaseName);

    const repository = createRepository();
    expect(await repository.getLessonProgress("04-10-consistent-hashing")).toEqual({
      lessonId: "04-10-consistent-hashing",
      stage: "quiz-passed",
    });
    expect(await repository.listQuizAttempts()).toHaveLength(1);
    expect(await repository.listSimulationCompletions()).toEqual([]);
  });

  it("persists quiz attempts across repository instances", async () => {
    const first = createRepository();
    await first.saveQuizAttempt({
      attemptId: "attempt-persistent",
      quizId: "consistent-hashing-quiz",
      lessonId: "04-10-consistent-hashing",
      answers: [{ questionId: "consistent-hashing-guarantee", type: "single-choice", selectedOptionId: "bounded-remapping" }],
      earnedPoints: 1,
      possiblePoints: 1,
      scorePercent: 100,
      passed: true,
      incorrectConceptTags: [],
    });

    const second = createRepository();
    expect(await second.listQuizAttempts()).toHaveLength(1);
    expect(await second.getLessonProgress("04-10-consistent-hashing")).toEqual({
      lessonId: "04-10-consistent-hashing",
      stage: "quiz-passed",
    });
  });

  it("persists simulation completions across repository instances", async () => {
    const first = createRepository();
    await first.saveSimulationCompletion({
      completionId: "consistent-hash-ring--vnode-ring",
      visualizationId: "consistent-hash-ring",
      lessonId: "04-10-consistent-hashing",
      scenarioId: "vnode-ring",
    });

    const second = createRepository();
    expect(await second.listSimulationCompletions()).toEqual([{
      completionId: "consistent-hash-ring--vnode-ring",
      visualizationId: "consistent-hash-ring",
      lessonId: "04-10-consistent-hashing",
      scenarioId: "vnode-ring",
    }]);
    expect(await second.getLessonProgress("04-10-consistent-hashing")).toEqual({
      lessonId: "04-10-consistent-hashing",
      stage: "visualization-complete",
    });
  });

  it("surfaces corrupted stored lesson and attempt records", async () => {
    const repository = createRepository();
    await repository.listLessonProgress();
    await putRaw(databaseName, INDEXED_DB_PROGRESS_STORE_NAME, {
      lessonId: "04-10-consistent-hashing",
      stage: "not-a-stage",
    });
    await expect(repository.listLessonProgress()).rejects.toThrow(ProgressValidationError);

    await putRaw(databaseName, INDEXED_DB_QUIZ_ATTEMPT_STORE_NAME, {
      attemptId: "broken-attempt",
    });
    await expect(repository.listQuizAttempts()).rejects.toThrow(ProgressValidationError);

    await putRaw(databaseName, INDEXED_DB_SIMULATION_COMPLETION_STORE_NAME, {
      completionId: "broken--completion",
    });
    await expect(repository.listSimulationCompletions()).rejects.toThrow(
      ProgressValidationError,
    );
  });

  it("aborts a three-store import transaction and preserves prior data on write failure", async () => {
    await openBrokenM5Database(databaseName);
    const repository = createRepository();
    await expect(repository.importProgress({
      format: "system-design-visual-learning-lab-progress",
      schemaVersion: 4,
      lessons: [{ lessonId: "00-03-estimation", stage: "theory-complete" }],
      quizAttempts: [{
        attemptId: "attempt-imported",
        quizId: "estimation-quiz",
        lessonId: "00-03-estimation",
        answers: [],
        earnedPoints: 0,
        possiblePoints: 1,
        scorePercent: 0,
        passed: false,
        incorrectConceptTags: [],
      }],
      simulationCompletions: [{
        completionId: "horizontal-scaling--stateless-scale-out",
        visualizationId: "horizontal-scaling",
        lessonId: "01-02-horizontal-vs-vertical-scaling",
        scenarioId: "stateless-scale-out",
      }],
    })).rejects.toMatchObject({ name: "ProgressStorageError", operation: "importProgress" });
    await expect(repository.listLessonProgress()).resolves.toEqual([
      { lessonId: "04-10-consistent-hashing", stage: "mastered" },
    ]);
  });

  it("does not touch the browser API until an operation is invoked", async () => {
    const globalObject = globalThis as typeof globalThis & { indexedDB?: IDBFactory };
    const hadOwnProperty = Object.prototype.hasOwnProperty.call(globalObject, "indexedDB");
    const previous = globalObject.indexedDB;

    try {
      Object.defineProperty(globalObject, "indexedDB", {
        configurable: true,
        enumerable: false,
        value: undefined,
        writable: true,
      });
      const repository = new IndexedDbProgressRepository({ databaseName });
      await expect(repository.listLessonProgress()).rejects.toMatchObject({
        name: "ProgressStorageError",
        operation: "listLessonProgress",
      });
    } finally {
      if (hadOwnProperty) {
        Object.defineProperty(globalObject, "indexedDB", {
          configurable: true,
          enumerable: false,
          value: previous,
          writable: true,
        });
      } else {
        Reflect.deleteProperty(globalObject, "indexedDB");
      }
    }
  });

  it("wraps synchronous IndexedDB open failures with an actionable storage error", async () => {
    const failingFactory = {
      open: () => {
        throw new Error("permission denied");
      },
    } as unknown as IDBFactory;
    const repository = new IndexedDbProgressRepository({
      indexedDB: failingFactory,
      databaseName,
    });

    await expect(repository.listLessonProgress()).rejects.toMatchObject({
      name: "ProgressStorageError",
      operation: "listLessonProgress",
      message: expect.stringContaining("permission denied"),
    });
  });
});

// Keep the shared contract in lockstep with the adapter. Each case receives a
// fresh database name because the contract factory is intentionally called
// without lifecycle hooks of this file's focused test suite.
defineProgressRepositoryContract("IndexedDB", () => {
  const contractDatabaseName = `system-design-progress-contract-${databaseSequence++}`;
  return new IndexedDbProgressRepository({
    indexedDB: idbFactory,
    databaseName: contractDatabaseName,
  });
});
