/**
 * Messaging Repository - Database operations for messages
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5, 11.1, 11.2, 11.3
 */

import type { Pool, PoolClient } from 'pg';
import type { Snowflake, Message, PaginationOptions } from '@discord-clone/types';

/**
 * Message row from database
 */
export interface MessageRow {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  mentions: string[] | null;
  mention_roles: string[] | null;
  created_at: Date;
  edited_at: Date | null;
  deleted_at: Date | null;
}

/**
 * Convert database row to Message type
 */
export function rowToMessage(row: MessageRow): Message {
  const message: Message = {
    id: row.id as Snowflake,
    channel_id: row.channel_id as Snowflake,
    author_id: row.author_id as Snowflake,
    content: row.content,
    mentions: (row.mentions ?? []) as Snowflake[],
    mention_roles: (row.mention_roles ?? []) as Snowflake[],
    created_at: row.created_at,
  };
  if (row.edited_at) {
    message.edited_at = row.edited_at;
  }
  if (row.deleted_at) {
    message.deleted_at = row.deleted_at;
  }
  return message;
}

/**
 * Maximum page size for message retrieval
 */
export const MAX_PAGE_SIZE = 100;

/**
 * Default page size for message retrieval
 */
export const DEFAULT_PAGE_SIZE = 50;

/**
 * Maximum message content length
 * Increased to support base64 encoded images (up to ~25MB raw = ~33MB base64)
 */
export const MAX_MESSAGE_LENGTH = 50000000; // 50MB to handle large base64 images

/**
 * Messaging Repository
 */
export class MessagingRepository {
  constructor(private readonly pool: Pool) {}


  // ============================================
  // Message CRUD Operations
  // Requirements: 9.1, 9.2, 10.1, 10.2, 10.3, 10.4, 11.1, 11.2
  // ============================================

  /**
   * Create a new message (idempotent)
   * Requirements: 9.1, 9.2
   * 
   * Uses ON CONFLICT to handle duplicate message IDs from event retries.
   * If a message with the same ID already exists, returns the existing message.
   */
  async createMessage(
    id: Snowflake,
    channelId: Snowflake,
    authorId: Snowflake,
    content: string,
    mentions: Snowflake[],
    mentionRoles: Snowflake[],
    createdAt: Date,
    client?: PoolClient
  ): Promise<Message> {
    const conn = client ?? this.pool;
    const result = await conn.query<MessageRow>(
      `INSERT INTO messages (id, channel_id, author_id, content, mentions, mention_roles, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id, created_at) DO NOTHING
       RETURNING id, channel_id, author_id, content, mentions, mention_roles, created_at, edited_at, deleted_at`,
      [id, channelId, authorId, content, mentions, mentionRoles, createdAt]
    );
    
    // If no row returned, message already exists - fetch it
    if (!result.rows[0]) {
      const existing = await this.getMessageById(id);
      if (existing) {
        return existing;
      }
      throw new Error('Failed to create message');
    }
    
    return rowToMessage(result.rows[0]);
  }

  /**
   * Create a new message (idempotent) - alternative for non-partitioned tables
   * Requirements: 9.1, 9.2
   * 
   * Uses ON CONFLICT to handle duplicate message IDs from event retries.
   * If a message with the same ID already exists, returns the existing message.
   */
  async createMessageIdempotent(
    id: Snowflake,
    channelId: Snowflake,
    authorId: Snowflake,
    content: string,
    mentions: Snowflake[],
    mentionRoles: Snowflake[],
    createdAt: Date,
    client?: PoolClient
  ): Promise<{ message: Message; created: boolean }> {
    const conn = client ?? this.pool;
    
    // First try to get existing message
    const existing = await this.getMessageById(id);
    if (existing) {
      return { message: existing, created: false };
    }
    
    // Try to insert
    try {
      const result = await conn.query<MessageRow>(
        `INSERT INTO messages (id, channel_id, author_id, content, mentions, mention_roles, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, channel_id, author_id, content, mentions, mention_roles, created_at, edited_at, deleted_at`,
        [id, channelId, authorId, content, mentions, mentionRoles, createdAt]
      );
      
      if (!result.rows[0]) {
        throw new Error('Failed to create message');
      }
      
      return { message: rowToMessage(result.rows[0]), created: true };
    } catch (error) {
      // Handle unique constraint violation (race condition)
      if ((error as { code?: string }).code === '23505') {
        const existingAfterConflict = await this.getMessageById(id);
        if (existingAfterConflict) {
          return { message: existingAfterConflict, created: false };
        }
      }
      throw error;
    }
  }

