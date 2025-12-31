/**
 * API Error Handling
 *
 * Maps service errors to HTTP responses with consistent error format.
 * Requirements: All error handling requirements
 */

import type { Response } from 'express';

/**
 * API Error codes
 */
export enum ApiErrorCode {
  // Authentication errors
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

  // Guild errors
  GUILD_NOT_FOUND = 'GUILD_NOT_FOUND',
  NOT_GUILD_OWNER = 'NOT_GUILD_OWNER',
  NOT_GUILD_MEMBER = 'NOT_GUILD_MEMBER',
  ALREADY_MEMBER = 'ALREADY_MEMBER',
  USER_BANNED = 'USER_BANNED',
  INVITE_INVALID = 'INVITE_INVALID',
  INVITE_EXPIRED = 'INVITE_EXPIRED',

  // Permission errors
  MISSING_PERMISSION = 'MISSING_PERMISSION',
  ROLE_NOT_FOUND = 'ROLE_NOT_FOUND',
  ROLE_HIERARCHY_VIOLATION = 'ROLE_HIERARCHY_VIOLATION',
  CANNOT_MODIFY_EVERYONE = 'CANNOT_MODIFY_EVERYONE',

  // Channel errors
  CHANNEL_NOT_FOUND = 'CHANNEL_NOT_FOUND',
  INVALID_CHANNEL_TYPE = 'INVALID_CHANNEL_TYPE',
  INVALID_PARENT = 'INVALID_PARENT',

  // Message errors
  MESSAGE_NOT_FOUND = 'MESSAGE_NOT_FOUND',
  NOT_MESSAGE_AUTHOR = 'NOT_MESSAGE_AUTHOR',
  MESSAGE_TOO_LONG = 'MESSAGE_TOO_LONG',
  EMPTY_MESSAGE = 'EMPTY_MESSAGE',

  // General errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
}

/**
 * API Error response format
 */
export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    field?: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Base API Error class
 */
export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    public readonly statusCode: number,
    message: string,
    public readonly field?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }

  toResponse(): ApiErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.field && { field: this.field }),
        ...(this.details && { details: this.details }),
      },
    };
  }
}

/**
 * Error mapping from service errors to API errors
 */
