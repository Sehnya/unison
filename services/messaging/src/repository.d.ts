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
export declare function rowToMessage(row: MessageRow): Message;
/**
 * Maximum page size for message retrieval
 */
export declare const MAX_PAGE_SIZE = 100;
/**
 * Default page size for message retrieval
 */
export declare const DEFAULT_PAGE_SIZE = 50;
/**
 * Maximum message content length
 */
export declare const MAX_MESSAGE_LENGTH = 2000;
/**
 * Messaging Repository
 */
export declare class MessagingRepository {
    private readonly pool;
    constructor(pool: Pool);
    /**
     * Create a new message (idempotent)
     * Requirements: 9.1, 9.2
     *
     * Uses ON CONFLICT to handle duplicate message IDs from event retries.
     * If a message with the same ID already exists, returns the existing message.
     */
    createMessage(id: Snowflake, channelId: Snowflake, authorId: Snowflake, content: string, mentions: Snowflake[], mentionRoles: Snowflake[], createdAt: Date, client?: PoolClient): Promise<Message>;
    /**
     * Create a new message (idempotent) - alternative for non-partitioned tables
     * Requirements: 9.1, 9.2
     *
     * Uses ON CONFLICT to handle duplicate message IDs from event retries.
     * If a message with the same ID already exists, returns the existing message.
     */
    createMessageIdempotent(id: Snowflake, channelId: Snowflake, authorId: Snowflake, content: string, mentions: Snowflake[], mentionRoles: Snowflake[], createdAt: Date, client?: PoolClient): Promise<{
        message: Message;
        created: boolean;
    }>;
    /**
     * Get message by ID
     */
    getMessageById(messageId: Snowflake): Promise<Message | null>;
    /**
     * Get messages for a channel with pagination
     * Requirements: 10.1, 10.2, 10.3, 10.4
     */
    getMessages(channelId: Snowflake, options?: PaginationOptions): Promise<Message[]>;
    /**
     * Update message content (idempotent)
     * Requirements: 11.1
     *
     * Idempotent: If message doesn't exist or is deleted, returns null.
     * Multiple updates with same content are safe.
     */
    updateMessage(messageId: Snowflake, content: string, client?: PoolClient): Promise<Message | null>;
    /**
     * Update message content (idempotent with version check)
     * Requirements: 11.1
     *
     * Only updates if the message hasn't been edited since the given timestamp.
     * Returns the current message state regardless of whether update was applied.
     */
    updateMessageIdempotent(messageId: Snowflake, content: string, expectedEditedAt: Date | null, client?: PoolClient): Promise<{
        message: Message | null;
        updated: boolean;
    }>;
    /**
     * Soft-delete a message (idempotent)
     * Requirements: 11.2, 11.3
     *
     * Idempotent: If message is already deleted, returns true.
     * Deletion dominance: Once deleted, message stays deleted.
     */
    deleteMessage(messageId: Snowflake, client?: PoolClient): Promise<boolean>;
    /**
     * Soft-delete a message (idempotent with result info)
     * Requirements: 11.2, 11.3
     *
     * Returns whether the delete was newly applied or already existed.
     */
    deleteMessageIdempotent(messageId: Snowflake, client?: PoolClient): Promise<{
        deleted: boolean;
        wasAlreadyDeleted: boolean;
    }>;
    /**
     * Check if a message is deleted
     */
    isMessageDeleted(messageId: Snowflake): Promise<boolean>;
    /**
     * Check if a channel exists and get its guild_id
     */
    getChannelInfo(channelId: Snowflake): Promise<{
        guild_id: Snowflake;
    } | null>;
    /**
     * Check if a user exists
     */
    userExists(userId: Snowflake): Promise<boolean>;
    /**
     * Check if a role exists in a guild
     */
    roleExistsInGuild(roleId: Snowflake, guildId: Snowflake): Promise<boolean>;
    /**
     * Check if a user is a member of a guild
     */
    isMember(guildId: Snowflake, userId: Snowflake): Promise<boolean>;
    /**
     * Get a database client for transactions
     */
    getClient(): Promise<PoolClient>;
}
//# sourceMappingURL=repository.d.ts.map