/**
 * Auth Service Error Codes
 */
export declare enum AuthErrorCode {
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
    EMAIL_ALREADY_EXISTS = "EMAIL_ALREADY_EXISTS",
    INVALID_EMAIL_FORMAT = "INVALID_EMAIL_FORMAT",
    WEAK_PASSWORD = "WEAK_PASSWORD",
    TOKEN_EXPIRED = "TOKEN_EXPIRED",
    TOKEN_INVALID = "TOKEN_INVALID",
    REFRESH_TOKEN_INVALID = "REFRESH_TOKEN_INVALID",
    SESSION_REVOKED = "SESSION_REVOKED",
    SESSION_NOT_FOUND = "SESSION_NOT_FOUND",
    USER_NOT_FOUND = "USER_NOT_FOUND"
}
/**
 * Base Auth Service Error
 */
export declare class AuthError extends Error {
    readonly code: AuthErrorCode;
    constructor(code: AuthErrorCode, message: string);
}
/**
 * Invalid credentials error (login failure)
 */
export declare class InvalidCredentialsError extends AuthError {
    constructor();
}
/**
 * Email already exists error (registration)
 */
export declare class EmailAlreadyExistsError extends AuthError {
    constructor();
}
/**
 * Invalid email format error
 */
export declare class InvalidEmailFormatError extends AuthError {
    constructor();
}
/**
 * Weak password error
 */
export declare class WeakPasswordError extends AuthError {
    constructor(requirements: string);
}
/**
 * Token expired error
 */
export declare class TokenExpiredError extends AuthError {
    constructor();
}
/**
 * Token invalid error
 */
export declare class TokenInvalidError extends AuthError {
    constructor();
}
/**
 * Refresh token invalid error
 */
export declare class RefreshTokenInvalidError extends AuthError {
    constructor();
}
/**
 * Session revoked error
 */
export declare class SessionRevokedError extends AuthError {
    constructor();
}
/**
 * Session not found error
 */
export declare class SessionNotFoundError extends AuthError {
    constructor();
}
/**
 * User not found error
 */
export declare class UserNotFoundError extends AuthError {
    constructor();
}
//# sourceMappingURL=errors.d.ts.map