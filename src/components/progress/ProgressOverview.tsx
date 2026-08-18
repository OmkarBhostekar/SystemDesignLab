"use client";

import Link from "next/link";
import { type ChangeEvent, useCallback, useEffect, useState } from "react";

import {
  findContinueLearningLessonId,
  summarizeCurriculumProgress,
  type LessonProgress,
  type ProgressRepository,
} from "@/domain/progress";
import { IndexedDbProgressRepository } from "@/repositories/indexeddb-progress-repository";
import { normalizeProgressImport } from "@/repositories/progress-serialization";

export type ProgressLessonLink = {
  id: string;
  title: string;
  href: string;
};

type ProgressOverviewProps = {
  lessons: readonly ProgressLessonLink[];
  repository?: ProgressRepository;
  confirmReset?: () => boolean;
};

export function ProgressOverview({ lessons, repository, confirmReset }: ProgressOverviewProps) {
  const [progressRepository] = useState(
    () => repository ?? new IndexedDbProgressRepository(),
  );
  const [records, setRecords] = useState<LessonProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lessonIds = lessons.map((lesson) => lesson.id);

  const refresh = useCallback(async () => {
    setRecords(await progressRepository.listLessonProgress());
  }, [progressRepository]);

  useEffect(() => {
    let active = true;
    progressRepository
      .listLessonProgress()
      .then((value) => {
        if (active) setRecords(value);
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [progressRepository]);

  let summary = { completedTheoryLessons: 0, totalLessons: lessons.length, percentComplete: 0 };
  let continueLesson: ProgressLessonLink | undefined;
  let summaryError: string | null = null;
  try {
    summary = summarizeCurriculumProgress(lessonIds, records);
    const continueId = findContinueLearningLessonId(lessonIds, records);
    continueLesson = lessons.find((lesson) => lesson.id === continueId);
  } catch (cause) {
    summaryError = errorMessage(cause);
  }

  async function exportProgress() {
    await runAction(async () => {
      const exported = await progressRepository.exportProgress();
      const url = URL.createObjectURL(
        new Blob([`${JSON.stringify(exported, null, 2)}\n`], { type: "application/json" }),
      );
      const download = document.createElement("a");
      download.href = url;
      download.download = "system-design-progress.json";
      download.click();
      URL.revokeObjectURL(url);
      setMessage("Progress export prepared.");
    });
  }

  async function importProgress(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await runAction(async () => {
      const text = await file.text();
      const imported = normalizeProgressImport(text);
      summarizeCurriculumProgress(lessonIds, imported.lessons);
      await progressRepository.importProgress(text);
      await refresh();
      setMessage("Progress imported. The previous progress set was replaced.");
    });
  }

  async function resetProgress() {
    const confirmed = confirmReset
      ? confirmReset()
      : window.confirm("Reset all lesson progress stored by this app on this device?");
    if (!confirmed) return;
    await runAction(async () => {
      await progressRepository.resetProgress({ kind: "all" });
      await refresh();
      setMessage("All lesson progress and quiz attempts were reset. Display preferences were not changed.");
    });
  }

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="progress-overview" aria-labelledby="progress-overview-title">
      <div className="progress-overview__summary">
        <p className="eyebrow">Stored on this device</p>
        <h2 id="progress-overview-title">Your theory progress</h2>
        <p aria-live="polite">
          {loading
            ? "Reading local progress…"
            : `${summary.completedTheoryLessons} of ${summary.totalLessons} lessons marked complete (${summary.percentComplete}%).`}
        </p>
        {!loading && continueLesson ? (
          <Link className="text-link" href={continueLesson.href}>
            Continue with {continueLesson.title} <span aria-hidden="true">→</span>
          </Link>
        ) : null}
        {!loading && !continueLesson && summary.totalLessons > 0 ? <p>All theory lessons are complete.</p> : null}
      </div>
      <div className="progress-overview__actions" aria-label="Progress data actions">
        <button className="button button--secondary" type="button" disabled={busy || loading} onClick={exportProgress}>
          Export JSON
        </button>
        <label className="button button--secondary">
          Import JSON
          <input type="file" accept="application/json,.json" disabled={busy} onChange={importProgress} />
        </label>
        <button className="button button--secondary" type="button" disabled={busy || loading} onClick={resetProgress}>
          Reset progress
        </button>
      </div>
      {message ? <p className="progress-message" role="status">{message}</p> : null}
      {error || summaryError ? (
        <p className="progress-error" role="alert">Progress action failed: {error ?? summaryError}</p>
      ) : null}
    </section>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unknown storage error occurred.";
}
