import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { Snowflake, TokenPair, TokenPayload } from '@discord-clone/types';
import { TokenExpiredError, TokenInvalidError } from './errors.js';

/**
 * Token configuration
 */
export interface TokenConfig {
  jwtSecret: string;
  accessTokenExpiresIn: number; // seconds
  refreshTokenExpiresIn: number; // seconds
}

/**
 * Default token configuration
 */
export const DEFAULT_TOKEN_CONFIG: TokenConfig = {
  jwtSecret: process.env.JWT_SECRET || 'development-secret-change-in-production',
  accessTokenExpiresIn: 5 * 24 * 60 * 60, // 5 days
  refreshTokenExpiresIn: 30 * 24 * 60 * 60, // 30 days
};

/**
 * Generate a random refresh token
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a refresh token for storage
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a JWT access token
 */
export function generateAccessToken(
  userId: Snowflake,
  sessionId: string,
  config: TokenConfig = DEFAULT_TOKEN_CONFIG
): string {
  const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
    sub: userId,
    session_id: sessionId,
  };

  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.accessTokenExpiresIn,
  });
}

/**
 * Generate a token pair (access + refresh)
 */
export function generateTokenPair(
  userId: Snowflake,
  sessionId: string,
  config: TokenConfig = DEFAULT_TOKEN_CONFIG
): TokenPair {
  const accessToken = generateAccessToken(userId, sessionId, config);
  const refreshToken = generateRefreshToken();

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: config.accessTokenExpiresIn,
  };
}

/**
 * Validate and decode a JWT access token
 */
export function validateAccessToken(
  token: string,
  config: TokenConfig = DEFAULT_TOKEN_CONFIG
): TokenPayload {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as TokenPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new TokenExpiredError();
    }
    throw new TokenInvalidError();
  }
}

/**
 * Decode a JWT without verification (for inspection)
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    return jwt.decode(token) as TokenPayload | null;
  } catch {
    return null;
  }
}
