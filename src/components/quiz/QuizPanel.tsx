"use client";

import { useId, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";

import {
  evaluateQuiz,
  type QuizAnswer,
  type QuizDefinition,
  type QuizEvaluation,
  type QuizQuestion,
} from "@/domain/quiz";
import type { ProgressRepository, QuizAttempt } from "@/domain/progress";
import { IndexedDbProgressRepository } from "@/repositories/indexeddb-progress-repository";

export type QuizAttemptIdFactory = () => string;

export type QuizPanelProps = {
  quiz: QuizDefinition;
  repository?: ProgressRepository;
  attemptIdFactory?: QuizAttemptIdFactory;
};

type AnswerMap = Record<string, QuizAnswer | undefined>;

/**
 * The quiz is intentionally the only stateful boundary in the lesson's
 * theory-to-quiz path. The route can remain a Server Component and pass a
 * serializable definition here; answer selection, feedback, and persistence
 * happen after hydration.
 */
export function QuizPanel({ quiz, repository, attemptIdFactory }: QuizPanelProps) {
  const [progressRepository] = useState(
    () => repository ?? new IndexedDbProgressRepository(),
  );
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [numericValues, setNumericValues] = useState<Record<string, string>>({});
  const [evaluation, setEvaluation] = useState<QuizEvaluation | null>(null);
  const [retryQuestionIds, setRetryQuestionIds] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>(
    "Answer every question, then check your work.",
  );
  const [error, setError] = useState<string | null>(null);
  const firstRetryQuestionRef = useRef<HTMLLegendElement | null>(null);
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const titleId = `quiz-${reactId}-title`;
  const resultId = `quiz-${reactId}-result`;
  const statusId = `quiz-${reactId}-status`;
  const formId = `quiz-${reactId}-form`;
  const firstRetryQuestionId = retryQuestionIds
    ? quiz.questions.find((question) => retryQuestionIds.has(question.id))?.id
    : undefined;

  const allQuestionsAnswered = useMemo(
    () => quiz.questions.every((question) => isAnswerComplete(question, answers[question.id])),
    [answers, quiz.questions],
  );

  const conceptFeedback = evaluation ? summarizeConcepts(evaluation) : null;
  const canRetry = Boolean(evaluation && evaluation.questionResults.some((result) => !result.correct));

  function setSingleChoice(question: Extract<QuizQuestion, { type: "single-choice" }>, event: ChangeEvent<HTMLInputElement>) {
    setAnswers((current) => ({
      ...current,
      [question.id]: {
        questionId: question.id,
        type: "single-choice",
        selectedOptionId: event.target.value,
      },
    }));
    clearTransientState();
  }

  function setMultipleChoice(
    question: Extract<QuizQuestion, { type: "multiple-choice" }>,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const current = answers[question.id];
    const selected = new Set(
      current?.type === "multiple-choice" ? current.selectedOptionIds : [],
    );
    if (event.target.checked) selected.add(event.target.value);
    else selected.delete(event.target.value);

    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [question.id]: {
        questionId: question.id,
        type: "multiple-choice",
        selectedOptionIds: [...selected],
      },
    }));
    clearTransientState();
  }

  function setNumericAnswer(
    question: Extract<QuizQuestion, { type: "numeric-estimation" }>,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const value = event.target.value;
    setNumericValues((current) => ({ ...current, [question.id]: value }));
    const parsed = Number(value);
    setAnswers((current) => ({
      ...current,
      [question.id]: value.trim() !== "" && Number.isFinite(parsed)
        ? {
            questionId: question.id,
            type: "numeric-estimation",
            value: parsed,
            unit: question.unit,
          }
        : undefined,
    }));
    clearTransientState();
  }

  async function submitQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || evaluation || !allQuestionsAnswered) return;

    setBusy(true);
    setError(null);
    setStatusMessage("Checking your answers…");

    try {
      const orderedAnswers = quiz.questions.map((question) => answers[question.id]).filter(isQuizAnswer);
      const nextEvaluation = evaluateQuiz(quiz, orderedAnswers);
      setEvaluation(nextEvaluation);

      const attempt: QuizAttempt = {
        attemptId: (attemptIdFactory ?? createAttemptId)(),
        quizId: nextEvaluation.quizId,
        lessonId: nextEvaluation.lessonId,
        answers: nextEvaluation.normalizedAnswers,
        earnedPoints: nextEvaluation.earnedPoints,
        possiblePoints: nextEvaluation.possiblePoints,
        scorePercent: nextEvaluation.scorePercent,
        passed: nextEvaluation.passed,
        incorrectConceptTags: nextEvaluation.incorrectConceptTags,
      };

      setStatusMessage("Saving your quiz result…");
      await progressRepository.saveQuizAttempt(attempt);
      setStatusMessage(
        nextEvaluation.passed
          ? "Quiz passed and progress saved on this device."
          : "Quiz result saved. Review the concepts below before retrying.",
      );
    } catch (cause) {
      setError(errorMessage(cause));
      setStatusMessage("The quiz was evaluated, but the result could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  function retryWeakConcepts() {
    if (!evaluation) return;
    const incorrectIds = new Set(
      evaluation.questionResults.filter((result) => !result.correct).map((result) => result.questionId),
    );
    const previousAnswers = Object.fromEntries(
      evaluation.normalizedAnswers
        .filter((answer) => !incorrectIds.has(answer.questionId))
        .map((answer) => [answer.questionId, answer]),
    ) as AnswerMap;
    const previousNumericValues = Object.fromEntries(
      evaluation.normalizedAnswers
        .filter((answer): answer is Extract<QuizAnswer, { type: "numeric-estimation" }> =>
          answer.type === "numeric-estimation" && !incorrectIds.has(answer.questionId),
        )
        .map((answer) => [answer.questionId, String(answer.value)]),
    );

    setAnswers(previousAnswers);
    setNumericValues(previousNumericValues);
    setRetryQuestionIds(incorrectIds);
    setEvaluation(null);
    setError(null);
    setStatusMessage("Retry the questions marked for review, then check your work again.");
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => firstRetryQuestionRef.current?.focus());
    } else {
      firstRetryQuestionRef.current?.focus();
    }
  }

  function clearTransientState() {
    if (evaluation) return;
    setError(null);
  }

  return (
    <section className="quiz-panel" aria-labelledby={titleId}>
      <div className="quiz-panel__header">
        <p className="eyebrow">Structured retrieval practice</p>
        <h2 id={titleId}>{quiz.title}</h2>
        <p>
          Answer all {quiz.questions.length} questions. The pass threshold is {quiz.passThresholdPercent}%.
        </p>
      </div>

      <p
        className="quiz-panel__status"
        id={statusId}
        role="status"
        aria-label="Quiz status"
        aria-live="polite"
        aria-atomic="true"
      >
        {busy ? "Saving your quiz result…" : statusMessage}
      </p>

      <form className="quiz-panel__form" id={formId} onSubmit={submitQuiz} aria-label="Quiz answers">
        {quiz.questions.map((question, index) => {
          const result = evaluation?.questionResults.find((candidate) => candidate.questionId === question.id);
          const retryLocked = retryQuestionIds !== null && !retryQuestionIds.has(question.id);
          return (
            <fieldset
              className={`quiz-question${result ? ` quiz-question--${result.correct ? "correct" : "review"}` : ""}`}
              key={question.id}
              disabled={busy || Boolean(evaluation) || retryLocked}
              aria-describedby={result ? `${question.id}-${reactId}-feedback` : undefined}
            >
              <legend
                ref={question.id === firstRetryQuestionId ? firstRetryQuestionRef : undefined}
                tabIndex={retryQuestionIds?.has(question.id) ? -1 : undefined}
              >
                <span className="quiz-question__number">Question {index + 1}</span>
                <span className="quiz-question__prompt">{question.prompt}</span>
              </legend>

              {question.type === "single-choice"
                ? question.options.map((option) => {
                    const inputId = `${question.id}-${reactId}-${option.id}`;
                    const answer = answers[question.id];
                    const checked = answer?.type === "single-choice" && answer.selectedOptionId === option.id;
                    return (
                      <label className="quiz-choice" htmlFor={inputId} key={option.id}>
                        <input
                          id={inputId}
                          name={`${formId}-${question.id}`}
                          type="radio"
                          value={option.id}
                          checked={checked}
                          onChange={(event) => setSingleChoice(question, event)}
                        />
                        <span>{option.label}</span>
                      </label>
                    );
                  })
                : question.type === "multiple-choice"
                  ? question.options.map((option) => {
                      const inputId = `${question.id}-${reactId}-${option.id}`;
                      const answer = answers[question.id];
                      const selected = answer?.type === "multiple-choice"
                        ? answer.selectedOptionIds.includes(option.id)
                        : false;
                      return (
                        <label className="quiz-choice" htmlFor={inputId} key={option.id}>
                          <input
                            id={inputId}
                            name={`${formId}-${question.id}-${option.id}`}
                            type="checkbox"
                            value={option.id}
                            checked={selected}
                            onChange={(event) => setMultipleChoice(question, event)}
                          />
                          <span>{option.label}</span>
                        </label>
                      );
                    })
                  : renderNumericQuestion(question, question.id, reactId, numericValues, setNumericAnswer)}

              {result ? (
                <p
                  className="quiz-question__feedback"
                  id={`${question.id}-${reactId}-feedback`}
                  role="status"
                  aria-live="polite"
                >
                  <strong>{result.correct ? "Correct" : "Review"}</strong> — {result.explanation}
                </p>
              ) : null}
            </fieldset>
          );
        })}

        {!evaluation ? (
          <button className="button button--primary quiz-panel__submit" type="submit" disabled={busy || !allQuestionsAnswered}>
            {busy ? "Saving result…" : "Check answers"}
          </button>
        ) : null}
      </form>

      {evaluation ? (
        <section className={`quiz-result${evaluation.passed ? " quiz-result--passed" : " quiz-result--review"}`} aria-labelledby={resultId}>
          <h3 id={resultId}>{evaluation.passed ? "Quiz passed" : "Keep practicing"}</h3>
          <p className="quiz-result__score">
            {evaluation.earnedPoints} / {evaluation.possiblePoints} ({evaluation.scorePercent}%). Pass threshold: {evaluation.passThresholdPercent}%.
          </p>
          <div className="quiz-result__concepts">
            <div>
              <h4>Strong</h4>
              {conceptFeedback?.strong.length ? (
                <ul>{conceptFeedback.strong.map((tag) => <li key={tag}>{tag}</li>)}</ul>
              ) : <p>No concepts scored as strong yet.</p>}
            </div>
            <div>
              <h4>Review</h4>
              {conceptFeedback?.review.length ? (
                <ul>{conceptFeedback.review.map((tag) => <li key={tag}>{tag}</li>)}</ul>
              ) : <p>No concepts need review.</p>}
            </div>
          </div>
          {canRetry ? (
            <button className="button button--secondary quiz-result__retry" type="button" onClick={retryWeakConcepts} disabled={busy}>
              Retry weak concepts
            </button>
          ) : null}
        </section>
      ) : null}

      {error ? <p className="quiz-panel__error" role="alert">Quiz result was not saved: {error}</p> : null}
    </section>
  );
}

