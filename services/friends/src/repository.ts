/**
 * Friends Repository - Database operations for friends and DMs
 */

import type { Pool, PoolClient } from 'pg';
import type { Snowflake } from '@discord-clone/types';

/**
 * DM Privacy setting values
 */
export type DMPrivacy = 'open' | 'friends' | 'closed';

/**
 * Friend request status
 */
export type FriendStatus = 'pending' | 'accepted' | 'declined' | 'blocked';

/**
 * Friend row from database
 */
export interface FriendRow {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendStatus;
  created_at: Date;
  updated_at: Date;
}

/**
 * Friend with user info
 */
export interface FriendWithUser {
  id: Snowflake;
  user_id: Snowflake;
  friend_id: Snowflake;
  status: FriendStatus;
  created_at: Date;
  updated_at: Date;
  friend_username: string;
  friend_avatar: string | null;
  friend_bio: string | null;
  friend_status?: string;
}

/**
 * DM Conversation row
 */
export interface DMConversationRow {
  id: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * DM Message row
 */
export interface DMMessageRow {
  id: string;
  conversation_id: string;
  author_id: string;
  content: string;
  created_at: Date;
  edited_at: Date | null;
}

/**
 * DM Conversation with participant info
 */
export interface DMConversationWithParticipant {
  id: Snowflake;
  other_user_id: Snowflake;
  other_username: string;
  other_avatar: string | null;
  last_message_content: string | null;
  last_message_at: Date | null;
  unread_count: number;
}

/**
 * Friends Repository
 */
export class FriendsRepository {
  constructor(private readonly pool: Pool) {}

  // ============================================
  // DM Privacy Settings
  // ============================================

  /**
   * Get user's DM privacy setting
   */
  async getDMPrivacy(userId: Snowflake): Promise<DMPrivacy> {
    const result = await this.pool.query<{ dm_privacy: DMPrivacy }>(
      `SELECT dm_privacy FROM users WHERE id = $1`,
      [userId]
    );
    return result.rows[0]?.dm_privacy ?? 'friends';
  }

  /**
   * Update user's DM privacy setting
   */
  async setDMPrivacy(userId: Snowflake, privacy: DMPrivacy): Promise<void> {
    await this.pool.query(
      `UPDATE users SET dm_privacy = $1 WHERE id = $2`,
      [privacy, userId]
    );
  }

  // ============================================
  // Friend Requests
  // ============================================

  /**
   * Send a friend request
   */
  async sendFriendRequest(
    id: Snowflake,
    userId: Snowflake,
    friendId: Snowflake
  ): Promise<FriendRow> {
    const result = await this.pool.query<FriendRow>(
      `INSERT INTO friends (id, user_id, friend_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'pending', NOW(), NOW())
       ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'pending', updated_at = NOW()
       WHERE friends.status = 'declined'
       RETURNING *`,
      [id, userId, friendId]
    );
    return result.rows[0]!;
  }

  /**
   * Get pending friend requests for a user (incoming)
   */
  async getIncomingFriendRequests(userId: Snowflake): Promise<FriendWithUser[]> {
    const result = await this.pool.query<FriendWithUser>(
      `SELECT f.id, f.user_id, f.friend_id, f.status, f.created_at, f.updated_at,
              u.username as friend_username, u.avatar as friend_avatar, u.bio as friend_bio
       FROM friends f
       JOIN users u ON u.id = f.user_id
       WHERE f.friend_id = $1 AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [userId]
    );
    return result.rows.map(row => ({
      ...row,
      id: row.id as Snowflake,
      user_id: row.user_id as Snowflake,
      friend_id: row.friend_id as Snowflake,
    }));
  }

  /**
   * Get outgoing friend requests (sent by user)
   */
  async getOutgoingFriendRequests(userId: Snowflake): Promise<FriendWithUser[]> {
    const result = await this.pool.query<FriendWithUser>(
      `SELECT f.id, f.user_id, f.friend_id, f.status, f.created_at, f.updated_at,
              u.username as friend_username, u.avatar as friend_avatar, u.bio as friend_bio
       FROM friends f
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = $1 AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [userId]
    );
    return result.rows.map(row => ({
      ...row,
      id: row.id as Snowflake,
      user_id: row.user_id as Snowflake,
      friend_id: row.friend_id as Snowflake,
    }));
  }

