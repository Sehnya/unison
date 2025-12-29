/**
 * Channel Service
 *
 * Handles channel CRUD operations, category management, and channel ordering.
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */
import type { Pool } from 'pg';
import type { Snowflake, Channel } from '@discord-clone/types';
import { ChannelType } from '@discord-clone/types';
import { ChannelRepository, type ChannelPositionUpdate } from './repository.js';
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
export declare class ChannelService {
    private readonly repository;
    private readonly snowflake;
    constructor(pool: Pool, config?: ChannelServiceConfig);
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
    createChannel(guildId: Snowflake, options: CreateChannelOptions): Promise<Channel>;
    /**
     * Get a channel by ID
     * Requirements: 8.1
     */
    getChannel(channelId: Snowflake): Promise<Channel>;
    /**
     * Get all channels for a guild (ordered by position)
     * Requirements: 8.1
     */
    getGuildChannels(guildId: Snowflake): Promise<Channel[]>;
    /**
     * Update channel settings
     * Requirements: 8.2
     */
    updateChannel(channelId: Snowflake, updates: UpdateChannelOptions): Promise<Channel>;
    /**
     * Reorder channels
     * Requirements: 8.3
     */
    reorderChannels(guildId: Snowflake, positions: ChannelPositionUpdate[]): Promise<void>;
    /**
     * Delete a channel (soft-delete)
     * Requirements: 8.4
     */
    deleteChannel(channelId: Snowflake): Promise<void>;
    /**
     * Get child channels of a category
     */
    getChildChannels(categoryId: Snowflake): Promise<Channel[]>;
    /**
     * Get the repository for direct access
     */
    getRepository(): ChannelRepository;
}
//# sourceMappingURL=service.d.ts.map