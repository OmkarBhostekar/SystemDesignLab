/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuizPanel } from "@/components/quiz";
import type { ProgressRepository, QuizAttempt } from "@/domain/progress";
import type { QuizDefinition } from "@/domain/quiz";

afterEach(cleanup);

const quiz: QuizDefinition = {
  id: "foundations-checkpoint",
  lessonId: "01-03-latency-vs-throughput",
  title: "Foundations checkpoint",
  passThresholdPercent: 100,
  questions: [
    {
      id: "latency-definition",
      lessonId: "01-03-latency-vs-throughput",
      type: "single-choice",
      prompt: "Which quantity describes the elapsed time for one operation?",
      options: [
        { id: "latency", label: "Latency" },
        { id: "throughput", label: "Throughput" },
      ],
      correctOptionId: "latency",
      explanation: "Latency is the time taken by one operation at a defined boundary.",
      conceptTags: ["latency"],
    },
    {
      id: "queue-protection",
      lessonId: "01-03-latency-vs-throughput",
      type: "multiple-choice",
      prompt: "Which choices make overload behavior explicit?",
      options: [
        { id: "bounded-queue", label: "Bound the queue" },
        { id: "admission-control", label: "Use admission control" },
        { id: "unbounded-queue", label: "Accept an unbounded queue" },
      ],
      correctOptionIds: ["admission-control", "bounded-queue"],
      explanation: "Bounded queues and admission control protect finite capacity.",
      conceptTags: ["backpressure", "overload"],
    },
    {
      id: "little-law",
      lessonId: "01-03-latency-vs-throughput",
      type: "numeric-estimation",
      prompt: "At 100 requests/s and 0.2 seconds average time, how much work is in flight?",
      correctValue: 20,
      tolerance: { kind: "absolute", value: 0.5 },
      unit: "requests",
      explanation: "Little's Law gives L = λ × W = 100 × 0.2 = 20 requests.",
      conceptTags: ["littles-law"],
    },
  ],
};

function createRepository(overrides: Partial<ProgressRepository> = {}) {
  const saveQuizAttempt = vi.fn(async (attempt: QuizAttempt) => attempt);
  return {
    saveQuizAttempt,
    ...overrides,
  } as unknown as ProgressRepository & { saveQuizAttempt: typeof saveQuizAttempt };
}

function chooseCorrectAnswers() {
  fireEvent.click(screen.getByRole("radio", { name: "Latency" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Bound the queue" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Use admission control" }));
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "20" } });
}

function submitAnswers() {
  fireEvent.submit(screen.getByRole("form", { name: "Quiz answers" }));
}

function quizStatus() {
  return screen.getByRole("status", { name: "Quiz status" });
}

