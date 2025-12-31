/**
 * Emoji Repository - Database operations for guild emojis
 */

import type { Pool, PoolClient } from 'pg';
import type { Snowflake } from '@discord-clone/types';

/**
 * Emoji type
 */
export interface GuildEmoji {
  id: Snowflake;
  guild_id: Snowflake;
  name: string;
  image_url: string;
  uploaded_by: Snowflake | null;
  animated: boolean;
  created_at: Date;
}

/**
 * Emoji row from database
 */
interface EmojiRow {
  id: string;
  guild_id: string;
  name: string;
  image_url: string;
  uploaded_by: string | null;
  animated: boolean;
  created_at: Date;
}

/**
 * Convert database row to GuildEmoji type
 */
function rowToEmoji(row: EmojiRow): GuildEmoji {
  return {
    id: row.id as Snowflake,
    guild_id: row.guild_id as Snowflake,
    name: row.name,
    image_url: row.image_url,
    uploaded_by: row.uploaded_by as Snowflake | null,
    animated: row.animated,
    created_at: row.created_at,
  };
}

/**
 * Emoji Repository
 */
export class EmojiRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Create a new emoji
   */
  async createEmoji(
    id: Snowflake,
    guildId: Snowflake,
    name: string,
    imageUrl: string,
    uploadedBy: Snowflake,
    animated: boolean = false,
    client?: PoolClient
  ): Promise<GuildEmoji> {
    const conn = client ?? this.pool;
    const result = await conn.query<EmojiRow>(
      `INSERT INTO guild_emojis (id, guild_id, name, image_url, uploaded_by, animated)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, guild_id, name, image_url, uploaded_by, animated, created_at`,
      [id, guildId, name.toLowerCase().replace(/[^a-z0-9_]/g, '_'), imageUrl, uploadedBy, animated]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to create emoji');
    }
    return rowToEmoji(row);
  }

  /**
   * Get all emojis for a guild
   */
  async getGuildEmojis(guildId: Snowflake): Promise<GuildEmoji[]> {
    const result = await this.pool.query<EmojiRow>(
      `SELECT id, guild_id, name, image_url, uploaded_by, animated, created_at
       FROM guild_emojis
       WHERE guild_id = $1
       ORDER BY name ASC`,
      [guildId]
    );
    return result.rows.map(rowToEmoji);
  }

  /**
   * Get emoji by ID
   */
  async getEmojiById(emojiId: Snowflake): Promise<GuildEmoji | null> {
    const result = await this.pool.query<EmojiRow>(
      `SELECT id, guild_id, name, image_url, uploaded_by, animated, created_at
       FROM guild_emojis
       WHERE id = $1`,
      [emojiId]
    );
    const row = result.rows[0];
    return row ? rowToEmoji(row) : null;
  }

  /**
   * Get emoji by name in a guild
   */
  async getEmojiByName(guildId: Snowflake, name: string): Promise<GuildEmoji | null> {
    const result = await this.pool.query<EmojiRow>(
      `SELECT id, guild_id, name, image_url, uploaded_by, animated, created_at
       FROM guild_emojis
       WHERE guild_id = $1 AND name = $2`,
      [guildId, name.toLowerCase()]
    );
    const row = result.rows[0];
    return row ? rowToEmoji(row) : null;
  }

  /**
   * Update emoji name
   */
  async updateEmoji(
    emojiId: Snowflake,
    updates: { name?: string },
    client?: PoolClient
  ): Promise<GuildEmoji | null> {
    const conn = client ?? this.pool;
    
    if (!updates.name) {
      return this.getEmojiById(emojiId);
    }

    const result = await conn.query<EmojiRow>(
      `UPDATE guild_emojis
       SET name = $1
       WHERE id = $2
       RETURNING id, guild_id, name, image_url, uploaded_by, animated, created_at`,
      [updates.name.toLowerCase().replace(/[^a-z0-9_]/g, '_'), emojiId]
    );
    const row = result.rows[0];
    return row ? rowToEmoji(row) : null;
  }

  /**
   * Delete an emoji
   */
  async deleteEmoji(emojiId: Snowflake, client?: PoolClient): Promise<boolean> {
    const conn = client ?? this.pool;
    const result = await conn.query(
      `DELETE FROM guild_emojis WHERE id = $1`,
      [emojiId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Count emojis in a guild
   */
  async countGuildEmojis(guildId: Snowflake): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM guild_emojis WHERE guild_id = $1`,
      [guildId]
    );
    return parseInt(result.rows[0]?.count ?? '0', 10);
  }

  /**
   * Check if emoji name exists in guild
   */
  async emojiNameExists(guildId: Snowflake, name: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM guild_emojis WHERE guild_id = $1 AND name = $2`,
      [guildId, name.toLowerCase()]
    );
    return result.rows.length > 0;
  }
}
