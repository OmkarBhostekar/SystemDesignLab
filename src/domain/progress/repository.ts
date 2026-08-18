import type {
  LessonProgress,
  LessonProgressMilestone,
  ProgressExport,
  ProgressResetScope,
  QuizAttempt,
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
  exportProgress(): Promise<ProgressExport>;
  importProgress(data: unknown): Promise<void>;
  resetProgress(scope: ProgressResetScope): Promise<void>;
}
