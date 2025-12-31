/**
 * Emoji Service - Business logic for guild emojis
 */

import type { Snowflake } from '@discord-clone/types';
import { EmojiRepository, type GuildEmoji } from './emoji-repository.js';
import { SnowflakeGenerator } from '@discord-clone/snowflake';

const MAX_EMOJIS_PER_GUILD = 50;

export class EmojiService {
  private snowflake: SnowflakeGenerator;

  constructor(
    private readonly repository: EmojiRepository,
    workerId: number = 1
  ) {
    this.snowflake = new SnowflakeGenerator(workerId);
  }

  /**
   * Get all emojis for a guild
   */
  async getGuildEmojis(guildId: string): Promise<GuildEmoji[]> {
    return this.repository.getGuildEmojis(guildId as Snowflake);
  }

  /**
   * Create a new emoji
   */
  async createEmoji(
    guildId: string,
    uploaderId: string,
    name: string,
    imageUrl: string,
    animated: boolean = false
  ): Promise<GuildEmoji> {
    // Check emoji limit
    const count = await this.repository.countGuildEmojis(guildId as Snowflake);
    if (count >= MAX_EMOJIS_PER_GUILD) {
      throw new Error(`Guild has reached the maximum of ${MAX_EMOJIS_PER_GUILD} emojis`);
    }

    // Check if name already exists
    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const exists = await this.repository.emojiNameExists(guildId as Snowflake, sanitizedName);
    if (exists) {
      throw new Error(`An emoji with the name "${sanitizedName}" already exists`);
    }

    const id = this.snowflake.generate();
    return this.repository.createEmoji(
      id,
      guildId as Snowflake,
      name,
      imageUrl,
      uploaderId as Snowflake,
      animated
    );
  }

  /**
   * Update an emoji
   */
  async updateEmoji(emojiId: string, updates: { name?: string }): Promise<GuildEmoji | null> {
    return this.repository.updateEmoji(emojiId as Snowflake, updates);
  }

  /**
   * Delete an emoji
   */
  async deleteEmoji(emojiId: string): Promise<boolean> {
    return this.repository.deleteEmoji(emojiId as Snowflake);
  }

  /**
   * Get emoji by ID
   */
  async getEmojiById(emojiId: string): Promise<GuildEmoji | null> {
    return this.repository.getEmojiById(emojiId as Snowflake);
  }
}
