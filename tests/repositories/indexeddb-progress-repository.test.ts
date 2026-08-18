import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { indexedDB as fakeIndexedDB } from "fake-indexeddb";

import {
  ProgressValidationError,
  type LessonProgress,
} from "@/domain/progress";
import {
  INDEXED_DB_PROGRESS_STORE_NAME,
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

function openLegacyDatabase(databaseName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = fakeIndexedDB.open(databaseName, 1);
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
      schemaVersion: 2,
      lessons: [
        { lessonId: "04-10-consistent-hashing", stage: "visualization-complete" },
        { lessonId: "04-11-read-write-quorums", stage: "theory-complete" },
      ],
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
      schemaVersion: 2,
      lessons: [{ lessonId: "04-10-consistent-hashing", stage: "mastered" }],
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

  it("reads compatible records from a previous IndexedDB database version", async () => {
    await openLegacyDatabase(databaseName);

    const repository = createRepository();
    expect(await repository.getLessonProgress("04-10-consistent-hashing")).toEqual({
      lessonId: "04-10-consistent-hashing",
      stage: "theory-complete",
    });
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
