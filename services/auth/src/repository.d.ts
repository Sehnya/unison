import type { Pool, PoolClient } from 'pg';
import type { Snowflake, User, Session, DeviceInfo } from '@discord-clone/types';
/**
 * User row from database
 */
export interface UserRow {
    id: string;
    email: string;
    username: string;
    password_hash: string;
    avatar: string | null;
    created_at: Date;
}
/**
 * Session row from database
 */
export interface SessionRow {
    id: string;
    user_id: string;
    refresh_token_hash: string;
    device_info: DeviceInfo | null;
    created_at: Date;
    last_active_at: Date;
}
/**
 * Convert database row to User type
 */
export declare function rowToUser(row: UserRow): User;
/**
 * Convert database row to Session type
 */
export declare function rowToSession(row: SessionRow): Session;
/**
 * Auth Repository - Database operations for authentication
 */
export declare class AuthRepository {
    private readonly pool;
    constructor(pool: Pool);
    /**
     * Create a new user
     */
    createUser(id: Snowflake, email: string, username: string, passwordHash: string, client?: PoolClient): Promise<User>;
    /**
     * Find user by email
     */
    findUserByEmail(email: string): Promise<(User & {
        password_hash: string;
    }) | null>;
    /**
     * Find user by ID
     */
    findUserById(id: Snowflake): Promise<User | null>;
    /**
     * Check if email exists
     */
    emailExists(email: string): Promise<boolean>;
    /**
     * Create a new session
     */
    createSession(userId: Snowflake, refreshTokenHash: string, deviceInfo?: DeviceInfo): Promise<Session>;
    /**
     * Find session by ID
     */
    findSessionById(sessionId: string): Promise<Session | null>;
    /**
     * Find session by refresh token hash
     */
    findSessionByRefreshTokenHash(hash: string): Promise<Session | null>;
    /**
     * Get all sessions for a user
     */
    getSessionsByUserId(userId: Snowflake): Promise<Session[]>;
    /**
     * Update session refresh token
     */
    updateSessionRefreshToken(sessionId: string, newRefreshTokenHash: string): Promise<Session | null>;
    /**
     * Delete a session
     */
    deleteSession(sessionId: string): Promise<boolean>;
    /**
     * Delete all sessions for a user
     */
    deleteAllUserSessions(userId: Snowflake): Promise<number>;
    /**
     * Store a used refresh token hash for rotation violation detection
     */
    storeUsedRefreshToken(sessionId: string, refreshTokenHash: string, userId: Snowflake): Promise<void>;
    /**
     * Check if a refresh token was previously used (rotation violation)
     */
    findUsedRefreshToken(refreshTokenHash: string): Promise<{
        session_id: string;
        user_id: Snowflake;
    } | null>;
    /**
     * Delete used refresh tokens for a session
     */
    deleteUsedRefreshTokensForSession(sessionId: string): Promise<void>;
    /**
     * Delete used refresh tokens for a user
     */
    deleteUsedRefreshTokensForUser(userId: Snowflake): Promise<void>;
    /**
     * Update session last active time
     */
    touchSession(sessionId: string): Promise<void>;
}
//# sourceMappingURL=repository.d.ts.map