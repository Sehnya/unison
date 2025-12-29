import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { TokenExpiredError, TokenInvalidError } from './errors.js';
/**
 * Default token configuration
 */
export const DEFAULT_TOKEN_CONFIG = {
    jwtSecret: process.env.JWT_SECRET || 'development-secret-change-in-production',
    accessTokenExpiresIn: 15 * 60, // 15 minutes
    refreshTokenExpiresIn: 7 * 24 * 60 * 60, // 7 days
};
/**
 * Generate a random refresh token
 */
export function generateRefreshToken() {
    return crypto.randomBytes(32).toString('hex');
}
/**
 * Hash a refresh token for storage
 */
export function hashRefreshToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}
/**
 * Generate a JWT access token
 */
export function generateAccessToken(userId, sessionId, config = DEFAULT_TOKEN_CONFIG) {
    const payload = {
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
export function generateTokenPair(userId, sessionId, config = DEFAULT_TOKEN_CONFIG) {
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
export function validateAccessToken(token, config = DEFAULT_TOKEN_CONFIG) {
    try {
        const decoded = jwt.verify(token, config.jwtSecret);
        return decoded;
    }
    catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new TokenExpiredError();
        }
        throw new TokenInvalidError();
    }
}
/**
 * Decode a JWT without verification (for inspection)
 */
export function decodeToken(token) {
    try {
        return jwt.decode(token);
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=tokens.js.map