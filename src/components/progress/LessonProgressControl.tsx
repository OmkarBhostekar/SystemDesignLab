"use client";

import { useEffect, useState } from "react";

import {
  compareLessonProgressStages,
  type LessonProgress,
  type ProgressRepository,
} from "@/domain/progress";
import { IndexedDbProgressRepository } from "@/repositories/indexeddb-progress-repository";

type LessonProgressControlProps = {
  lessonId: string;
  repository?: ProgressRepository;
};

export function LessonProgressControl({ lessonId, repository }: LessonProgressControlProps) {
  const [progressRepository] = useState(
    () => repository ?? new IndexedDbProgressRepository(),
  );
  const [progress, setProgress] = useState<LessonProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    progressRepository
      .getLessonProgress(lessonId)
      .then((value) => {
        if (active) setProgress(value);
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
  }, [lessonId, progressRepository]);

  const theoryComplete =
    progress !== null && compareLessonProgressStages(progress.stage, "theory-complete") >= 0;

  async function markTheoryComplete() {
    setSaving(true);
    setError(null);
    try {
      setProgress(await progressRepository.applyLessonMilestone(lessonId, "theory-complete"));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="lesson-progress" aria-labelledby="lesson-progress-title">
      <div>
        <p className="eyebrow">Local progress</p>
        <h2 id="lesson-progress-title">{theoryComplete ? "Theory complete" : "Track this lesson"}</h2>
        <p aria-live="polite">
          {loading
            ? "Reading progress from this browser…"
            : theoryComplete
              ? "Saved locally on this device. Repeating this action will not change later progress."
              : "Mark the theory complete when you can explain the lesson’s core trade-off."}
        </p>
      </div>
      <button
        className="button button--primary"
        type="button"
        disabled={loading || saving || theoryComplete}
        onClick={markTheoryComplete}
      >
        {saving ? "Saving…" : theoryComplete ? "Theory completed" : "Mark theory complete"}
      </button>
      {error ? <p className="progress-error" role="alert">Progress was not saved: {error}</p> : null}
    </section>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unknown storage error occurred.";
}
