import { describe, expect, it } from "vitest";

import {
  ProgressValidationError,
  UnsupportedProgressVersionError,
  type LessonProgress,
  type ProgressRepository,
  type QuizAttempt,
  type SimulationCompletion,
} from "@/domain/progress";

function quizAttempt(overrides: Partial<QuizAttempt> = {}): QuizAttempt {
  return {
    attemptId: "attempt-one",
    quizId: "consistent-hashing-quiz",
    lessonId: "04-10-consistent-hashing",
    answers: [{ questionId: "consistent-hashing-guarantee", type: "single-choice", selectedOptionId: "bounded-remapping" }],
    earnedPoints: 1,
    possiblePoints: 1,
    scorePercent: 100,
    passed: true,
    incorrectConceptTags: [],
    ...overrides,
  };
}

function simulationCompletion(
  overrides: Partial<SimulationCompletion> = {},
): SimulationCompletion {
  return {
    completionId: "consistent-hash-ring--vnode-ring",
    visualizationId: "consistent-hash-ring",
    lessonId: "04-10-consistent-hashing",
    scenarioId: "vnode-ring",
    ...overrides,
  };
}

export type ProgressRepositoryFactory =
  () => ProgressRepository | Promise<ProgressRepository>;

/**
 * Defines the behavior every progress persistence adapter must provide.
 *
 * The factory is called for each test, keeping cases isolated and allowing
 * browser-backed adapters to create a fresh store or transaction boundary.
 */
