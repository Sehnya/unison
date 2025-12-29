/**
 * Channel Repository - Database operations for channels
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

import type { Pool, PoolClient } from 'pg';
import type { Snowflake, Channel } from '@discord-clone/types';
import { ChannelType } from '@discord-clone/types';

/**
 * Channel row from database
 */
export interface ChannelRow {
  id: string;
  guild_id: string;
  type: number;
  name: string;
  topic: string | null;
  parent_id: string | null;
  position: number;
  created_at: Date;
  deleted_at: Date | null;
}

/**
 * Guild row from database (minimal for channel operations)
 */
export interface GuildRow {
  id: string;
  owner_id: string;
  deleted_at: Date | null;
}

/**
 * Convert database row to Channel type
 */
export function rowToChannel(row: ChannelRow): Channel {
  const channel: Channel = {
    id: row.id as Snowflake,
    guild_id: row.guild_id as Snowflake,
    type: row.type as ChannelType,
    name: row.name,
    position: row.position,
    created_at: row.created_at,
  };
  if (row.topic) {
    channel.topic = row.topic;
  }
  if (row.parent_id) {
    channel.parent_id = row.parent_id as Snowflake;
  }
  if (row.deleted_at) {
    channel.deleted_at = row.deleted_at;
  }
  return channel;
}


/**
 * Channel position update
 */
export interface ChannelPositionUpdate {
  channelId: Snowflake;
  position: number;
  parentId?: Snowflake | null;
}

/**
 * Channel Repository
 */
export class ChannelRepository {
  constructor(private readonly pool: Pool) {}

  // ============================================
  // Channel CRUD Operations
  // Requirements: 8.1, 8.2, 8.3, 8.4
  // ============================================

  /**
   * Create a new channel
   * Requirements: 8.1
   */
  async createChannel(
    id: Snowflake,
    guildId: Snowflake,
    name: string,
    type: ChannelType,
    position: number,
    parentId?: Snowflake,
    topic?: string,
    client?: PoolClient
  ): Promise<Channel> {
    const conn = client ?? this.pool;
    const result = await conn.query<ChannelRow>(
      `INSERT INTO channels (id, guild_id, type, name, topic, parent_id, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, guild_id, type, name, topic, parent_id, position, created_at, deleted_at`,
      [id, guildId, type, name.trim(), topic ?? null, parentId ?? null, position]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to create channel');
    }
    return rowToChannel(row);
  }

  /**
   * Get channel by ID
   */
  async getChannelById(channelId: Snowflake): Promise<Channel | null> {
    const result = await this.pool.query<ChannelRow>(
      `SELECT id, guild_id, type, name, topic, parent_id, position, created_at, deleted_at
       FROM channels WHERE id = $1 AND deleted_at IS NULL`,
      [channelId]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return rowToChannel(row);
  }

  /**
   * Get all channels for a guild (ordered by position)
   */
  async getGuildChannels(guildId: Snowflake): Promise<Channel[]> {
    const result = await this.pool.query<ChannelRow>(
      `SELECT id, guild_id, type, name, topic, parent_id, position, created_at, deleted_at
       FROM channels WHERE guild_id = $1 AND deleted_at IS NULL
       ORDER BY position ASC`,
      [guildId]
    );
    return result.rows.map(rowToChannel);
  }

  /**
   * Update channel settings
   * Requirements: 8.2
   */
  async updateChannel(
    channelId: Snowflake,
    updates: {
      name?: string;
      topic?: string | null;
      position?: number;
      parentId?: Snowflake | null;
    },
    client?: PoolClient
  ): Promise<Channel | null> {
    const conn = client ?? this.pool;
    const setClauses: string[] = [];
    const values: (string | number | null)[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name.trim());
    }
    if (updates.topic !== undefined) {
      setClauses.push(`topic = $${paramIndex++}`);
      values.push(updates.topic);
    }
    if (updates.position !== undefined) {
      setClauses.push(`position = $${paramIndex++}`);
      values.push(updates.position);
    }
    if (updates.parentId !== undefined) {
      setClauses.push(`parent_id = $${paramIndex++}`);
      values.push(updates.parentId);
    }

    if (setClauses.length === 0) {
      return this.getChannelById(channelId);
    }

    values.push(channelId);
    const result = await conn.query<ChannelRow>(
      `UPDATE channels SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING id, guild_id, type, name, topic, parent_id, position, created_at, deleted_at`,
      values
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return rowToChannel(row);
  }

  /**
   * Soft-delete a channel
   * Requirements: 8.4
   */
  async deleteChannel(channelId: Snowflake, client?: PoolClient): Promise<boolean> {
    const conn = client ?? this.pool;
    const result = await conn.query(
      `UPDATE channels SET deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
      [channelId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get the highest position for channels in a guild
   */
  async getMaxChannelPosition(guildId: Snowflake): Promise<number> {
    const result = await this.pool.query<{ max: number | null }>(
      `SELECT MAX(position) as max FROM channels WHERE guild_id = $1 AND deleted_at IS NULL`,
      [guildId]
    );
    return result.rows[0]?.max ?? -1;
  }

  /**
   * Reorder channels by updating positions
   * Requirements: 8.3
   */
  async reorderChannels(
    guildId: Snowflake,
    channelPositions: ChannelPositionUpdate[],
    client?: PoolClient
  ): Promise<void> {
    const conn = client ?? this.pool;
    for (const { channelId, position, parentId } of channelPositions) {
      if (parentId !== undefined) {
        await conn.query(
          `UPDATE channels SET position = $1, parent_id = $2 WHERE id = $3 AND guild_id = $4 AND deleted_at IS NULL`,
          [position, parentId, channelId, guildId]
        );
      } else {
        await conn.query(
          `UPDATE channels SET position = $1 WHERE id = $2 AND guild_id = $3 AND deleted_at IS NULL`,
          [position, channelId, guildId]
        );
      }
    }
  }

  /**
   * Get child channels of a category
   */
  async getChildChannels(parentId: Snowflake): Promise<Channel[]> {
    const result = await this.pool.query<ChannelRow>(
      `SELECT id, guild_id, type, name, topic, parent_id, position, created_at, deleted_at
       FROM channels WHERE parent_id = $1 AND deleted_at IS NULL
       ORDER BY position ASC`,
      [parentId]
    );
    return result.rows.map(rowToChannel);
  }

  /**
   * Check if a channel has children
   */
  async hasChildChannels(channelId: Snowflake): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM channels WHERE parent_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [channelId]
    );
    return result.rows.length > 0;
  }

  // ============================================
  // Guild Operations (for channel validation)
  // ============================================

  /**
   * Check if a guild exists
   */
  async guildExists(guildId: Snowflake): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM guilds WHERE id = $1 AND deleted_at IS NULL`,
      [guildId]
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
