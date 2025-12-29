/**
 * API Middleware
 *
 * Authentication middleware for JWT validation and user context attachment.
 * Requirements: 1.3, 12.1
 */

import type { Request, Response, NextFunction } from 'express';
import type { Snowflake, TokenPayload } from '@discord-clone/types';
import { ApiError, ApiErrorCode } from './errors.js';

/**
 * Extended request with user context
 */
export interface AuthenticatedRequest extends Request {
  user: {
    id: Snowflake;
    sessionId: string;
  };
}

/**
 * Token validator function type
 */
export type TokenValidator = (token: string) => TokenPayload;

/**
 * Create authentication middleware
 * Requirements: 1.3, 12.1
 *
 * - Extracts JWT from Authorization header
 * - Validates the token
 * - Attaches user context to request
 */
export function createAuthMiddleware(validateToken: TokenValidator) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        throw new ApiError(
          ApiErrorCode.UNAUTHORIZED,
          401,
          'Authorization header required'
        );
      }

      // Check Bearer format
      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        throw new ApiError(
          ApiErrorCode.TOKEN_INVALID,
          401,
          'Invalid authorization format. Use: Bearer <token>'
        );
      }

      const token = parts[1];
      if (!token) {
        throw new ApiError(ApiErrorCode.TOKEN_INVALID, 401, 'Token required');
      }

      // Validate token
      let payload: TokenPayload;
      try {
        payload = validateToken(token);
      } catch (error) {
        // Map token validation errors
        if (error instanceof Error) {
          const errorName = error.constructor.name;
          console.error('Token validation failed:', errorName, error.message);
          
          // Check for specific error types from auth service
          if (errorName === 'TokenExpiredError' || error.message.includes('expired')) {
            throw new ApiError(ApiErrorCode.TOKEN_EXPIRED, 401, 'Token expired');
          }
          if (errorName === 'TokenInvalidError' || error.message.includes('invalid') || error.message.includes('Invalid token')) {
            throw new ApiError(ApiErrorCode.TOKEN_INVALID, 401, `Invalid token: ${error.message}`);
          }
        }
        throw new ApiError(ApiErrorCode.TOKEN_INVALID, 401, `Invalid token: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Attach user context to request
      (req as AuthenticatedRequest).user = {
        id: payload.sub,
        sessionId: payload.session_id,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Optional authentication middleware
 * Attaches user context if token is present, but doesn't require it
 */
export function createOptionalAuthMiddleware(validateToken: TokenValidator) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        next();
        return;
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        next();
        return;
      }

      const token = parts[1];
      if (!token) {
        next();
        return;
      }

      try {
        const payload = validateToken(token);
        (req as AuthenticatedRequest).user = {
          id: payload.sub,
          sessionId: payload.session_id,
        };
      } catch {
        // Token invalid, but that's okay for optional auth
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Request validation middleware
 */
export function validateBody(
  validator: (body: unknown) => { valid: boolean; errors?: string[] }
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = validator(req.body);
    if (!result.valid) {
      next(
        new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          400,
          result.errors?.join(', ') || 'Validation failed'
        )
      );
      return;
    }
    next();
  };
}

/**
 * Parse Snowflake ID from string
 */
export function parseSnowflake(value: string | undefined | null): Snowflake | undefined {
  if (!value) return undefined;
  // Snowflakes are numeric strings
  if (!/^\d+$/.test(value)) return undefined;
  return value as Snowflake;
}

/**
 * Require Snowflake ID parameter
 */
export function requireSnowflake(
  paramName: string,
  value: string | undefined | null
): Snowflake {
  const snowflake = parseSnowflake(value);
  if (!snowflake) {
    throw new ApiError(
      ApiErrorCode.VALIDATION_ERROR,
      400,
      `Invalid ${paramName}: must be a valid Snowflake ID`
    );
  }
  return snowflake;
}
