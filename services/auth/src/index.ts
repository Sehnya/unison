// Auth Service exports
export { AuthService } from './service.js';
export type { AuthServiceConfig, RegisterResult, LoginResult } from './service.js';

// Repository
export { AuthRepository } from './repository.js';

// Errors
export {
  AuthError,
  AuthErrorCode,
  InvalidCredentialsError,
  EmailAlreadyExistsError,
  InvalidEmailFormatError,
  WeakPasswordError,
  TokenExpiredError,
  TokenInvalidError,
  RefreshTokenInvalidError,
  SessionRevokedError,
  SessionNotFoundError,
  UserNotFoundError,
} from './errors.js';

// Validation
export { isValidEmail, validatePassword, validateUsername, PASSWORD_REQUIREMENTS } from './validation.js';

// Password utilities
export { hashPassword, verifyPassword } from './password.js';

// Token utilities
export {
  generateTokenPair,
  generateRefreshToken,
  hashRefreshToken,
  generateAccessToken,
  validateAccessToken,
  decodeToken,
  DEFAULT_TOKEN_CONFIG,
} from './tokens.js';
export type { TokenConfig } from './tokens.js';
