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
export declare function rowToChannel(row: ChannelRow): Channel;
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
export declare class ChannelRepository {
    private readonly pool;
    constructor(pool: Pool);
    /**
     * Create a new channel
     * Requirements: 8.1
     */
    createChannel(id: Snowflake, guildId: Snowflake, name: string, type: ChannelType, position: number, parentId?: Snowflake, topic?: string, client?: PoolClient): Promise<Channel>;
    /**
     * Get channel by ID
     */
    getChannelById(channelId: Snowflake): Promise<Channel | null>;
    /**
     * Get all channels for a guild (ordered by position)
     */
    getGuildChannels(guildId: Snowflake): Promise<Channel[]>;
    /**
     * Update channel settings
     * Requirements: 8.2
     */
    updateChannel(channelId: Snowflake, updates: {
        name?: string;
        topic?: string | null;
        position?: number;
        parentId?: Snowflake | null;
    }, client?: PoolClient): Promise<Channel | null>;
    /**
     * Soft-delete a channel
     * Requirements: 8.4
     */
    deleteChannel(channelId: Snowflake, client?: PoolClient): Promise<boolean>;
    /**
     * Get the highest position for channels in a guild
     */
    getMaxChannelPosition(guildId: Snowflake): Promise<number>;
    /**
     * Reorder channels by updating positions
     * Requirements: 8.3
     */
    reorderChannels(guildId: Snowflake, channelPositions: ChannelPositionUpdate[], client?: PoolClient): Promise<void>;
    /**
     * Get child channels of a category
     */
    getChildChannels(parentId: Snowflake): Promise<Channel[]>;
    /**
     * Check if a channel has children
     */
    hasChildChannels(channelId: Snowflake): Promise<boolean>;
    /**
     * Check if a guild exists
     */
    guildExists(guildId: Snowflake): Promise<boolean>;
    /**
     * Get a database client for transactions
     */
    getClient(): Promise<PoolClient>;
}
//# sourceMappingURL=repository.d.ts.map