const errorMappings: Record<string, { code: ApiErrorCode; status: number; message: string }> = {
  // Auth errors
  InvalidCredentialsError: { code: ApiErrorCode.INVALID_CREDENTIALS, status: 401, message: 'Invalid credentials' },
  EmailAlreadyExistsError: { code: ApiErrorCode.EMAIL_ALREADY_EXISTS, status: 409, message: 'Email already registered' },
  InvalidEmailFormatError: { code: ApiErrorCode.INVALID_EMAIL_FORMAT, status: 400, message: 'Invalid email format' },
  WeakPasswordError: { code: ApiErrorCode.WEAK_PASSWORD, status: 400, message: 'Password does not meet requirements' },
  TokenExpiredError: { code: ApiErrorCode.TOKEN_EXPIRED, status: 401, message: 'Token expired' },
  TokenInvalidError: { code: ApiErrorCode.TOKEN_INVALID, status: 401, message: 'Invalid token' },
  RefreshTokenInvalidError: { code: ApiErrorCode.REFRESH_TOKEN_INVALID, status: 401, message: 'Invalid refresh token' },
  SessionRevokedError: { code: ApiErrorCode.SESSION_REVOKED, status: 401, message: 'Session revoked' },
  SessionNotFoundError: { code: ApiErrorCode.SESSION_NOT_FOUND, status: 404, message: 'Session not found' },
  UserNotFoundError: { code: ApiErrorCode.USER_NOT_FOUND, status: 404, message: 'User not found' },

  // Guild errors
  GuildNotFoundError: { code: ApiErrorCode.GUILD_NOT_FOUND, status: 404, message: 'Guild not found' },
  NotGuildOwnerError: { code: ApiErrorCode.NOT_GUILD_OWNER, status: 403, message: 'Not guild owner' },
  NotGuildMemberError: { code: ApiErrorCode.NOT_GUILD_MEMBER, status: 403, message: 'Not a guild member' },
  AlreadyMemberError: { code: ApiErrorCode.ALREADY_MEMBER, status: 409, message: 'Already a member' },
  UserBannedError: { code: ApiErrorCode.USER_BANNED, status: 403, message: 'You are banned from this guild' },
  InviteNotFoundError: { code: ApiErrorCode.INVITE_INVALID, status: 404, message: 'Invite not found' },
  InviteExpiredError: { code: ApiErrorCode.INVITE_EXPIRED, status: 410, message: 'Invite expired' },
  InviteRevokedError: { code: ApiErrorCode.INVITE_EXPIRED, status: 410, message: 'Invite revoked' },
  InviteMaxUsesReachedError: { code: ApiErrorCode.INVITE_EXPIRED, status: 410, message: 'Invite max uses reached' },
  CannotKickOwnerError: { code: ApiErrorCode.FORBIDDEN, status: 403, message: 'Cannot kick guild owner' },
  CannotBanOwnerError: { code: ApiErrorCode.FORBIDDEN, status: 403, message: 'Cannot ban guild owner' },
  CannotLeaveAsOwnerError: { code: ApiErrorCode.FORBIDDEN, status: 403, message: 'Owner cannot leave guild' },
  UserNotBannedError: { code: ApiErrorCode.NOT_FOUND, status: 404, message: 'User is not banned' },

  // Permission errors
  MissingPermissionError: { code: ApiErrorCode.MISSING_PERMISSION, status: 403, message: 'Missing permission' },
  RoleNotFoundError: { code: ApiErrorCode.ROLE_NOT_FOUND, status: 404, message: 'Role not found' },
  CannotModifyEveryoneError: { code: ApiErrorCode.CANNOT_MODIFY_EVERYONE, status: 400, message: 'Cannot modify @everyone role' },
  MemberNotFoundError: { code: ApiErrorCode.NOT_GUILD_MEMBER, status: 404, message: 'Member not found' },
  RoleAlreadyAssignedError: { code: ApiErrorCode.VALIDATION_ERROR, status: 409, message: 'Role already assigned' },
  RoleNotAssignedError: { code: ApiErrorCode.VALIDATION_ERROR, status: 404, message: 'Role not assigned' },

  // Channel errors
  ChannelNotFoundError: { code: ApiErrorCode.CHANNEL_NOT_FOUND, status: 404, message: 'Channel not found' },
  InvalidParentChannelError: { code: ApiErrorCode.INVALID_PARENT, status: 400, message: 'Invalid parent channel' },
  ParentChannelNotFoundError: { code: ApiErrorCode.INVALID_PARENT, status: 400, message: 'Parent channel not found' },
  CannotDeleteCategoryWithChildrenError: { code: ApiErrorCode.VALIDATION_ERROR, status: 400, message: 'Cannot delete category with children' },

  // Message errors
  MessageNotFoundError: { code: ApiErrorCode.MESSAGE_NOT_FOUND, status: 404, message: 'Message not found' },
  NotMessageAuthorError: { code: ApiErrorCode.NOT_MESSAGE_AUTHOR, status: 403, message: 'Not message author' },
  MessageTooLongError: { code: ApiErrorCode.MESSAGE_TOO_LONG, status: 400, message: 'Message too long' },
  EmptyMessageError: { code: ApiErrorCode.EMPTY_MESSAGE, status: 400, message: 'Message cannot be empty' },
  MessageDeletedError: { code: ApiErrorCode.MESSAGE_NOT_FOUND, status: 404, message: 'Message has been deleted' },
};

/**
 * Map a service error to an API error
 */
export function mapServiceError(error: Error): ApiError {
  const errorName = error.constructor.name;
  const mapping = errorMappings[errorName];

  if (mapping) {
    // Include original error message if it has additional details
    const message = error.message !== errorName ? error.message : mapping.message;
    return new ApiError(mapping.code, mapping.status, message);
  }

  // Default to internal error
  console.error('Unmapped error:', error);
  return new ApiError(
    ApiErrorCode.INTERNAL_ERROR,
    500,
    'Internal server error'
  );
}

/**
 * Send error response
 */
export function sendError(res: Response, error: ApiError): void {
  res.status(error.statusCode).json(error.toResponse());
}

/**
 * Error handler middleware
 */
export function errorHandler(
  error: Error,
  _req: unknown,
  res: Response,
  _next: unknown
): void {
  if (error instanceof ApiError) {
    sendError(res, error);
    return;
  }

  const apiError = mapServiceError(error);
  sendError(res, apiError);
}
