export class AppError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(code: string, message: string, status = 500) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message, 400);
    this.name = "ValidationError";
  }
}

export class AuthError extends AppError {
  constructor(message: string) {
    super("AUTH_ERROR", message, 401);
    this.name = "AuthError";
  }
}

export class ExternalApiError extends AppError {
  constructor(message: string, status = 502) {
    super("EXTERNAL_API_ERROR", message, status);
    this.name = "ExternalApiError";
  }
}
