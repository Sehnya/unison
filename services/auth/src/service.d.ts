import type { Pool } from 'pg';
import type { Snowflake, User, Session, TokenPair, TokenPayload, DeviceInfo } from '@discord-clone/types';
import { TokenConfig } from './tokens.js';
/**
 * Auth Service Configuration
 */
export interface AuthServiceConfig {
    tokenConfig?: TokenConfig;
    workerId?: number;
}
/**
 * Registration result
 */
export interface RegisterResult {
    user: User;
    tokens: TokenPair;
    session: Session;
}
/**
 * Login result
 */
export interface LoginResult {
    user: User;
    tokens: TokenPair;
    sessionId: string;
}
/**
 * Auth Service - Handles user authentication and session management
 */
export declare class AuthService {
    private readonly repository;
    private readonly snowflake;
    private readonly tokenConfig;
    constructor(pool: Pool, config?: AuthServiceConfig);
    /**
     * Register a new user
     * Requirements: 1.1, 1.2
     */
    register(email: string, password: string, username: string, deviceInfo?: DeviceInfo): Promise<RegisterResult>;
    /**
     * Login with email and password
     * Requirements: 1.3, 1.4, 2.1
     */
    login(email: string, password: string, deviceInfo?: DeviceInfo): Promise<LoginResult>;
    /**
     * Refresh tokens using a refresh token
     * Requirements: 1.5, 1.6, 1.7
     */
    refreshTokens(refreshToken: string): Promise<TokenPair>;
    /**
     * Detect and handle refresh token rotation violation
     * Requirements: 1.7
     * This is called when a refresh token is reused after being rotated
     */
    handleRotationViolation(userId: Snowflake): Promise<void>;
    /**
     * Validate an access token
     */
    validateToken(token: string): TokenPayload;
    /**
     * Logout - invalidate current session
     * Requirements: 2.4
     */
    logout(sessionId: string): Promise<void>;
    /**
     * Get all sessions for a user
     * Requirements: 2.2
     */
    getSessions(userId: Snowflake): Promise<Session[]>;
    /**
     * Revoke a specific session
     * Requirements: 2.3
     */
    revokeSession(userId: Snowflake, sessionId: string): Promise<void>;
    /**
     * Revoke all sessions for a user
     */
    revokeAllSessions(userId: Snowflake): Promise<number>;
    /**
     * Get user by ID
     */
    getUserById(userId: Snowflake): Promise<User>;
    /**
     * Get session by ID
     */
    getSessionById(sessionId: string): Promise<Session>;
}
//# sourceMappingURL=service.d.ts.map