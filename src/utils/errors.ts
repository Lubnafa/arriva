/** Base application error with HTTP mapping and operational flag. */
export class AppError extends Error {
  public readonly statusCode: number;

  public readonly code: string;

  public readonly isOperational: boolean;

  public constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational: boolean,
  ) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, new.target);
  }
}

/** Client sent invalid input (Zod or business validation). */
export class ValidationError extends AppError {
  public readonly fields: ReadonlyArray<{ field: string; message: string }>;

  public constructor(fields: ReadonlyArray<{ field: string; message: string }>) {
    super('Validation failed', 400, 'VALIDATION_ERROR', true);
    this.fields = fields;
  }
}

/** Missing or invalid API key. */
export class UnauthorizedError extends AppError {
  public constructor() {
    super('Unauthorized', 401, 'UNAUTHORIZED', true);
  }
}

/** Resource or tool not found. */
export class NotFoundError extends AppError {
  public constructor(message: string) {
    super(message, 404, 'NOT_FOUND', true);
  }
}

/** Too many requests for the authenticated partner. */
export class RateLimitError extends AppError {
  public readonly retryAfterMs: number;

  public constructor(retryAfterMs: number) {
    super('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED', true);
    this.retryAfterMs = retryAfterMs;
  }
}

/** Circuit breaker is open; dependency is unavailable. */
export class CircuitOpenError extends AppError {
  public constructor(message: string) {
    super(message, 503, 'SERVICE_UNAVAILABLE', true);
  }
}

/** Upstream HTTP or network failure after retries/circuit handling. */
export class UpstreamError extends AppError {
  public constructor(message: string) {
    super(message, 502, 'UPSTREAM_ERROR', true);
  }
}

/** Unexpected server error (bugs). */
export class InternalError extends AppError {
  public constructor(message: string) {
    super(message, 500, 'INTERNAL_ERROR', false);
  }
}
