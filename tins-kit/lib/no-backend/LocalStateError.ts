// lib/no-backend/LocalStateError.ts
//
// Typed error for localStorage failures. The two common cases:
//   - QUOTA_EXCEEDED: user is in private mode, or storage is full
//   - NOT_AVAILABLE: SSR, or storage is disabled

export enum LocalStateErrorCode {
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  NOT_AVAILABLE = 'NOT_AVAILABLE',
  UNKNOWN = 'UNKNOWN',
}

export class LocalStateError extends Error {
  public readonly code: LocalStateErrorCode;
  public readonly cause: Error | undefined;

  constructor(code: LocalStateErrorCode, message: string, cause?: Error) {
    super(message);
    this.name = 'LocalStateError';
    this.code = code;
    this.cause = cause;
  }
}
