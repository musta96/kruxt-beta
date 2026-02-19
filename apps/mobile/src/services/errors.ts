export class KruxtAppError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function throwIfError<TError extends { message: string }>(
  error: TError | null,
  code: string,
  message: string
): void {
  if (error) {
    throw new KruxtAppError(code, message, error);
  }
}