describe("QuizPanel", () => {
  it("uses native controls and persists a correct result with explanations and concepts", async () => {
    const repository = createRepository();
    render(<QuizPanel quiz={quiz} repository={repository} attemptIdFactory={() => "attempt-first"} />);

    expect(screen.getAllByRole("group")).toHaveLength(3);
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(screen.getByRole("spinbutton")).toHaveAttribute("type", "number");
    expect(screen.getByRole("button", { name: "Check answers" })).toBeDisabled();

    chooseCorrectAnswers();
    expect(screen.getByRole("button", { name: "Check answers" })).toBeEnabled();
    submitAnswers();

    expect(await screen.findByRole("heading", { name: "Quiz passed" })).toBeVisible();
    expect(screen.getByText("3 / 3 (100%). Pass threshold: 100%." )).toBeVisible();
    expect(quizStatus()).toHaveTextContent("Quiz passed and progress saved");
    expect(screen.getByText("Latency")).toBeVisible();
    expect(screen.getByText("backpressure")).toBeVisible();
    const numericFeedback = screen.getAllByRole("status").find((status) =>
      status.textContent?.includes("Little's Law gives L = λ × W = 100 × 0.2 = 20 requests."),
    );
    expect(numericFeedback).toBeDefined();
    expect(numericFeedback).toHaveTextContent("Little's Law gives L = λ × W = 100 × 0.2 = 20 requests.");
    expect(repository.saveQuizAttempt).toHaveBeenCalledWith(expect.objectContaining({
      attemptId: "attempt-first",
      quizId: quiz.id,
      lessonId: quiz.lessonId,
      passed: true,
      earnedPoints: 3,
      possiblePoints: 3,
      incorrectConceptTags: [],
    }));
  });

  it("reports incorrect explanations, saves the failed attempt, and retries weak questions", async () => {
    const repository = createRepository();
    render(<QuizPanel quiz={quiz} repository={repository} attemptIdFactory={() => "attempt-retry"} />);

    fireEvent.click(screen.getByRole("radio", { name: "Throughput" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Bound the queue" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Use admission control" }));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "20" } });
    submitAnswers();

    expect(await screen.findByRole("heading", { name: "Keep practicing" })).toBeVisible();
    expect(screen.getByText(/Latency is the time taken by one operation/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry weak concepts" })).toBeVisible();
    expect(repository.saveQuizAttempt).toHaveBeenCalledWith(expect.objectContaining({
      passed: false,
      incorrectConceptTags: ["latency"],
    }));

    fireEvent.click(screen.getByRole("button", { name: "Retry weak concepts" }));
    expect(screen.getByRole("radio", { name: "Latency" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Bound the queue" })).toBeDisabled();
    expect(screen.getByRole("spinbutton")).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "Latency" }));
    submitAnswers();

    expect(await screen.findByRole("heading", { name: "Quiz passed" })).toBeVisible();
    expect(repository.saveQuizAttempt).toHaveBeenCalledTimes(2);
  });

  it("announces the pending save state and disables controls until persistence settles", async () => {
    let resolveSave!: () => void;
    const repository = createRepository({
      saveQuizAttempt: vi.fn((attempt: QuizAttempt) => new Promise<QuizAttempt>((resolve) => {
        resolveSave = () => resolve(attempt);
      })),
    });
    render(<QuizPanel quiz={quiz} repository={repository} attemptIdFactory={() => "attempt-pending"} />);

    chooseCorrectAnswers();
    submitAnswers();
    expect(await screen.findByRole("status", { name: "Quiz status" })).toHaveTextContent("Saving your quiz result");
    expect(screen.queryByRole("button", { name: /Check answers|Saving result/ })).toBeNull();
    expect(screen.getByRole("radio", { name: "Latency" })).toBeDisabled();

    resolveSave();
    expect(await screen.findByText("Quiz passed and progress saved on this device.")).toBeVisible();
  });

  it("keeps evaluation feedback visible and announces storage failures", async () => {
    const repository = createRepository({
      saveQuizAttempt: vi.fn(async () => {
        throw new Error("IndexedDB is unavailable");
      }),
    });
    render(<QuizPanel quiz={quiz} repository={repository} attemptIdFactory={() => "attempt-error"} />);

    chooseCorrectAnswers();
    submitAnswers();

    expect(await screen.findByRole("heading", { name: "Quiz passed" })).toBeVisible();
    expect(await screen.findByRole("alert")).toHaveTextContent("IndexedDB is unavailable");
    expect(quizStatus()).toHaveTextContent("could not be saved");
  });

  it("accepts a form submit after native keyboard-oriented answer entry", async () => {
    const repository = createRepository();
    render(<QuizPanel quiz={quiz} repository={repository} attemptIdFactory={() => "attempt-keyboard"} />);

    const latency = screen.getByRole("radio", { name: "Latency" });
    latency.focus();
    fireEvent.keyDown(latency, { key: "ArrowDown", code: "ArrowDown" });
    fireEvent.click(latency);
    fireEvent.click(screen.getByRole("checkbox", { name: "Bound the queue" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Use admission control" }));
    const numeric = screen.getByRole("spinbutton");
    numeric.focus();
    fireEvent.change(numeric, { target: { value: "20" } });
    fireEvent.keyDown(numeric, { key: "Enter", code: "Enter" });
    submitAnswers();

    expect(await screen.findByRole("heading", { name: "Quiz passed" })).toBeVisible();
    expect(repository.saveQuizAttempt).toHaveBeenCalledTimes(1);
  });

  it("renders a repository rejection without marking the result as unsaved success", async () => {
    const repository = createRepository({
      saveQuizAttempt: vi.fn(async () => {
        throw new Error("write failed");
      }),
    });
    render(<QuizPanel quiz={quiz} repository={repository} attemptIdFactory={() => "attempt-failed"} />);

    chooseCorrectAnswers();
    submitAnswers();
    await waitFor(() => expect(repository.saveQuizAttempt).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("alert")).toHaveTextContent("write failed");
    expect(screen.queryByText("Quiz passed and progress saved on this device.")).toBeNull();
  });
});