export function defineProgressRepositoryContract(
  name: string,
  createRepository: ProgressRepositoryFactory,
): void {
  describe(`${name} ProgressRepository contract`, () => {
    it("starts empty and returns null for an unknown lesson", async () => {
      const repository = await createRepository();

      await expect(repository.getLessonProgress("04-10-consistent-hashing")).resolves.toBeNull();
      await expect(repository.listLessonProgress()).resolves.toEqual([]);
    });

    it("saves, reads, and lists independent records in deterministic order", async () => {
      const repository = await createRepository();

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
      expect(await repository.getLessonProgress("04-11-read-write-quorums")).toEqual({
        lessonId: "04-11-read-write-quorums",
        stage: "theory-complete",
      });
      await expect(repository.getLessonProgress("04-12-replication")).resolves.toBeNull();
    });

    it("keeps save monotonic and makes repeated saves idempotent", async () => {
      const repository = await createRepository();
      const mastered = { lessonId: "04-10-consistent-hashing", stage: "mastered" as const };

      await expect(repository.saveLessonProgress(mastered)).resolves.toEqual(mastered);
      await expect(
        repository.saveLessonProgress({
          lessonId: mastered.lessonId,
          stage: "theory-complete",
        }),
      ).resolves.toEqual(mastered);
      await expect(repository.saveLessonProgress(mastered)).resolves.toEqual(mastered);
      await expect(repository.listLessonProgress()).resolves.toEqual([mastered]);
    });

    it("applies milestones monotonically and idempotently", async () => {
      const repository = await createRepository();

      await expect(
        repository.applyLessonMilestone("04-10-consistent-hashing", "theory-complete"),
      ).resolves.toEqual({ lessonId: "04-10-consistent-hashing", stage: "theory-complete" });
      await expect(
        repository.applyLessonMilestone("04-10-consistent-hashing", "visualization-complete"),
      ).resolves.toEqual({
        lessonId: "04-10-consistent-hashing",
        stage: "visualization-complete",
      });
      await expect(
        repository.applyLessonMilestone("04-10-consistent-hashing", "theory-complete"),
      ).resolves.toEqual({
        lessonId: "04-10-consistent-hashing",
        stage: "visualization-complete",
      });
      await expect(repository.listLessonProgress()).resolves.toEqual([
        { lessonId: "04-10-consistent-hashing", stage: "visualization-complete" },
      ]);
    });

    it("saves, reads, lists, and clones isolated quiz attempts", async () => {
      const repository = await createRepository();
      const later = quizAttempt({ attemptId: "attempt-two", lessonId: "00-03-estimation", quizId: "estimation-quiz" });
      const first = quizAttempt();
      await repository.saveQuizAttempt(later);
      const saved = await repository.saveQuizAttempt(first);
      saved.answers.length = 0;

      expect(await repository.getQuizAttempt(first.attemptId)).toEqual(first);
      expect(await repository.listQuizAttempts()).toEqual([first, later]);
      await expect(repository.getQuizAttempt("missing-attempt")).resolves.toBeNull();
    });

    it("makes repeated attempt saves idempotent and rejects conflicting ID reuse", async () => {
      const repository = await createRepository();
      const attempt = quizAttempt();
      await expect(repository.saveQuizAttempt(attempt)).resolves.toEqual(attempt);
      await expect(repository.saveQuizAttempt({ ...attempt })).resolves.toEqual(attempt);
      await expect(repository.saveQuizAttempt({ ...attempt, passed: false })).rejects.toThrow(
        ProgressValidationError,
      );
      await expect(repository.listQuizAttempts()).resolves.toEqual([attempt]);
    });

    it("advances only passed quiz attempts without regressing later progress", async () => {
      const repository = await createRepository();
      const failed = quizAttempt({
        attemptId: "attempt-failed",
        lessonId: "00-03-estimation",
        quizId: "estimation-quiz",
        earnedPoints: 0,
        scorePercent: 0,
        passed: false,
        incorrectConceptTags: ["unit-conversion", "unit-conversion", "average-qps"],
      });
      const normalizedFailed = { ...failed, incorrectConceptTags: ["average-qps", "unit-conversion"] };
      await expect(repository.saveQuizAttempt(failed)).resolves.toEqual(normalizedFailed);
      await expect(repository.getLessonProgress(failed.lessonId)).resolves.toBeNull();

      await repository.saveQuizAttempt(quizAttempt({ attemptId: "attempt-passed" }));
      await expect(repository.getLessonProgress("04-10-consistent-hashing")).resolves.toEqual({
        lessonId: "04-10-consistent-hashing",
        stage: "quiz-passed",
      });
      await repository.applyLessonMilestone("04-10-consistent-hashing", "mastered");
      await repository.saveQuizAttempt(quizAttempt({ attemptId: "attempt-passed-again" }));
      await expect(repository.getLessonProgress("04-10-consistent-hashing")).resolves.toEqual({
        lessonId: "04-10-consistent-hashing",
        stage: "mastered",
      });
    });

    it("saves, reads, lists, and idempotently deduplicates simulation completions", async () => {
      const repository = await createRepository();
      const later = simulationCompletion({
        completionId: "horizontal-scaling--stateless-scale-out",
        visualizationId: "horizontal-scaling",
        lessonId: "01-02-horizontal-vs-vertical-scaling",
        scenarioId: "stateless-scale-out",
      });
      const first = simulationCompletion();
      await repository.saveSimulationCompletion(later);
      const saved = await repository.saveSimulationCompletion(first);
      saved.scenarioId = "mutated";

      expect(await repository.getSimulationCompletion(first.completionId)).toEqual(first);
      expect(await repository.listSimulationCompletions()).toEqual([first, later]);
      await expect(repository.saveSimulationCompletion({ ...first })).resolves.toEqual(first);
      await expect(repository.getSimulationCompletion("missing--scenario")).resolves.toBeNull();
      await expect(repository.saveSimulationCompletion({
        ...first,
        lessonId: "01-02-horizontal-vs-vertical-scaling",
      })).rejects.toThrow(ProgressValidationError);
    });

    it("atomically advances visualization completion without regressing later progress", async () => {
      const repository = await createRepository();
      const completion = simulationCompletion();
      await repository.saveSimulationCompletion(completion);
      await expect(repository.getLessonProgress(completion.lessonId)).resolves.toEqual({
        lessonId: completion.lessonId,
        stage: "visualization-complete",
      });
      await repository.applyLessonMilestone(completion.lessonId, "mastered");
      await repository.saveSimulationCompletion(simulationCompletion({
        completionId: "consistent-hash-ring--celebrity-key",
        scenarioId: "celebrity-key",
      }));
      await expect(repository.getLessonProgress(completion.lessonId)).resolves.toEqual({
        lessonId: completion.lessonId,
        stage: "mastered",
      });
    });

    it("clones values at both input and output boundaries", async () => {
      const repository = await createRepository();
      const input: LessonProgress = {
        lessonId: "04-10-consistent-hashing",
        stage: "theory-complete",
      };

      const saved = await repository.saveLessonProgress(input);
      input.stage = "mastered";
      saved.stage = "mastered";
      expect(await repository.getLessonProgress(input.lessonId)).toEqual({
        lessonId: input.lessonId,
        stage: "theory-complete",
      });

      const listed = await repository.listLessonProgress();
      listed[0]!.stage = "mastered";
      expect(await repository.getLessonProgress(input.lessonId)).toEqual({
        lessonId: input.lessonId,
        stage: "theory-complete",
      });
    });

    it("exports deterministic data and imports it into a fresh repository", async () => {
      const source = await createRepository();
      const target = await createRepository();

      await source.saveLessonProgress({
        lessonId: "04-11-read-write-quorums",
        stage: "theory-complete",
      });
      await source.saveLessonProgress({
        lessonId: "04-10-consistent-hashing",
        stage: "mastered",
      });
      const attempt = quizAttempt();
      await source.saveQuizAttempt(attempt);
      const completion = simulationCompletion();
      await source.saveSimulationCompletion(completion);
      const exportedWithAttempt = await source.exportProgress();

      await target.saveLessonProgress({
        lessonId: "04-12-replication",
        stage: "quiz-passed",
      });
      await target.importProgress(exportedWithAttempt);
      expect(await target.listLessonProgress()).toEqual(exportedWithAttempt.lessons);
      expect(await target.listQuizAttempts()).toEqual([attempt]);
      expect(await target.listSimulationCompletions()).toEqual([completion]);

      exportedWithAttempt.lessons[0]!.stage = "not-started";
      expect(await target.listLessonProgress()).toEqual([
        { lessonId: "04-10-consistent-hashing", stage: "mastered" },
        { lessonId: "04-11-read-write-quorums", stage: "theory-complete" },
      ]);
    });

    it("repeated imports are idempotent and replace, rather than merge, records", async () => {
      const repository = await createRepository();
      const exported = {
        format: "system-design-visual-learning-lab-progress" as const,
        schemaVersion: 2 as const,
        lessons: [{ lessonId: "04-10-consistent-hashing", stage: "quiz-passed" as const }],
      };

      await repository.saveLessonProgress({
        lessonId: "04-11-read-write-quorums",
        stage: "mastered",
      });
      await repository.saveQuizAttempt(quizAttempt({ attemptId: "attempt-before-import" }));
      await repository.saveSimulationCompletion(simulationCompletion());
      await repository.importProgress(exported);
      const first = await repository.listLessonProgress();
      await repository.importProgress(exported);
      expect(await repository.listLessonProgress()).toEqual(first);
      await expect(repository.listQuizAttempts()).resolves.toEqual([]);
      await expect(repository.listSimulationCompletions()).resolves.toEqual([]);
    });

    it("rejects invalid imports before changing existing state", async () => {
      const repository = await createRepository();
      const existing = { lessonId: "04-10-consistent-hashing", stage: "mastered" as const };
      await repository.saveLessonProgress(existing);

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
      await expect(repository.listLessonProgress()).resolves.toEqual([existing]);

      await expect(repository.importProgress({ schemaVersion: 99 })).rejects.toThrow(
        UnsupportedProgressVersionError,
      );
      await expect(repository.listLessonProgress()).resolves.toEqual([existing]);
    });

    it("resets selected lessons without affecting other records, then resets all", async () => {
      const repository = await createRepository();
      await repository.saveLessonProgress({
        lessonId: "04-10-consistent-hashing",
        stage: "mastered",
      });
      await repository.saveQuizAttempt(quizAttempt());
      await repository.saveSimulationCompletion(simulationCompletion());
      await repository.saveLessonProgress({
        lessonId: "04-11-read-write-quorums",
        stage: "quiz-passed",
      });

      await repository.resetProgress({
        kind: "lessons",
        lessonIds: ["04-10-consistent-hashing"],
      });
      await expect(repository.listLessonProgress()).resolves.toEqual([
        { lessonId: "04-11-read-write-quorums", stage: "quiz-passed" },
      ]);
      await expect(repository.listQuizAttempts()).resolves.toEqual([]);
      await expect(repository.listSimulationCompletions()).resolves.toEqual([]);

      await repository.resetProgress({ kind: "all" });
      await expect(repository.listLessonProgress()).resolves.toEqual([]);
      await expect(repository.listQuizAttempts()).resolves.toEqual([]);
      await expect(repository.listSimulationCompletions()).resolves.toEqual([]);
    });

    it("validates the complete reset scope before changing records", async () => {
      const repository = await createRepository();
      const existing = { lessonId: "04-10-consistent-hashing", stage: "mastered" as const };
      await repository.saveLessonProgress(existing);

      await expect(
        repository.resetProgress({
          kind: "lessons",
          lessonIds: [existing.lessonId, "Not valid"],
        }),
      ).rejects.toThrow(ProgressValidationError);
      await expect(repository.listLessonProgress()).resolves.toEqual([existing]);
      await expect(
        repository.resetProgress({ kind: "all", lessonIds: [] } as never),
      ).rejects.toThrow(ProgressValidationError);
      await expect(repository.listLessonProgress()).resolves.toEqual([existing]);
    });

    it("rejects malformed lesson IDs without mutating state", async () => {
      const repository = await createRepository();
      const existing = { lessonId: "04-10-consistent-hashing", stage: "mastered" as const };
      await repository.saveLessonProgress(existing);

      await expect(repository.getLessonProgress("Not valid")).rejects.toThrow(
        ProgressValidationError,
      );
      await expect(
        repository.applyLessonMilestone("Not valid", "theory-complete"),
      ).rejects.toThrow(ProgressValidationError);
      await expect(repository.listLessonProgress()).resolves.toEqual([existing]);
    });
  });
}
