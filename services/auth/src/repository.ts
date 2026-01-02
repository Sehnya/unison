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
  bio: string | null;
  background_image: string | null;
  username_font: string | null;
  mini_profile_background: string | null;
  mini_profile_font: string | null;
  mini_profile_text_color: string | null;
  created_at: Date;
  terms_accepted_at?: Date | null;
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
export function rowToUser(row: UserRow): User {
  const user: User = {
    id: row.id as Snowflake,
    email: row.email,
    username: row.username,
    created_at: row.created_at,
  };
  if (row.avatar) {
    user.avatar = row.avatar;
  }
  // Always include bio (even if empty string or null) so frontend knows it's been set
  (user as User & { bio?: string | null }).bio = row.bio ?? '';
  if (row.background_image) {
    (user as User & { background_image?: string }).background_image = row.background_image;
  }
  if (row.username_font) {
    (user as User & { username_font?: string }).username_font = row.username_font;
  }
  if (row.mini_profile_background) {
    (user as User & { mini_profile_background?: string }).mini_profile_background = row.mini_profile_background;
  }
  if (row.mini_profile_font) {
    (user as User & { mini_profile_font?: string }).mini_profile_font = row.mini_profile_font;
  }
  if (row.mini_profile_text_color) {
    (user as User & { mini_profile_text_color?: string }).mini_profile_text_color = row.mini_profile_text_color;
  }
  if (row.terms_accepted_at) {
    (user as User & { terms_accepted_at?: Date }).terms_accepted_at = row.terms_accepted_at;
  }
  return user;
}

/**
 * Convert database row to Session type
 */
