export const QUIZ_QUESTION_TYPES = [
  "single-choice",
  "multiple-choice",
  "numeric-estimation",
] as const;

export type QuizQuestionType = (typeof QUIZ_QUESTION_TYPES)[number];

export type QuizOption = {
  id: string;
  label: string;
};
type QuizQuestionBase = {
  id: string;
  lessonId: string;
  prompt: string;
  explanation: string;
  conceptTags: string[];
};

export type SingleChoiceQuestion = QuizQuestionBase & {
  type: "single-choice";
  options: QuizOption[];
  correctOptionId: string;
};

export type MultipleChoiceQuestion = QuizQuestionBase & {
  type: "multiple-choice";
  options: QuizOption[];
  correctOptionIds: string[];
};

export type NumericEstimationQuestion = QuizQuestionBase & {
  type: "numeric-estimation";
  correctValue: number;
  tolerance: {
    kind: "absolute";
    value: number;
  };
  unit: string;
};

export type QuizQuestion =
  | SingleChoiceQuestion
  | MultipleChoiceQuestion
  | NumericEstimationQuestion;

export type QuizDefinition = {
  id: string;
  lessonId: string;
  title: string;
  passThresholdPercent: number;
  questions: QuizQuestion[];
};

export type SingleChoiceAnswer = {
  questionId: string;
  type: "single-choice";
  selectedOptionId: string;
};

export type MultipleChoiceAnswer = {
  questionId: string;
  type: "multiple-choice";
  selectedOptionIds: string[];
};

export type NumericEstimationAnswer = {
  questionId: string;
  type: "numeric-estimation";
  value: number;
  unit: string;
};

export type QuizAnswer =
  | SingleChoiceAnswer
  | MultipleChoiceAnswer
  | NumericEstimationAnswer;

export type QuizQuestionResult = {
  questionId: string;
  correct: boolean;
  earnedPoints: 0 | 1;
  explanation: string;
  conceptTags: string[];
};

export type QuizEvaluation = {
  quizId: string;
  lessonId: string;
  earnedPoints: number;
  possiblePoints: number;
  scorePercent: number;
  passThresholdPercent: number;
  passed: boolean;
  questionResults: QuizQuestionResult[];
  incorrectConceptTags: string[];
  normalizedAnswers: QuizAnswer[];
};
