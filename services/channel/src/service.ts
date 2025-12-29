/**
 * Channel Service
 *
 * Handles channel CRUD operations, category management, and channel ordering.
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

import type { Pool } from 'pg';
import type { Snowflake, Channel } from '@discord-clone/types';
import { ChannelType } from '@discord-clone/types';
import { SnowflakeGenerator } from '@discord-clone/snowflake';
import { ChannelRepository, type ChannelPositionUpdate } from './repository.js';
import {
  ChannelNotFoundError,
  GuildNotFoundError,
  InvalidParentChannelError,
  ParentChannelNotFoundError,
  CannotDeleteCategoryWithChildrenError,
} from './errors.js';

/**
 * Channel Service Configuration
 */
export interface ChannelServiceConfig {
  workerId?: number;
}

/**
 * Channel creation options
 */
export interface CreateChannelOptions {
  name: string;
  type?: ChannelType;
  parentId?: Snowflake;
  topic?: string;
}

/**
 * Channel update options
 */
export interface UpdateChannelOptions {
  name?: string;
  topic?: string | null;
  position?: number;
  parentId?: Snowflake | null;
}

/**
 * Channel Service
 */
export class ChannelService {
  private readonly repository: ChannelRepository;
  private readonly snowflake: SnowflakeGenerator;

  constructor(pool: Pool, config: ChannelServiceConfig = {}) {
    this.repository = new ChannelRepository(pool);
    this.snowflake = new SnowflakeGenerator(config.workerId ?? 0);
  }

  // ============================================
  // Channel CRUD Operations
  // Requirements: 8.1, 8.2, 8.3, 8.4
  // ============================================

  /**
   * Create a new channel
   * Requirements: 8.1
   *
   * Creates a channel with:
   * - Snowflake ID
   * - Type (TEXT or CATEGORY)
   * - Name
   * - Optional parent category
   * - Optional topic
   */
  async createChannel(guildId: Snowflake, options: CreateChannelOptions): Promise<Channel> {
    // Verify guild exists
    const guildExists = await this.repository.guildExists(guildId);
    if (!guildExists) {
      throw new GuildNotFoundError();
    }

    const type = options.type ?? ChannelType.TEXT;

    // Validate parent if provided
    if (options.parentId) {
      const parentChannel = await this.repository.getChannelById(options.parentId);
      if (!parentChannel) {
        throw new ParentChannelNotFoundError();
      }
      // Parent must be a category
      if (parentChannel.type !== ChannelType.CATEGORY) {
        throw new InvalidParentChannelError();
      }
      // Parent must be in the same guild
      if (parentChannel.guild_id !== guildId) {
        throw new ParentChannelNotFoundError();
      }
    }

    // Categories cannot have parents
    if (type === ChannelType.CATEGORY && options.parentId) {
      throw new InvalidParentChannelError();
    }

    // Get the next position
    const maxPosition = await this.repository.getMaxChannelPosition(guildId);
    const position = maxPosition + 1;

    // Generate Snowflake ID
    const channelId = this.snowflake.generate();

    // Create the channel
    return this.repository.createChannel(
      channelId,
      guildId,
      options.name,
      type,
      position,
      options.parentId,
      options.topic
    );
  }


  /**
   * Get a channel by ID
   * Requirements: 8.1
   */
  async getChannel(channelId: Snowflake): Promise<Channel> {
    const channel = await this.repository.getChannelById(channelId);
    if (!channel) {
      throw new ChannelNotFoundError();
    }
    return channel;
  }

  /**
   * Get all channels for a guild (ordered by position)
   * Requirements: 8.1
   */
  async getGuildChannels(guildId: Snowflake): Promise<Channel[]> {
    // Verify guild exists
    const guildExists = await this.repository.guildExists(guildId);
    if (!guildExists) {
      throw new GuildNotFoundError();
    }

    return this.repository.getGuildChannels(guildId);
  }

