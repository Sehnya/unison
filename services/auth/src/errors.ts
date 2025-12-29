/**
 * Auth Service Error Codes
 */
export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  INVALID_EMAIL_FORMAT = 'INVALID_EMAIL_FORMAT',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  REFRESH_TOKEN_INVALID = 'REFRESH_TOKEN_INVALID',
  SESSION_REVOKED = 'SESSION_REVOKED',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
}

/**
 * Base Auth Service Error
 */
export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Invalid credentials error (login failure)
 */
export class InvalidCredentialsError extends AuthError {
  constructor() {
    super(AuthErrorCode.INVALID_CREDENTIALS, 'Invalid credentials');
  }
}

/**
 * Email already exists error (registration)
 */
export class EmailAlreadyExistsError extends AuthError {
  constructor() {
    super(AuthErrorCode.EMAIL_ALREADY_EXISTS, 'Email already registered');
  }
}

/**
 * Invalid email format error
 */
export class InvalidEmailFormatError extends AuthError {
  constructor() {
    super(AuthErrorCode.INVALID_EMAIL_FORMAT, 'Invalid email format');
  }
}

/**
 * Weak password error
 */
export class WeakPasswordError extends AuthError {
  constructor(requirements: string) {
    super(AuthErrorCode.WEAK_PASSWORD, `Password does not meet requirements: ${requirements}`);
  }
}

/**
 * Token expired error
 */
export class TokenExpiredError extends AuthError {
  constructor() {
    super(AuthErrorCode.TOKEN_EXPIRED, 'Token expired');
  }
}

/**
 * Token invalid error
 */
export class TokenInvalidError extends AuthError {
  constructor() {
    super(AuthErrorCode.TOKEN_INVALID, 'Invalid token');
  }
}

/**
 * Refresh token invalid error
 */
export class RefreshTokenInvalidError extends AuthError {
  constructor() {
    super(AuthErrorCode.REFRESH_TOKEN_INVALID, 'Invalid refresh token');
  }
}

/**
 * Session revoked error
 */
export class SessionRevokedError extends AuthError {
  constructor() {
    super(AuthErrorCode.SESSION_REVOKED, 'Session revoked');
  }
}

/**
 * Session not found error
 */
export class SessionNotFoundError extends AuthError {
  constructor() {
    super(AuthErrorCode.SESSION_NOT_FOUND, 'Session not found');
  }
}

/**
 * User not found error
 */
export class UserNotFoundError extends AuthError {
  constructor() {
    super(AuthErrorCode.USER_NOT_FOUND, 'User not found');
  }
}
