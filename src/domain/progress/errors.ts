export class ProgressValidationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ProgressValidationError";
  }
}

export class UnsupportedProgressVersionError extends ProgressValidationError {
  constructor(version: unknown) {
    super(`Unsupported progress export schema version: ${String(version)}.`);
    this.name = "UnsupportedProgressVersionError";
  }
}

export class ProgressStorageError extends Error {
  readonly operation: string;

  constructor(operation: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ProgressStorageError";
    this.operation = operation;
  }
}