function renderNumericQuestion(
  question: Extract<QuizQuestion, { type: "numeric-estimation" }>,
  questionId: string,
  reactId: string,
  numericValues: Record<string, string>,
  onChange: (question: Extract<QuizQuestion, { type: "numeric-estimation" }>, event: ChangeEvent<HTMLInputElement>) => void,
) {
  const inputId = `${questionId}-${reactId}-numeric`;
  return (
    <label className="quiz-numeric" htmlFor={inputId}>
      <span className="quiz-numeric__label">Your estimate</span>
      <span className="quiz-numeric__control">
        <input
          id={inputId}
          name={`${reactId}-${questionId}`}
          type="number"
          inputMode="decimal"
          step="any"
          value={numericValues[question.id] ?? ""}
          onChange={(event) => onChange(question, event)}
        />
        <span aria-hidden="true">{question.unit}</span>
        <span className="quiz-sr-only">Unit: {question.unit}</span>
      </span>
    </label>
  );
}

function isAnswerComplete(question: QuizQuestion, answer: QuizAnswer | undefined): boolean {
  if (!answer || answer.questionId !== question.id || answer.type !== question.type) return false;
  if (answer.type === "multiple-choice") return answer.selectedOptionIds.length > 0;
  if (answer.type === "numeric-estimation") return Number.isFinite(answer.value);
  return answer.selectedOptionId.length > 0;
}

function isQuizAnswer(value: QuizAnswer | undefined): value is QuizAnswer {
  return value !== undefined;
}

function summarizeConcepts(evaluation: QuizEvaluation): { strong: string[]; review: string[] } {
  const review = new Set(evaluation.incorrectConceptTags);
  const strong = new Set<string>();
  for (const result of evaluation.questionResults) {
    if (!result.correct) continue;
    for (const tag of result.conceptTags) {
      if (!review.has(tag)) strong.add(tag);
    }
  }
  return {
    strong: [...strong].sort(),
    review: [...review].sort(),
  };
}

function createAttemptId(): string {
  const cryptoObject = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoObject?.randomUUID) return cryptoObject.randomUUID();
  if (cryptoObject?.getRandomValues) {
    const bytes = cryptoObject.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  throw new Error(
    "Quiz attempt IDs require browser cryptography or an injected attemptIdFactory.",
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unknown quiz storage error occurred.";
}
