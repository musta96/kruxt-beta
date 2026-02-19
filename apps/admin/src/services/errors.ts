export class KruxtAdminError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function throwIfAdminError<TError extends { message: string }>(
  error: TError | null,
  code: string,
  message: string
): void {
  if (error) {
    throw new KruxtAdminError(code, message, error);
  }
}
