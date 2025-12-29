/**
 * Messaging Service
 *
 * Handles message creation, retrieval, editing, and deletion with permission validation.
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5, 11.1, 11.2, 11.3
 */
import type { Pool } from 'pg';
import type { Snowflake, Message, PaginationOptions } from '@discord-clone/types';
import type { MessageCreatedEvent, MessageUpdatedEvent, MessageDeletedEvent } from '@discord-clone/types';
import { MessagingRepository } from './repository.js';
/**
 * Permission checker interface
 * This allows the service to be decoupled from the permissions service
 */
export interface PermissionChecker {
    hasPermission(userId: Snowflake, channelId: Snowflake, permission: bigint): Promise<boolean>;
}
/**
 * Event emitter interface
 * This allows the service to emit events without being coupled to a specific implementation
 */
export interface EventEmitter {
    emit(event: MessageCreatedEvent | MessageUpdatedEvent | MessageDeletedEvent): Promise<void>;
}
/**
 * Messaging Service Configuration
 */
export interface MessagingServiceConfig {
    workerId?: number;
    permissionChecker: PermissionChecker;
    eventEmitter?: EventEmitter;
}
/**
 * Parse mentions from message content
 * Extracts user mentions (<@userId>) and role mentions (<@&roleId>)
 */
export declare function parseMentions(content: string): {
    users: Snowflake[];
    roles: Snowflake[];
};
/**
 * Messaging Service
 */
export declare class MessagingService {
    private readonly repository;
    private readonly snowflake;
    private readonly permissionChecker;
    private readonly eventEmitter;
    constructor(pool: Pool, config: MessagingServiceConfig);
    /**
     * Create a new message
     * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
     *
     * - Validates send_message permission
     * - Creates message with Snowflake ID
     * - Parses mentions (users and roles)
     * - Emits message.created event
     */
    createMessage(channelId: Snowflake, authorId: Snowflake, content: string): Promise<Message>;
    /**
     * Get a message by ID
     */
    getMessage(messageId: Snowflake): Promise<Message>;
    /**
     * Get messages for a channel with pagination
     * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
     *
     * - Validates read_message permission
     * - Cursor-based pagination (before/after)
     * - Limits page size to 100
     * - Orders by Snowflake ID (chronological)
     */
    getMessages(channelId: Snowflake, userId: Snowflake, options?: PaginationOptions): Promise<Message[]>;
    /**
     * Update a message
     * Requirements: 11.1
     *
     * - Validates author or manage_messages permission
     * - Updates content, sets edited_at
     * - Emits message.updated event
     */
    updateMessage(messageId: Snowflake, userId: Snowflake, content: string): Promise<Message>;
    /**
     * Delete a message
     * Requirements: 11.2, 11.3
     *
     * - Validates author or manage_messages permission
     * - Soft-deletes (sets deleted_at)
     * - Emits message.deleted event
     * - Implements deletion dominance (deleted messages ignore edits)
     */
    deleteMessage(messageId: Snowflake, userId: Snowflake): Promise<void>;
    /**
     * Get the repository for direct access (used for testing)
     */
    getRepository(): MessagingRepository;
}
//# sourceMappingURL=service.d.ts.map