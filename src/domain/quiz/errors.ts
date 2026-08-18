export class QuizValidationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "QuizValidationError";
  }
}