  /**
   * Accept a friend request
   */
  async acceptFriendRequest(requestId: Snowflake, userId: Snowflake): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE friends SET status = 'accepted', updated_at = NOW()
       WHERE id = $1 AND friend_id = $2 AND status = 'pending'`,
      [requestId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Decline a friend request
   */
  async declineFriendRequest(requestId: Snowflake, userId: Snowflake): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE friends SET status = 'declined', updated_at = NOW()
       WHERE id = $1 AND friend_id = $2 AND status = 'pending'`,
      [requestId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get all friends (accepted)
   */
  async getFriends(userId: Snowflake): Promise<FriendWithUser[]> {
    const result = await this.pool.query<FriendWithUser>(
      `SELECT f.id, f.user_id, f.friend_id, f.status, f.created_at, f.updated_at,
              u.username as friend_username, u.avatar as friend_avatar, u.bio as friend_bio
       FROM friends f
       JOIN users u ON u.id = CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END
       WHERE (f.user_id = $1 OR f.friend_id = $1) AND f.status = 'accepted'
       ORDER BY u.username ASC`,
      [userId]
    );
    return result.rows.map(row => ({
      ...row,
      id: row.id as Snowflake,
      user_id: row.user_id as Snowflake,
      friend_id: row.friend_id as Snowflake,
    }));
  }

  /**
   * Check if two users are friends
   */
  async areFriends(userId: Snowflake, otherUserId: Snowflake): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM friends
       WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))
       AND status = 'accepted'`,
      [userId, otherUserId]
    );
    return result.rows.length > 0;
  }

  /**
   * Remove a friend
   */
  async removeFriend(userId: Snowflake, friendId: Snowflake): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM friends
       WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))
       AND status = 'accepted'`,
      [userId, friendId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Block a user
   */
  async blockUser(id: Snowflake, userId: Snowflake, blockedUserId: Snowflake): Promise<void> {
    // Remove any existing friendship first
    await this.pool.query(
      `DELETE FROM friends
       WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [userId, blockedUserId]
    );
    
    // Add block entry
    await this.pool.query(
      `INSERT INTO friends (id, user_id, friend_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'blocked', NOW(), NOW())
       ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'blocked', updated_at = NOW()`,
      [id, userId, blockedUserId]
    );
  }

  /**
   * Unblock a user
   */
  async unblockUser(userId: Snowflake, blockedUserId: Snowflake): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM friends WHERE user_id = $1 AND friend_id = $2 AND status = 'blocked'`,
      [userId, blockedUserId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Check if a user is blocked
   */
  async isBlocked(userId: Snowflake, otherUserId: Snowflake): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM friends
       WHERE user_id = $1 AND friend_id = $2 AND status = 'blocked'`,
      [userId, otherUserId]
    );
    return result.rows.length > 0;
  }

  /**
   * Get blocked users
   */
  async getBlockedUsers(userId: Snowflake): Promise<FriendWithUser[]> {
    const result = await this.pool.query<FriendWithUser>(
      `SELECT f.id, f.user_id, f.friend_id, f.status, f.created_at, f.updated_at,
              u.username as friend_username, u.avatar as friend_avatar, u.bio as friend_bio
       FROM friends f
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = $1 AND f.status = 'blocked'
       ORDER BY f.created_at DESC`,
      [userId]
    );
    return result.rows.map(row => ({
      ...row,
      id: row.id as Snowflake,
      user_id: row.user_id as Snowflake,
      friend_id: row.friend_id as Snowflake,
    }));
  }

  /**
   * Check if there's a pending request between users
   */
  async hasPendingRequest(userId: Snowflake, friendId: Snowflake): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM friends
       WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))
       AND status = 'pending'`,
      [userId, friendId]
    );
    return result.rows.length > 0;
  }

  /**
   * Get a specific incoming friend request from another user
   */
  async getIncomingRequestFrom(userId: Snowflake, fromUserId: Snowflake): Promise<FriendRow | null> {
    const result = await this.pool.query<FriendRow>(
      `SELECT * FROM friends
       WHERE user_id = $2 AND friend_id = $1 AND status = 'pending'`,
      [userId, fromUserId]
    );
    return result.rows[0] ?? null;
  }

  /**
   * Get a specific outgoing friend request to another user
   */
  async getOutgoingRequestTo(userId: Snowflake, toUserId: Snowflake): Promise<FriendRow | null> {
    const result = await this.pool.query<FriendRow>(
      `SELECT * FROM friends
       WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'`,
      [userId, toUserId]
    );
    return result.rows[0] ?? null;
  }

  // ============================================
  // DM Conversations
  // ============================================

  /**
   * Get or create a DM conversation between two users
   */
  async getOrCreateDMConversation(
    conversationId: Snowflake,
    userId: Snowflake,
    otherUserId: Snowflake
  ): Promise<Snowflake> {
    // Check if conversation already exists
    const existing = await this.pool.query<{ id: string }>(
      `SELECT dc.id FROM dm_conversations dc
       JOIN dm_participants p1 ON p1.conversation_id = dc.id AND p1.user_id = $1
       JOIN dm_participants p2 ON p2.conversation_id = dc.id AND p2.user_id = $2`,
      [userId, otherUserId]
    );

    if (existing.rows[0]) {
      return existing.rows[0].id as Snowflake;
    }

    // Create new conversation
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO dm_conversations (id, created_at, updated_at) VALUES ($1, NOW(), NOW())`,
        [conversationId]
      );

      await client.query(
        `INSERT INTO dm_participants (conversation_id, user_id, joined_at, last_read_at)
         VALUES ($1, $2, NOW(), NOW()), ($1, $3, NOW(), NOW())`,
        [conversationId, userId, otherUserId]
      );

      await client.query('COMMIT');
      return conversationId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all DM conversations for a user
   */
  async getDMConversations(userId: Snowflake): Promise<DMConversationWithParticipant[]> {
    const result = await this.pool.query<DMConversationWithParticipant>(
      `SELECT 
        dc.id,
        u.id as other_user_id,
        u.username as other_username,
        u.avatar as other_avatar,
        (SELECT content FROM direct_messages WHERE conversation_id = dc.id ORDER BY created_at DESC LIMIT 1) as last_message_content,
        (SELECT created_at FROM direct_messages WHERE conversation_id = dc.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
        (SELECT COUNT(*) FROM direct_messages dm 
         WHERE dm.conversation_id = dc.id 
         AND dm.created_at > COALESCE(p.last_read_at, '1970-01-01'))::int as unread_count
       FROM dm_conversations dc
       JOIN dm_participants p ON p.conversation_id = dc.id AND p.user_id = $1
       JOIN dm_participants p2 ON p2.conversation_id = dc.id AND p2.user_id != $1
       JOIN users u ON u.id = p2.user_id
       ORDER BY COALESCE(
         (SELECT created_at FROM direct_messages WHERE conversation_id = dc.id ORDER BY created_at DESC LIMIT 1),
         dc.created_at
       ) DESC`,
      [userId]
    );
    return result.rows.map(row => ({
      ...row,
      id: row.id as Snowflake,
      other_user_id: row.other_user_id as Snowflake,
    }));
  }

  /**
   * Get DM conversation by ID
   */
  async getDMConversation(conversationId: Snowflake, userId: Snowflake): Promise<DMConversationWithParticipant | null> {
    const result = await this.pool.query<DMConversationWithParticipant>(
      `SELECT 
        dc.id,
        u.id as other_user_id,
        u.username as other_username,
        u.avatar as other_avatar,
        (SELECT content FROM direct_messages WHERE conversation_id = dc.id ORDER BY created_at DESC LIMIT 1) as last_message_content,
        (SELECT created_at FROM direct_messages WHERE conversation_id = dc.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
        0 as unread_count
       FROM dm_conversations dc
       JOIN dm_participants p ON p.conversation_id = dc.id AND p.user_id = $2
       JOIN dm_participants p2 ON p2.conversation_id = dc.id AND p2.user_id != $2
       JOIN users u ON u.id = p2.user_id
       WHERE dc.id = $1`,
      [conversationId, userId]
    );
    if (!result.rows[0]) return null;
    return {
      ...result.rows[0],
      id: result.rows[0].id as Snowflake,
      other_user_id: result.rows[0].other_user_id as Snowflake,
    };
  }

  /**
   * Check if user is participant in conversation
   */
  async isParticipant(conversationId: Snowflake, userId: Snowflake): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM dm_participants WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId]
    );
    return result.rows.length > 0;
  }

  /**
   * Mark conversation as read
   */
  async markConversationRead(conversationId: Snowflake, userId: Snowflake): Promise<void> {
    await this.pool.query(
      `UPDATE dm_participants SET last_read_at = NOW()
       WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId]
    );
  }

  // ============================================
  // Direct Messages
  // ============================================

  /**
   * Create a direct message
   */
  async createDM(
    id: Snowflake,
    conversationId: Snowflake,
    authorId: Snowflake,
    content: string
  ): Promise<DMMessageRow> {
    const result = await this.pool.query<DMMessageRow>(
      `INSERT INTO direct_messages (id, conversation_id, author_id, content, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [id, conversationId, authorId, content]
    );
    
    // Update conversation updated_at
    await this.pool.query(
      `UPDATE dm_conversations SET updated_at = NOW() WHERE id = $1`,
      [conversationId]
    );
    
    return result.rows[0]!;
  }

  /**
   * Get messages in a conversation
   */
  async getDMMessages(
    conversationId: Snowflake,
    limit: number = 50,
    before?: Snowflake
  ): Promise<DMMessageRow[]> {
    let query = `SELECT * FROM direct_messages WHERE conversation_id = $1`;
    const params: (string | number)[] = [conversationId];

    if (before) {
      query += ` AND id < $2`;
      params.push(before);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await this.pool.query<DMMessageRow>(query, params);
    return result.rows.reverse(); // Return in chronological order
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: Snowflake): Promise<{ id: string; username: string; avatar: string | null; dm_privacy: DMPrivacy } | null> {
    const result = await this.pool.query<{ id: string; username: string; avatar: string | null; dm_privacy: DMPrivacy }>(
      `SELECT id, username, avatar, dm_privacy FROM users WHERE id = $1`,
      [userId]
    );
    return result.rows[0] ?? null;
  }

  /**
   * Search users by username
   */
  async searchUsers(query: string, currentUserId: Snowflake, limit: number = 20): Promise<{ id: string; username: string; avatar: string | null }[]> {
    const result = await this.pool.query<{ id: string; username: string; avatar: string | null }>(
      `SELECT id, username, avatar FROM users 
       WHERE username ILIKE $1 AND id != $2
       ORDER BY username ASC
       LIMIT $3`,
      [`%${query}%`, currentUserId, limit]
    );
    return result.rows;
  }

  /**
   * Get mutual friends between two users
   */
  async getMutualFriends(userId: Snowflake, otherUserId: Snowflake): Promise<{ id: string; username: string; avatar: string | null }[]> {
    const result = await this.pool.query<{ id: string; username: string; avatar: string | null }>(
      `SELECT u.id, u.username, u.avatar
       FROM users u
       WHERE u.id IN (
         -- Friends of userId
         SELECT CASE WHEN f1.user_id = $1 THEN f1.friend_id ELSE f1.user_id END
         FROM friends f1
         WHERE (f1.user_id = $1 OR f1.friend_id = $1) AND f1.status = 'accepted'
       )
       AND u.id IN (
         -- Friends of otherUserId
         SELECT CASE WHEN f2.user_id = $2 THEN f2.friend_id ELSE f2.user_id END
         FROM friends f2
         WHERE (f2.user_id = $2 OR f2.friend_id = $2) AND f2.status = 'accepted'
       )
       ORDER BY u.username ASC`,
      [userId, otherUserId]
    );
    return result.rows;
  }

  /**
   * Get a database client for transactions
   */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }
}