  /**
   * Update channel settings
   * Requirements: 8.2
   */
  async updateChannel(channelId: Snowflake, updates: UpdateChannelOptions): Promise<Channel> {
    // Verify channel exists
    const channel = await this.repository.getChannelById(channelId);
    if (!channel) {
      throw new ChannelNotFoundError();
    }

    // Validate parent if being changed
    if (updates.parentId !== undefined && updates.parentId !== null) {
      const parentChannel = await this.repository.getChannelById(updates.parentId);
      if (!parentChannel) {
        throw new ParentChannelNotFoundError();
      }
      // Parent must be a category
      if (parentChannel.type !== ChannelType.CATEGORY) {
        throw new InvalidParentChannelError();
      }
      // Parent must be in the same guild
      if (parentChannel.guild_id !== channel.guild_id) {
        throw new ParentChannelNotFoundError();
      }
      // Categories cannot have parents
      if (channel.type === ChannelType.CATEGORY) {
        throw new InvalidParentChannelError();
      }
    }

    // Build update object with only defined properties
    const updateData: {
      name?: string;
      topic?: string | null;
      position?: number;
      parentId?: Snowflake | null;
    } = {};
    
    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }
    if (updates.topic !== undefined) {
      updateData.topic = updates.topic;
    }
    if (updates.position !== undefined) {
      updateData.position = updates.position;
    }
    if (updates.parentId !== undefined) {
      updateData.parentId = updates.parentId;
    }

    const updatedChannel = await this.repository.updateChannel(channelId, updateData);

    if (!updatedChannel) {
      throw new ChannelNotFoundError();
    }

    return updatedChannel;
  }

  /**
   * Reorder channels
   * Requirements: 8.3
   */
  async reorderChannels(guildId: Snowflake, positions: ChannelPositionUpdate[]): Promise<void> {
    // Verify guild exists
    const guildExists = await this.repository.guildExists(guildId);
    if (!guildExists) {
      throw new GuildNotFoundError();
    }

    // Verify all channels exist and belong to the guild
    for (const { channelId, parentId } of positions) {
      const channel = await this.repository.getChannelById(channelId);
      if (!channel || channel.guild_id !== guildId) {
        throw new ChannelNotFoundError();
      }

      // Validate parent if provided
      if (parentId !== undefined && parentId !== null) {
        const parentChannel = await this.repository.getChannelById(parentId);
        if (!parentChannel || parentChannel.guild_id !== guildId) {
          throw new ParentChannelNotFoundError();
        }
        if (parentChannel.type !== ChannelType.CATEGORY) {
          throw new InvalidParentChannelError();
        }
        // Categories cannot have parents
        if (channel.type === ChannelType.CATEGORY) {
          throw new InvalidParentChannelError();
        }
      }
    }

    await this.repository.reorderChannels(guildId, positions);
  }

  /**
   * Delete a channel (soft-delete)
   * Requirements: 8.4
   */
  async deleteChannel(channelId: Snowflake): Promise<void> {
    // Verify channel exists
    const channel = await this.repository.getChannelById(channelId);
    if (!channel) {
      throw new ChannelNotFoundError();
    }

    // If it's a category, check for child channels
    if (channel.type === ChannelType.CATEGORY) {
      const hasChildren = await this.repository.hasChildChannels(channelId);
      if (hasChildren) {
        throw new CannotDeleteCategoryWithChildrenError();
      }
    }

    const deleted = await this.repository.deleteChannel(channelId);
    if (!deleted) {
      throw new ChannelNotFoundError();
    }
  }

  /**
   * Get child channels of a category
   */
  async getChildChannels(categoryId: Snowflake): Promise<Channel[]> {
    const category = await this.repository.getChannelById(categoryId);
    if (!category) {
      throw new ChannelNotFoundError();
    }
    if (category.type !== ChannelType.CATEGORY) {
      return [];
    }
    return this.repository.getChildChannels(categoryId);
  }

  /**
   * Get the repository for direct access
   */
  getRepository(): ChannelRepository {
    return this.repository;
  }
}
