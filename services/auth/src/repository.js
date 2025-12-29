/**
 * Convert database row to User type
 */
export function rowToUser(row) {
    const user = {
        id: row.id,
        email: row.email,
        username: row.username,
        created_at: row.created_at,
    };
    if (row.avatar) {
        user.avatar = row.avatar;
    }
    return user;
}
/**
 * Convert database row to Session type
 */
export function rowToSession(row) {
    return {
        id: row.id,
        user_id: row.user_id,
        refresh_token_hash: row.refresh_token_hash,
        device_info: row.device_info ?? {},
        created_at: row.created_at,
        last_active_at: row.last_active_at,
    };
}
/**
 * Auth Repository - Database operations for authentication
 */
export class AuthRepository {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    /**
     * Create a new user
     */
    async createUser(id, email, username, passwordHash, client) {
        const conn = client ?? this.pool;
        const result = await conn.query(`INSERT INTO users (id, email, username, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, username, password_hash, avatar, created_at`, [id, email.toLowerCase().trim(), username.trim(), passwordHash]);
        const row = result.rows[0];
        if (!row) {
            throw new Error('Failed to create user');
        }
        return rowToUser(row);
    }
    /**
     * Find user by email
     */
    async findUserByEmail(email) {
        const result = await this.pool.query(`SELECT id, email, username, password_hash, avatar, created_at
       FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
        const row = result.rows[0];
        if (!row) {
            return null;
        }
        return {
            ...rowToUser(row),
            password_hash: row.password_hash,
        };
    }
    /**
     * Find user by ID
     */
    async findUserById(id) {
        const result = await this.pool.query(`SELECT id, email, username, password_hash, avatar, created_at
       FROM users WHERE id = $1`, [id]);
        const row = result.rows[0];
        if (!row) {
            return null;
        }
        return rowToUser(row);
    }
    /**
     * Check if email exists
     */
    async emailExists(email) {
        const result = await this.pool.query(`SELECT 1 FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
        return result.rows.length > 0;
    }
    /**
     * Create a new session
     */
    async createSession(userId, refreshTokenHash, deviceInfo) {
        const result = await this.pool.query(`INSERT INTO sessions (user_id, refresh_token_hash, device_info)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, refresh_token_hash, device_info, created_at, last_active_at`, [userId, refreshTokenHash, deviceInfo ? JSON.stringify(deviceInfo) : null]);
        const row = result.rows[0];
        if (!row) {
            throw new Error('Failed to create session');
        }
        return rowToSession(row);
    }
    /**
     * Find session by ID
     */
    async findSessionById(sessionId) {
        const result = await this.pool.query(`SELECT id, user_id, refresh_token_hash, device_info, created_at, last_active_at
       FROM sessions WHERE id = $1`, [sessionId]);
        const row = result.rows[0];
        if (!row) {
            return null;
        }
        return rowToSession(row);
    }
    /**
     * Find session by refresh token hash
     */
    async findSessionByRefreshTokenHash(hash) {
        const result = await this.pool.query(`SELECT id, user_id, refresh_token_hash, device_info, created_at, last_active_at
       FROM sessions WHERE refresh_token_hash = $1`, [hash]);
        const row = result.rows[0];
        if (!row) {
            return null;
        }
        return rowToSession(row);
    }
    /**
     * Get all sessions for a user
     */
    async getSessionsByUserId(userId) {
        const result = await this.pool.query(`SELECT id, user_id, refresh_token_hash, device_info, created_at, last_active_at
       FROM sessions WHERE user_id = $1
       ORDER BY last_active_at DESC`, [userId]);
        return result.rows.map(rowToSession);
    }
    /**
     * Update session refresh token
     */
    async updateSessionRefreshToken(sessionId, newRefreshTokenHash) {
        const result = await this.pool.query(`UPDATE sessions
       SET refresh_token_hash = $2, last_active_at = NOW()
       WHERE id = $1
       RETURNING id, user_id, refresh_token_hash, device_info, created_at, last_active_at`, [sessionId, newRefreshTokenHash]);
        const row = result.rows[0];
        if (!row) {
            return null;
        }
        return rowToSession(row);
    }
    /**
     * Delete a session
     */
    async deleteSession(sessionId) {
        const result = await this.pool.query(`DELETE FROM sessions WHERE id = $1`, [sessionId]);
        return (result.rowCount ?? 0) > 0;
    }
    /**
     * Delete all sessions for a user
     */
    async deleteAllUserSessions(userId) {
        const result = await this.pool.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
        return result.rowCount ?? 0;
    }
    /**
     * Store a used refresh token hash for rotation violation detection
     */
    async storeUsedRefreshToken(sessionId, refreshTokenHash, userId) {
        await this.pool.query(`INSERT INTO used_refresh_tokens (session_id, refresh_token_hash, user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (refresh_token_hash) DO NOTHING`, [sessionId, refreshTokenHash, userId]);
    }
    /**
     * Check if a refresh token was previously used (rotation violation)
     */
    async findUsedRefreshToken(refreshTokenHash) {
        const result = await this.pool.query(`SELECT session_id, user_id FROM used_refresh_tokens WHERE refresh_token_hash = $1`, [refreshTokenHash]);
        const row = result.rows[0];
        if (!row) {
            return null;
        }
        return { session_id: row.session_id, user_id: row.user_id };
    }
    /**
     * Delete used refresh tokens for a session
     */
    async deleteUsedRefreshTokensForSession(sessionId) {
        await this.pool.query(`DELETE FROM used_refresh_tokens WHERE session_id = $1`, [sessionId]);
    }
    /**
     * Delete used refresh tokens for a user
     */
    async deleteUsedRefreshTokensForUser(userId) {
        await this.pool.query(`DELETE FROM used_refresh_tokens WHERE user_id = $1`, [userId]);
    }
    /**
     * Update session last active time
     */
    async touchSession(sessionId) {
        await this.pool.query(`UPDATE sessions SET last_active_at = NOW() WHERE id = $1`, [sessionId]);
    }
}
//# sourceMappingURL=repository.js.map