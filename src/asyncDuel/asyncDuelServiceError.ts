import type { AsyncDuelErrorCode } from './asyncDuelTypes';

export class AsyncDuelServiceError extends Error {
  readonly code: AsyncDuelErrorCode;

  constructor(code: AsyncDuelErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AsyncDuelServiceError';
    this.code = code;
  }
}
