import type { Snowflake, TokenPair, TokenPayload } from '@discord-clone/types';
/**
 * Token configuration
 */
export interface TokenConfig {
    jwtSecret: string;
    accessTokenExpiresIn: number;
    refreshTokenExpiresIn: number;
}
/**
 * Default token configuration
 */
export declare const DEFAULT_TOKEN_CONFIG: TokenConfig;
/**
 * Generate a random refresh token
 */
export declare function generateRefreshToken(): string;
/**
 * Hash a refresh token for storage
 */
export declare function hashRefreshToken(token: string): string;
/**
 * Generate a JWT access token
 */
export declare function generateAccessToken(userId: Snowflake, sessionId: string, config?: TokenConfig): string;
/**
 * Generate a token pair (access + refresh)
 */
export declare function generateTokenPair(userId: Snowflake, sessionId: string, config?: TokenConfig): TokenPair;
/**
 * Validate and decode a JWT access token
 */
export declare function validateAccessToken(token: string, config?: TokenConfig): TokenPayload;
/**
 * Decode a JWT without verification (for inspection)
 */
export declare function decodeToken(token: string): TokenPayload | null;
//# sourceMappingURL=tokens.d.ts.map