  /**
   * Get message by ID
   */
  async getMessageById(messageId: Snowflake): Promise<Message | null> {
    const result = await this.pool.query<MessageRow>(
      `SELECT id, channel_id, author_id, content, mentions, mention_roles, created_at, edited_at, deleted_at
       FROM messages WHERE id = $1`,
      [messageId]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return rowToMessage(row);
  }

  /**
   * Get messages for a channel with pagination
   * Requirements: 10.1, 10.2, 10.3, 10.4
   */
  async getMessages(
    channelId: Snowflake,
    options: PaginationOptions = {}
  ): Promise<Message[]> {
    const limit = Math.min(options.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const conditions: string[] = ['channel_id = $1', 'deleted_at IS NULL'];
    const params: (string | number)[] = [channelId];
    let paramIndex = 2;

    // Cursor-based pagination
    if (options.before) {
      // Get messages before this ID (older messages)
      // Need to get the created_at of the cursor message for partitioned table
      conditions.push(`(created_at, id) < (
        SELECT created_at, id FROM messages WHERE id = $${paramIndex}
      )`);
      params.push(options.before);
      paramIndex++;
    }

    if (options.after) {
      // Get messages after this ID (newer messages)
      conditions.push(`(created_at, id) > (
        SELECT created_at, id FROM messages WHERE id = $${paramIndex}
      )`);
      params.push(options.after);
      paramIndex++;
    }

    params.push(limit);

    // Order by Snowflake ID (which is chronological)
    // When using 'before', we want newest first (DESC), then reverse
    // When using 'after', we want oldest first (ASC)
    const orderDirection = options.after ? 'ASC' : 'DESC';

    const result = await this.pool.query<MessageRow>(
      `SELECT id, channel_id, author_id, content, mentions, mention_roles, created_at, edited_at, deleted_at
       FROM messages
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at ${orderDirection}, id ${orderDirection}
       LIMIT $${paramIndex}`,
      params
    );

    const messages = result.rows.map(rowToMessage);

    // If we used DESC order (before cursor or no cursor), reverse to get chronological order
    if (orderDirection === 'DESC') {
      messages.reverse();
    }

    return messages;
  }


  /**
   * Update message content (idempotent)
   * Requirements: 11.1
   * 
   * Idempotent: If message doesn't exist or is deleted, returns null.
   * Multiple updates with same content are safe.
   */
  async updateMessage(
    messageId: Snowflake,
    content: string,
    client?: PoolClient
  ): Promise<Message | null> {
    const conn = client ?? this.pool;
    const result = await conn.query<MessageRow>(
      `UPDATE messages SET content = $1, edited_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, channel_id, author_id, content, mentions, mention_roles, created_at, edited_at, deleted_at`,
      [content, messageId]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return rowToMessage(row);
  }

  /**
   * Update message content (idempotent with version check)
   * Requirements: 11.1
   * 
   * Only updates if the message hasn't been edited since the given timestamp.
   * Returns the current message state regardless of whether update was applied.
   */
  async updateMessageIdempotent(
    messageId: Snowflake,
    content: string,
    expectedEditedAt: Date | null,
    client?: PoolClient
  ): Promise<{ message: Message | null; updated: boolean }> {
    const conn = client ?? this.pool;
    
    // Get current message state
    const current = await this.getMessageById(messageId);
    if (!current || current.deleted_at) {
      return { message: null, updated: false };
    }
    
    // Check if already at expected state
    if (current.content === content) {
      return { message: current, updated: false };
    }
    
    // Check version (edited_at)
    const currentEditedAt = current.edited_at?.getTime() ?? null;
    const expectedTime = expectedEditedAt?.getTime() ?? null;
    
    if (currentEditedAt !== expectedTime) {
      // Message was edited since expected - return current state
      return { message: current, updated: false };
    }
    
    // Perform update
    const result = await conn.query<MessageRow>(
      `UPDATE messages SET content = $1, edited_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, channel_id, author_id, content, mentions, mention_roles, created_at, edited_at, deleted_at`,
      [content, messageId]
    );
    
    const row = result.rows[0];
    if (!row) {
      return { message: current, updated: false };
    }
    
    return { message: rowToMessage(row), updated: true };
  }

  /**
   * Soft-delete a message (idempotent)
   * Requirements: 11.2, 11.3
   * 
   * Idempotent: If message is already deleted, returns true.
   * Deletion dominance: Once deleted, message stays deleted.
   */
  async deleteMessage(messageId: Snowflake, client?: PoolClient): Promise<boolean> {
    const conn = client ?? this.pool;
    const result = await conn.query(
      `UPDATE messages SET deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
      [messageId]
    );
    
    // If no rows affected, check if message exists and is already deleted
    if ((result.rowCount ?? 0) === 0) {
      const existing = await this.getMessageById(messageId);
      // Return true if message exists and is deleted (idempotent)
      return existing?.deleted_at !== undefined && existing?.deleted_at !== null;
    }
    
    return true;
  }

  /**
   * Soft-delete a message (idempotent with result info)
   * Requirements: 11.2, 11.3
   * 
   * Returns whether the delete was newly applied or already existed.
   */
  async deleteMessageIdempotent(
    messageId: Snowflake,
    client?: PoolClient
  ): Promise<{ deleted: boolean; wasAlreadyDeleted: boolean }> {
    const conn = client ?? this.pool;
    
    // Check current state
    const current = await this.getMessageById(messageId);
    if (!current) {
      return { deleted: false, wasAlreadyDeleted: false };
    }
    
    if (current.deleted_at) {
      return { deleted: true, wasAlreadyDeleted: true };
    }
    
    // Perform delete
    const result = await conn.query(
      `UPDATE messages SET deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
      [messageId]
    );
    
    return { 
      deleted: (result.rowCount ?? 0) > 0, 
      wasAlreadyDeleted: false 
    };
  }

  /**
   * Check if a message is deleted
   */
  async isMessageDeleted(messageId: Snowflake): Promise<boolean> {
    const result = await this.pool.query<{ deleted_at: Date | null }>(
      `SELECT deleted_at FROM messages WHERE id = $1`,
      [messageId]
    );
    const row = result.rows[0];
    return row?.deleted_at !== null && row?.deleted_at !== undefined;
  }

  // ============================================
  // Channel Operations (for message validation)
  // ============================================

  /**
   * Check if a channel exists and get its guild_id
   */
  async getChannelInfo(channelId: Snowflake): Promise<{ guild_id: Snowflake } | null> {
    const result = await this.pool.query<{ guild_id: string }>(
      `SELECT guild_id FROM channels WHERE id = $1 AND deleted_at IS NULL`,
      [channelId]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return { guild_id: row.guild_id as Snowflake };
  }

  /**
   * Check if a user exists
   */
  async userExists(userId: Snowflake): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM users WHERE id = $1`,
      [userId]
    );
    return result.rows.length > 0;
  }

  /**
   * Check if a role exists in a guild
   */
  async roleExistsInGuild(roleId: Snowflake, guildId: Snowflake): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM roles WHERE id = $1 AND guild_id = $2`,
      [roleId, guildId]
    );
    return result.rows.length > 0;
  }

  /**
   * Check if a user is a member of a guild
   */
  async isMember(guildId: Snowflake, userId: Snowflake): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM guild_members WHERE guild_id = $1 AND user_id = $2`,
      [guildId, userId]
    );
    return result.rows.length > 0;
  }

  /**
   * Get a database client for transactions
   */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }
}