export function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    user_id: row.user_id as Snowflake,
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
  constructor(private readonly pool: Pool) {}

  /**
   * Create a new user
   */
  async createUser(
    id: Snowflake,
    email: string,
    username: string,
    passwordHash: string,
    client?: PoolClient
  ): Promise<User> {
    const conn = client ?? this.pool;
    const result = await conn.query<UserRow>(
      `INSERT INTO users (id, email, username, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, username, password_hash, avatar, bio, background_image, username_font, mini_profile_background, mini_profile_font, mini_profile_text_color, created_at, terms_accepted_at`,
      [id, email.toLowerCase().trim(), username.trim(), passwordHash]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to create user');
    }
    return rowToUser(row);
  }

  /**
   * Find user by email
   */
  async findUserByEmail(email: string): Promise<(User & { password_hash: string }) | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT id, email, username, password_hash, avatar, bio, background_image, username_font, mini_profile_background, mini_profile_font, mini_profile_text_color, created_at, terms_accepted_at
       FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    const user = rowToUser(row);
    return {
      ...user,
      password_hash: row.password_hash,
    };
  }

  /**
   * Find user by ID
   */
  async findUserById(id: Snowflake): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT id, email, username, password_hash, avatar, bio, background_image, username_font, mini_profile_background, mini_profile_font, mini_profile_text_color, created_at, terms_accepted_at
       FROM users WHERE id = $1`,
      [id]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return rowToUser(row);
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );
    return result.rows.length > 0;
  }

  /**
   * Create a new session
   */
  async createSession(
    userId: Snowflake,
    refreshTokenHash: string,
    deviceInfo?: DeviceInfo
  ): Promise<Session> {
    const result = await this.pool.query<SessionRow>(
      `INSERT INTO sessions (user_id, refresh_token_hash, device_info)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, refresh_token_hash, device_info, created_at, last_active_at`,
      [userId, refreshTokenHash, deviceInfo ? JSON.stringify(deviceInfo) : null]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to create session');
    }
    return rowToSession(row);
  }

  /**
   * Find session by ID
   */
  async findSessionById(sessionId: string): Promise<Session | null> {
    const result = await this.pool.query<SessionRow>(
      `SELECT id, user_id, refresh_token_hash, device_info, created_at, last_active_at
       FROM sessions WHERE id = $1`,
      [sessionId]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return rowToSession(row);
  }

  /**
   * Find session by refresh token hash
   */
  async findSessionByRefreshTokenHash(hash: string): Promise<Session | null> {
    const result = await this.pool.query<SessionRow>(
      `SELECT id, user_id, refresh_token_hash, device_info, created_at, last_active_at
       FROM sessions WHERE refresh_token_hash = $1`,
      [hash]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return rowToSession(row);
  }

  /**
   * Get all sessions for a user
   */
  async getSessionsByUserId(userId: Snowflake): Promise<Session[]> {
    const result = await this.pool.query<SessionRow>(
      `SELECT id, user_id, refresh_token_hash, device_info, created_at, last_active_at
       FROM sessions WHERE user_id = $1
       ORDER BY last_active_at DESC`,
      [userId]
    );
    return result.rows.map(rowToSession);
  }

  /**
   * Update session refresh token
   */
  async updateSessionRefreshToken(
    sessionId: string,
    newRefreshTokenHash: string
  ): Promise<Session | null> {
    const result = await this.pool.query<SessionRow>(
      `UPDATE sessions
       SET refresh_token_hash = $2, last_active_at = NOW()
       WHERE id = $1
       RETURNING id, user_id, refresh_token_hash, device_info, created_at, last_active_at`,
      [sessionId, newRefreshTokenHash]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return rowToSession(row);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM sessions WHERE id = $1`,
      [sessionId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Delete all sessions for a user
   */
  async deleteAllUserSessions(userId: Snowflake): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM sessions WHERE user_id = $1`,
      [userId]
    );
    return result.rowCount ?? 0;
  }

  /**
   * Store a used refresh token hash for rotation violation detection
   */
  async storeUsedRefreshToken(
    sessionId: string,
    refreshTokenHash: string,
    userId: Snowflake
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO used_refresh_tokens (session_id, refresh_token_hash, user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (refresh_token_hash) DO NOTHING`,
      [sessionId, refreshTokenHash, userId]
    );
  }

  /**
   * Check if a refresh token was previously used (rotation violation)
   */
  async findUsedRefreshToken(refreshTokenHash: string): Promise<{ session_id: string; user_id: Snowflake } | null> {
    const result = await this.pool.query<{ session_id: string; user_id: string }>(
      `SELECT session_id, user_id FROM used_refresh_tokens WHERE refresh_token_hash = $1`,
      [refreshTokenHash]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return { session_id: row.session_id, user_id: row.user_id as Snowflake };
  }

  /**
   * Delete used refresh tokens for a session
   */
  async deleteUsedRefreshTokensForSession(sessionId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM used_refresh_tokens WHERE session_id = $1`,
      [sessionId]
    );
  }

  /**
   * Delete used refresh tokens for a user
   */
  async deleteUsedRefreshTokensForUser(userId: Snowflake): Promise<void> {
    await this.pool.query(
      `DELETE FROM used_refresh_tokens WHERE user_id = $1`,
      [userId]
    );
  }

  /**
   * Update session last active time
   */
  async touchSession(sessionId: string): Promise<void> {
    await this.pool.query(
      `UPDATE sessions SET last_active_at = NOW() WHERE id = $1`,
      [sessionId]
    );
  }

  /**
   * Accept terms and conditions
   */
  async acceptTerms(userId: Snowflake): Promise<void> {
    await this.pool.query(
      'UPDATE users SET terms_accepted_at = NOW() WHERE id = $1',
      [userId]
    );
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: Snowflake,
    updates: { username?: string; avatar?: string; bio?: string; background_image?: string | null; username_font?: string; mini_profile_background?: string | null; mini_profile_font?: string; mini_profile_text_color?: string }
  ): Promise<User> {
    const setClauses: string[] = [];
    const values: (string | null)[] = [];
    let paramIndex = 1;

    if (updates.username !== undefined) {
      setClauses.push(`username = $${paramIndex++}`);
      values.push(updates.username.trim());
    }
    if (updates.avatar !== undefined) {
      setClauses.push(`avatar = $${paramIndex++}`);
      values.push(updates.avatar || null);
    }
    if (updates.bio !== undefined) {
      setClauses.push(`bio = $${paramIndex++}`);
      values.push(updates.bio.trim() || null);
    }
    if (updates.background_image !== undefined) {
      setClauses.push(`background_image = $${paramIndex++}`);
      values.push(updates.background_image || null);
    }
    if (updates.username_font !== undefined) {
      setClauses.push(`username_font = $${paramIndex++}`);
      values.push(updates.username_font || null);
    }
    if (updates.mini_profile_background !== undefined) {
      setClauses.push(`mini_profile_background = $${paramIndex++}`);
      values.push(updates.mini_profile_background || null);
    }
    if (updates.mini_profile_font !== undefined) {
      setClauses.push(`mini_profile_font = $${paramIndex++}`);
      values.push(updates.mini_profile_font || null);
    }
    if (updates.mini_profile_text_color !== undefined) {
      setClauses.push(`mini_profile_text_color = $${paramIndex++}`);
      values.push(updates.mini_profile_text_color || null);
    }

    if (setClauses.length === 0) {
      const user = await this.findUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      return user;
    }

    values.push(userId);
    const result = await this.pool.query<UserRow>(
      `UPDATE users SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, email, username, password_hash, avatar, bio, background_image, username_font, mini_profile_background, mini_profile_font, mini_profile_text_color, created_at, terms_accepted_at`,
      values
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('User not found');
    }
    return rowToUser(row);
  }

  /**
   * Update mini-profile settings
   */
  async updateMiniProfileSettings(
    userId: Snowflake,
    settings: { mini_profile_background?: string | null; mini_profile_font?: string; mini_profile_text_color?: string }
  ): Promise<User> {
    return this.updateProfile(userId, settings);
  }

  /**
   * Get mini-profile data for a user
   */
  async getMiniProfileData(userId: Snowflake): Promise<{
    userId: string;
    username: string;
    avatar: string | null;
    bio: string | null;
    backgroundImage: string | null;
    usernameFont: string | null;
    textColor: string | null;
  } | null> {
    try {
      // Try to fetch with mini-profile columns
      const result = await this.pool.query<{
        id: string;
        username: string;
        avatar: string | null;
        bio: string | null;
        mini_profile_background: string | null;
        mini_profile_font: string | null;
        mini_profile_text_color: string | null;
      }>(
        `SELECT id, username, avatar, bio, mini_profile_background, mini_profile_font, mini_profile_text_color
         FROM users WHERE id = $1`,
        [userId]
      );
      const row = result.rows[0];
      if (!row) {
        return null;
      }
      return {
        userId: row.id,
        username: row.username,
        avatar: row.avatar,
        bio: row.bio,
        backgroundImage: row.mini_profile_background,
        usernameFont: row.mini_profile_font,
        textColor: row.mini_profile_text_color,
      };
    } catch (error) {
      // If columns don't exist (migration not run), fallback to basic user info
      console.warn('getMiniProfileData: Fallback to basic query due to error:', error);
      try {
        const result = await this.pool.query<{
          id: string;
          username: string;
          avatar: string | null;
          bio: string | null;
        }>(
          `SELECT id, username, avatar, bio FROM users WHERE id = $1`,
          [userId]
        );
        const row = result.rows[0];
        if (!row) {
          return null;
        }
        return {
          userId: row.id,
          username: row.username,
          avatar: row.avatar,
          bio: row.bio,
          backgroundImage: null,
          usernameFont: null,
          textColor: null,
        };
      } catch (fallbackError) {
        console.error('getMiniProfileData: Fallback query also failed:', fallbackError);
        throw fallbackError;
      }
    }
  }

  /**
   * Get user's profile customization data
   */
  async getProfileData(userId: Snowflake): Promise<{ profile_data: unknown; background_image: string | null } | null> {
    const result = await this.pool.query(
      `SELECT profile_data, background_image FROM user_profiles WHERE user_id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return {
      profile_data: result.rows[0].profile_data,
      background_image: result.rows[0].background_image
    };
  }

  /**
   * Save user's profile customization data
   */
  async saveProfileData(userId: Snowflake, profileData: unknown, backgroundImage?: string | null): Promise<void> {
    await this.pool.query(
      `INSERT INTO user_profiles (user_id, profile_data, background_image, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET profile_data = $2, background_image = $3, updated_at = NOW()`,
      [userId, JSON.stringify(profileData), backgroundImage ?? null]
    );
  }
}
