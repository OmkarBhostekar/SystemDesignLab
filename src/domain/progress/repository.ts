import type {
  LessonProgress,
  LessonProgressMilestone,
  ProgressExport,
  ProgressResetScope,
  QuizAttempt,
  SimulationCompletion,
} from "./model";

export interface ProgressRepository {
  getLessonProgress(lessonId: string): Promise<LessonProgress | null>;
  listLessonProgress(): Promise<LessonProgress[]>;
  saveLessonProgress(progress: LessonProgress): Promise<LessonProgress>;
  applyLessonMilestone(
    lessonId: string,
    milestone: LessonProgressMilestone,
  ): Promise<LessonProgress>;
  getQuizAttempt(attemptId: string): Promise<QuizAttempt | null>;
  listQuizAttempts(): Promise<QuizAttempt[]>;
  saveQuizAttempt(attempt: QuizAttempt): Promise<QuizAttempt>;
  getSimulationCompletion(completionId: string): Promise<SimulationCompletion | null>;
  listSimulationCompletions(): Promise<SimulationCompletion[]>;
  saveSimulationCompletion(completion: SimulationCompletion): Promise<SimulationCompletion>;
  exportProgress(): Promise<ProgressExport>;
  importProgress(data: unknown): Promise<void>;
  resetProgress(scope: ProgressResetScope): Promise<void>;
}
